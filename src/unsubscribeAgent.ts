import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { Email, EmailStorage, UnsubscribeLink } from './types';

export interface UnsubscribeSelection {
  unsubscribe?: string[];
  senders?: string[];
  senderEmails?: string[];
  messageIds?: string[];
  emailIds?: string[];
}

export interface UnsubscribeAgentOptions {
  storagePath: string;
  logPath?: string;
  execute?: boolean;
  forceProtected?: boolean;
  allowBodyLinks?: boolean;
  logDryRun?: boolean;
  selectedSenders?: string[];
  selectedMessageIds?: string[];
  selectedEmailIds?: string[];
}

export interface UnsubscribeResult {
  sender: string;
  senderName?: string;
  emailCount: number;
  status: 'dry_run' | 'success' | 'needs_review' | 'blocked' | 'failed';
  strategy: 'one-click-http' | 'mailto' | 'manual-url' | 'body-link' | 'none' | 'blocked';
  target?: string;
  reason: string;
  httpStatus?: number;
}

export interface UnsubscribeRunResult {
  timestamp: string;
  dryRun: boolean;
  totalSelectedSenders: number;
  results: UnsubscribeResult[];
}

interface CandidateLink extends UnsubscribeLink {
  emailDate?: Date;
  subject?: string;
}

export class UnsubscribeAgent {
  async run(options: UnsubscribeAgentOptions): Promise<UnsubscribeRunResult> {
    const selectedSenders = this.normalizeSet(options.selectedSenders || []);
    const selectedMessageIds = this.normalizeSet(options.selectedMessageIds || []);
    const selectedEmailIds = this.normalizeSet(options.selectedEmailIds || []);

    if (selectedSenders.size === 0 && selectedMessageIds.size === 0 && selectedEmailIds.size === 0) {
      throw new Error('No selected senders or emails provided. Pass --selected, --sender, --message-id, or --email-id.');
    }

    const emails = this.loadEmails(options.storagePath);
    const selectedEmails = this.selectEmails(emails, selectedSenders, selectedMessageIds, selectedEmailIds);
    const senderGroups = this.groupEmailsBySender(selectedEmails);
    const results: UnsubscribeResult[] = [];
    const matchedSenders = this.normalizeSet(Array.from(senderGroups.keys()));

    selectedSenders.forEach(sender => {
      if (!matchedSenders.has(sender)) {
        results.push({
          sender,
          emailCount: 0,
          status: 'needs_review',
          strategy: 'none',
          reason: 'No stored emails matched this selected sender.'
        });
      }
    });

    for (const [sender, senderEmails] of senderGroups.entries()) {
      results.push(await this.processSender(sender, senderEmails, options));
    }

    const runResult: UnsubscribeRunResult = {
      timestamp: new Date().toISOString(),
      dryRun: !options.execute,
      totalSelectedSenders: results.length,
      results
    };

    if (options.execute || options.logDryRun) {
      this.appendLog(options.logPath || './data/unsubscribe-log.json', runResult);
    }

    return runResult;
  }

  private async processSender(
    sender: string,
    emails: Email[],
    options: UnsubscribeAgentOptions
  ): Promise<UnsubscribeResult> {
    const senderName = emails[0]?.sender?.name;
    const protectedReason = this.getProtectedSenderReason(sender, emails);
    if (protectedReason && !options.forceProtected) {
      return {
        sender,
        senderName,
        emailCount: emails.length,
        status: 'blocked',
        strategy: 'blocked',
        reason: `${protectedReason}. Pass --force-protected if you really want to include it.`
      };
    }

    const links = this.collectCandidateLinks(emails, Boolean(options.allowBodyLinks));
    const bestLink = this.chooseBestLink(links);

    if (!bestLink) {
      return {
        sender,
        senderName,
        emailCount: emails.length,
        status: 'needs_review',
        strategy: 'none',
        reason: options.allowBodyLinks
          ? 'No unsubscribe link found in stored headers or message bodies.'
          : 'No List-Unsubscribe header found. Re-run scanning for newer messages or try --allow-body-links for manual fallback links.'
      };
    }

    if (bestLink.kind === 'http' && bestLink.source === 'list-unsubscribe' && bestLink.oneClick) {
      if (!options.execute) {
        return {
          sender,
          senderName,
          emailCount: emails.length,
          status: 'dry_run',
          strategy: 'one-click-http',
          target: bestLink.value,
          reason: 'Would send a one-click unsubscribe POST request.'
        };
      }

      try {
        const response = await this.postOneClick(bestLink.value);
        const success = response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 400;
        return {
          sender,
          senderName,
          emailCount: emails.length,
          status: success ? 'success' : 'failed',
          strategy: 'one-click-http',
          target: bestLink.value,
          reason: success
            ? 'One-click unsubscribe request accepted by remote server.'
            : 'One-click unsubscribe request returned a non-success status.',
          httpStatus: response.statusCode
        };
      } catch (error: any) {
        return {
          sender,
          senderName,
          emailCount: emails.length,
          status: 'failed',
          strategy: 'one-click-http',
          target: bestLink.value,
          reason: error?.message || 'One-click unsubscribe request failed.'
        };
      }
    }

    if (bestLink.kind === 'mailto') {
      return {
        sender,
        senderName,
        emailCount: emails.length,
        status: 'needs_review',
        strategy: 'mailto',
        target: bestLink.value,
        reason: 'Mailto unsubscribe found. Sending unsubscribe emails is not implemented in this foundation yet.'
      };
    }

    return {
      sender,
      senderName,
      emailCount: emails.length,
      status: 'needs_review',
      strategy: bestLink.source === 'body' ? 'body-link' : 'manual-url',
      target: bestLink.value,
      reason: bestLink.source === 'body'
        ? 'Body unsubscribe link found. Review manually before submitting forms.'
        : 'HTTP unsubscribe URL found, but it is not marked as one-click. Review manually before submitting forms.'
    };
  }

  private loadEmails(storagePath: string): Email[] {
    const data = fs.readFileSync(storagePath, 'utf-8');
    const storage: EmailStorage = JSON.parse(data);
    return storage.emails.map(email => ({
      ...email,
      date: new Date(email.date)
    }));
  }

  private selectEmails(
    emails: Email[],
    selectedSenders: Set<string>,
    selectedMessageIds: Set<string>,
    selectedEmailIds: Set<string>
  ): Email[] {
    return emails.filter(email => {
      const sender = this.normalizeValue(this.getSenderEmail(email));
      const messageId = this.normalizeValue(email.messageId || '');
      const emailId = this.normalizeValue(email.id);

      return selectedSenders.has(sender)
        || selectedMessageIds.has(messageId)
        || selectedEmailIds.has(emailId);
    });
  }

  private groupEmailsBySender(emails: Email[]): Map<string, Email[]> {
    const groups = new Map<string, Email[]>();

    emails.forEach(email => {
      const sender = this.getSenderEmail(email);
      const group = groups.get(sender) || [];
      group.push(email);
      groups.set(sender, group);
    });

    groups.forEach(group => {
      group.sort((a, b) => b.date.getTime() - a.date.getTime());
    });

    return groups;
  }

  private collectCandidateLinks(emails: Email[], allowBodyLinks: boolean): CandidateLink[] {
    const links: CandidateLink[] = [];

    emails.forEach(email => {
      const metadataLinks = email.unsubscribe?.links || [];
      metadataLinks.forEach(link => {
        if (link.source === 'list-unsubscribe' || allowBodyLinks) {
          links.push({
            ...link,
            emailDate: email.date,
            subject: email.subject
          });
        }
      });

      if (allowBodyLinks && metadataLinks.every(link => link.source !== 'body')) {
        this.extractBodyLinks(email.body || '').forEach(link => {
          links.push({
            ...link,
            emailDate: email.date,
            subject: email.subject
          });
        });
      }
    });

    return this.dedupeLinks(links);
  }

  private chooseBestLink(links: CandidateLink[]): CandidateLink | undefined {
    return links.find(link => link.kind === 'http' && link.source === 'list-unsubscribe' && link.oneClick)
      || links.find(link => link.kind === 'mailto' && link.source === 'list-unsubscribe')
      || links.find(link => link.kind === 'http' && link.source === 'list-unsubscribe')
      || links.find(link => link.source === 'body');
  }

  private async postOneClick(rawUrl: string): Promise<{ statusCode?: number }> {
    const url = new URL(rawUrl);
    const client = url.protocol === 'http:' ? http : https;

    return new Promise((resolve, reject) => {
      const request = client.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'List-Unsubscribe': 'One-Click',
          'User-Agent': 'email-scanner-agent/1.0'
        }
      }, response => {
        response.resume();
        response.once('end', () => {
          resolve({ statusCode: response.statusCode });
        });
      });

      request.setTimeout(15000, () => {
        request.destroy(new Error('Unsubscribe request timed out'));
      });
      request.once('error', reject);
      request.write('List-Unsubscribe=One-Click');
      request.end();
    });
  }

  private getProtectedSenderReason(sender: string, emails: Email[]): string | undefined {
    const haystack = [
      sender,
      ...emails.map(email => email.sender?.name || ''),
      ...emails.slice(0, 5).map(email => email.subject || '')
    ].join(' ').toLowerCase();

    const protectedPatterns = [
      { pattern: /\.gov\b|government|irs|tax/, reason: 'Government or tax sender looks protected' },
      { pattern: /bank|credit|debit|loan|mortgage|brokerage|investment|paypal|stripe/, reason: 'Financial sender looks protected' },
      { pattern: /apple|icloud|github|security|password|2fa|verification|account alert/, reason: 'Account or security sender looks protected' },
      { pattern: /receipt|invoice|billing|order|shipping|delivery|travel|flight|hotel/, reason: 'Transactional sender looks protected' },
      { pattern: /health|medical|doctor|pharmacy|insurance/, reason: 'Healthcare sender looks protected' }
    ];

    return protectedPatterns.find(entry => entry.pattern.test(haystack))?.reason;
  }

  private extractBodyLinks(body: string): UnsubscribeLink[] {
    const matches = body.replace(/&amp;/g, '&').match(/https?:\/\/[^\s"'<>]+/gi) || [];
    const unsubscribePattern = /(unsubscribe|opt-?out|email-preferences|manage-subscription|subscription-preferences)/i;

    return matches
      .map(url => url.replace(/[)\].,;]+$/, ''))
      .filter(url => unsubscribePattern.test(url))
      .slice(0, 10)
      .map(url => ({
        kind: 'http' as const,
        value: url,
        source: 'body' as const,
        oneClick: false
      }));
  }

  private dedupeLinks(links: CandidateLink[]): CandidateLink[] {
    const seen = new Set<string>();
    return links.filter(link => {
      const key = `${link.kind}:${link.value}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private appendLog(logPath: string, runResult: UnsubscribeRunResult): void {
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let history: UnsubscribeRunResult[] = [];
    if (fs.existsSync(logPath)) {
      try {
        history = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
      } catch {
        history = [];
      }
    }

    history.push(runResult);
    fs.writeFileSync(logPath, JSON.stringify(history, null, 2));
  }

  private normalizeSet(values: string[]): Set<string> {
    return new Set(values.map(value => this.normalizeValue(value)).filter(Boolean));
  }

  private normalizeValue(value: string): string {
    return value.trim().toLowerCase();
  }

  private getSenderEmail(email: Email): string {
    return email.sender?.email || email.from;
  }
}

export function loadUnsubscribeSelection(selectionPath: string): UnsubscribeSelection {
  const data = fs.readFileSync(selectionPath, 'utf-8');
  const parsed = JSON.parse(data);

  if (Array.isArray(parsed)) {
    return { senders: parsed };
  }

  return parsed;
}

export function mergeSelections(
  fileSelection: UnsubscribeSelection | undefined,
  cliSelection: UnsubscribeSelection
): UnsubscribeSelection {
  return {
    unsubscribe: [
      ...(fileSelection?.unsubscribe || []),
      ...(cliSelection.unsubscribe || [])
    ],
    senders: [
      ...(fileSelection?.senders || []),
      ...(fileSelection?.senderEmails || []),
      ...(cliSelection.senders || []),
      ...(cliSelection.senderEmails || [])
    ],
    messageIds: [
      ...(fileSelection?.messageIds || []),
      ...(cliSelection.messageIds || [])
    ],
    emailIds: [
      ...(fileSelection?.emailIds || []),
      ...(cliSelection.emailIds || [])
    ]
  };
}
