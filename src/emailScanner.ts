import Imap from 'imap';
import { simpleParser } from 'mailparser';
import fs from 'fs';
import path from 'path';
import { Email, iCloudConfig, EmailStorage } from './types';

export class EmailScanner {
  private imap: Imap;
  private config: iCloudConfig;
  private storagePath: string;
  private readStateVersion = 2;

  constructor(config: iCloudConfig, storagePath: string = './data/emails.json') {
    this.config = config;
    this.storagePath = storagePath;
    
    this.imap = new Imap({
      user: config.email,
      password: config.password,
      host: 'imap.mail.me.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let isResolved = false;
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          console.error('[DEBUG] IMAP connection timeout');
          this.imap.end();
          reject(new Error('IMAP connection timeout'));
        }
      }, 15000);

      this.imap.once('ready', () => {
        console.log('[DEBUG] IMAP ready - opening INBOX');
        clearTimeout(timeout);

        this.imap.openBox('INBOX', false, (err: any, box: any) => {
          if (err) {
            if (!isResolved) {
              isResolved = true;
              console.error('[DEBUG] Failed to open INBOX:', err.message);
              this.imap.end();
              reject(new Error(`Failed to open INBOX: ${err.message}`));
            }
            return;
          }

          if (!isResolved) {
            isResolved = true;
            console.log('[DEBUG] Successfully opened INBOX');
            resolve();
          }
        });
      });

      this.imap.once('error', (err: any) => {
        clearTimeout(timeout);
        if (!isResolved) {
          isResolved = true;
          console.error('[DEBUG] IMAP error:', err.message);
          reject(new Error(`IMAP error: ${err.message}`));
        }
      });

      this.imap.once('end', () => {
        clearTimeout(timeout);
        console.log('[DEBUG] IMAP connection ended');
      });

      try {
        console.log('[DEBUG] Initiating IMAP connect()');
        this.imap.connect();
      } catch (error: any) {
        clearTimeout(timeout);
        if (!isResolved) {
          isResolved = true;
          console.error('[DEBUG] Exception during connect():', error.message);
          reject(error);
        }
      }
    });
  }

  async scanEmails(limit: number = 100, since?: Date, sinceUid?: number): Promise<Email[]> {
    return new Promise((resolve, reject) => {
      const emails: Email[] = [];
      const searchCriteria: any[] = sinceUid
        ? [['UID', `${sinceUid + 1}:*`]]
        : since
          ? [['SINCE', since]]
          : ['ALL'];

      console.log('[DEBUG] IMAP primary search criteria:', searchCriteria);

      const fetchResults = (results: any[]) => {
        if (!results || results.length === 0) {
          resolve([]);
          return;
        }

        const idsToFetch = since || limit <= 0 ? results : results.slice(Math.max(0, results.length - limit));
        console.log(`[DEBUG] IMAP search returned ${results.length} results, fetching ${idsToFetch.length} messages`);
        const f = this.imap.fetch(idsToFetch, { bodies: [''] });

        f.on('message', (msg: any, seqno: any) => {
          let messageBuffer = '';
          let attributes: any = null;

          msg.on('body', (stream: any) => {
            stream.on('data', (chunk: Buffer) => {
              messageBuffer += chunk.toString('utf8');
            });
          });

          msg.once('attributes', (attrs: any) => {
            attributes = attrs;
          });

          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(messageBuffer);
              const email: Email = {
                id: `${this.config.email}_${seqno}_${Date.now()}`,
                from: parsed.from?.text || 'Unknown',
                to: parsed.to?.text || this.config.email,
                subject: parsed.subject || '(No Subject)',
                date: parsed.date || new Date(),
                body: parsed.text || parsed.html || '',
                isRead: (attributes?.flags || []).includes('\\Seen'),
                timestamp: Date.now(),
                folder: 'INBOX',
                uid: attributes?.uid,
                messageId: parsed.messageId || undefined,
                sender: this.parseSender(parsed.from?.text || '')
              };

              emails.push(email);
            } catch (error) {
              console.error('Parse error:', error);
            }
          });
        });

        f.once('error', reject);
        f.once('end', () => {
          resolve(emails);
        });
      };

      this.imap.search(searchCriteria, (err: any, results: any) => {
        if (err) {
          reject(new Error(`Search failed: ${err.message}`));
          return;
        }

        if ((!results || results.length === 0) && sinceUid && since) {
          console.log('[DEBUG] UID search returned no results; falling back to SINCE search');
          this.imap.search([['SINCE', since]], (err2: any, fallbackResults: any) => {
            if (err2) {
              reject(new Error(`Fallback search failed: ${err2.message}`));
              return;
            }
            fetchResults(fallbackResults);
          });
          return;
        }

        fetchResults(results);
      });
    });
  }

  private parseSender(fromString: string): { name: string; email: string } {
    const emailMatch = fromString.match(/<(.+?)>/);
    const email = emailMatch ? emailMatch[1] : fromString;
    const name = fromString.replace(/<.+?>/, '').trim() || email;

    return { name, email };
  }

  private formatImapDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
  }

  async loadStoredData(): Promise<EmailStorage> {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        const storage: EmailStorage = JSON.parse(data);
        const shouldMigrateReadState = storage.readStateVersion !== this.readStateVersion;
        if (shouldMigrateReadState) {
          console.warn('[WARN] Migrating stored email read states from legacy inverted format');
        }
        const emails = storage.emails.map(email => ({
          ...email,
          date: new Date(email.date),
          isRead: shouldMigrateReadState ? !email.isRead : email.isRead
        }));
        const lastUid = storage.lastUid ?? emails.reduce((max, email) => Math.max(max, email.uid ?? 0), 0);
        console.log('[DEBUG] Loaded stored lastUid:', lastUid, 'from', storage.lastUid ? 'storage.lastUid' : 'computed emails');

        return {
          lastScan: new Date(storage.lastScan),
          lastUid,
          emails
        };
      }
    } catch (error) {
      console.error('Error loading stored emails:', error);
    }
    return {
      lastScan: new Date(0),
      lastUid: 0,
      emails: []
    };
  }

  async saveEmails(emails: Email[]): Promise<void> {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const lastUid = emails.reduce((max, email) => Math.max(max, email.uid ?? 0), 0);
      console.log('[DEBUG] Saving lastUid:', lastUid);
      const storage: EmailStorage = {
        lastScan: new Date(),
        lastUid,
        readStateVersion: this.readStateVersion,
        emails
      };

      fs.writeFileSync(this.storagePath, JSON.stringify(storage, null, 2));
    } catch (error) {
      console.error('Error saving emails:', error);
    }
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.imap.end();
      this.imap.state === 'closed' ? resolve() : setTimeout(resolve, 500);
    });
  }
}

// Helper function to get email stats
export function getEmailStats(emails: Email[]): Record<string, any> {
  const senderMap = new Map<string, { count: number; unread: number; dates: Date[] }>();

  emails.forEach(email => {
    const sender = email.sender?.email || email.from;
    if (!senderMap.has(sender)) {
      senderMap.set(sender, { count: 0, unread: 0, dates: [] });
    }
    
    const stats = senderMap.get(sender)!;
    stats.count++;
    if (!email.isRead) stats.unread++;
    stats.dates.push(email.date);
  });

  return Object.fromEntries(senderMap);
}
