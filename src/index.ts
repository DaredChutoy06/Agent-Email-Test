import dotenv from 'dotenv';
import path from 'path';

// Load environment variables - try multiple paths
const cwdEnv = path.join(process.cwd(), '.env');
dotenv.config({ path: cwdEnv });

import { EmailScanner } from './emailScanner';
import { EmailAnalysisAgent } from './subAgent';
import { UnsubscribeAgent } from './unsubscribeAgent';
import { promptUnsubscribeSelection, confirmPrompt } from './interactive';
import { printUnsubscribeResult } from './unsubscribe';
import { color, formatDateTime, formatPercent, printKeyValues, printSection, printTable, printTitle } from './terminal';
import { loadConfig, Logger } from './utils';
import { Email, EmailAnalysis, SenderDatabase, SubAgentAnalysis } from './types';
import fs from 'fs';

interface CliOptions {
  scanMoreLimit?: number;
  newScanLimit: number;
}

async function main() {
  try {
    const cliOptions = parseArgs(process.argv.slice(2));
    const config = loadConfig();
    const logger = new Logger(config.logging.level);

    logger.info('Starting iCloud Email Scanner with Sub-Agent Analysis');

    // Initialize email scanner
    const scanner = new EmailScanner(
      {
        email: config.icloud.email,
        password: config.icloud.password
      },
      config.scanning.emailStoragePath
    );

    logger.info('Connecting to iCloud account...', { email: config.icloud.email });
    
    try {
      await scanner.connect();
      logger.info('Connected to iCloud successfully');

      // Load previously stored emails and last scan date
      const storedData = await scanner.loadStoredData();
      logger.info(`Loaded ${storedData.emails.length} previously stored emails`);
      logger.info(`Last scan date: ${storedData.lastScan.toISOString()}`);
      logger.info(`Last stored UID: ${storedData.lastUid}`);

      // Scan only new emails since the last scan using UID tracking
      logger.info('Scanning inbox for new emails...');
      const newEmails = await scanner.scanEmails(cliOptions.newScanLimit, storedData.lastScan, storedData.lastUid);
      logger.info(`Found ${newEmails.length} new emails since last scan`);
      if (newEmails.length > 0) {
        logger.info('New email UIDs:', newEmails.map(email => email.uid));
        logger.info('New email senders:', [...new Set(newEmails.map(email => email.sender?.email || email.from))]);
      }

      // Merge and deduplicate emails, preserving read state
      let allEmails = mergeEmails(storedData.emails, newEmails);

      if (cliOptions.scanMoreLimit) {
        const beforeScanMoreCount = allEmails.length;
        logger.info(`Scanning the most recent ${cliOptions.scanMoreLimit} inbox emails for more history...`);
        const moreEmails = await scanner.scanEmails(cliOptions.scanMoreLimit);
        allEmails = mergeEmails(allEmails, moreEmails);
        logger.info('Additional scan complete', {
          fetched: moreEmails.length,
          addedUnique: allEmails.length - beforeScanMoreCount,
          totalUnique: allEmails.length
        });
      }

      logger.info(`Total unique emails: ${allEmails.length}`);

      // Save combined emails
      await scanner.saveEmails(allEmails);

      // Save sender database for history
      await saveSenderDatabase(allEmails);

      // Close IMAP connection
      await scanner.close();
      logger.info('Closed iCloud connection');

      // Initialize analysis agent
      logger.info('Initializing AI analysis agent...');
      const analysisAgent = new EmailAnalysisAgent(config.anthropic.apiKey);

      // Analyze emails
      logger.info('Analyzing email patterns with AI...');
      const analysis = await analysisAgent.analyzeEmails(allEmails);

      logger.info('Analysis complete', {
        totalEmailsScanned: analysis.totalEmailsScanned,
        totalSendersAnalyzed: analysis.analyses.length,
        recommendedDelete: analysis.recommendedActions.delete.length,
        recommendedUnsubscribe: analysis.recommendedActions.unsubscribe.length,
        recommendedReview: analysis.recommendedActions.review.length,
        recommendedKeep: analysis.recommendedActions.keep.length
      });

      // Display results
      displayResults(analysis);

      // Save analysis report
      saveAnalysisReport(analysis, config);

      // Interactive unsubscribe prompt (TTY only)
      await runInteractiveUnsubscribe(analysis, config.scanning.emailStoragePath);

    } catch (error) {
      logger.error('Error during email scanning', error);
      throw error;
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    newScanLimit: 100
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--scan-more':
      case '--backfill':
        options.scanMoreLimit = parsePositiveInteger(arg, next);
        i++;
        break;
      case '--new-limit':
        options.newScanLimit = parsePositiveInteger(arg, next);
        i++;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function parsePositiveInteger(flag: string, value: string | undefined): number {
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a number`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }

  return parsed;
}

function printUsage(): void {
  console.log(`
Usage:
  npm run dev
  npm run dev -- --scan-more 500
  npm run dev -- --backfill 1000

Options:
  --scan-more <count>  Scan the most recent count inbox emails and merge any new history.
  --backfill <count>   Alias for --scan-more.
  --new-limit <count>  Limit for the normal new-mail scan. Default: 100.
`);
}

function mergeEmails(storedEmails: Email[], newEmails: Email[]) {
  const emailMap = new Map<string, Email>();

  const addEmail = (email: Email) => {
    const key = `${email.from}_${email.subject}_${email.date}`;
    const existing = emailMap.get(key);

    if (!existing) {
      emailMap.set(key, email);
      return;
    }

    // Preserve read state and latest metadata
    const updated: Email = {
      ...existing,
      ...email,
      isRead: email.isRead,
      timestamp: Math.max(existing.timestamp, email.timestamp)
    };
    emailMap.set(key, updated);
  };

  storedEmails.forEach(addEmail);
  newEmails.forEach(addEmail);

  return Array.from(emailMap.values()).sort((a, b) => b.timestamp - a.timestamp);
}

async function saveSenderDatabase(emails: Email[]) {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'senders.json');
    const sendersMap = new Map<string, SenderDatabase['senders'][number]>();

    emails.forEach(email => {
      const senderEmail = email.sender?.email || email.from;
      const senderName = email.sender?.name || senderEmail;
      const existing = sendersMap.get(senderEmail);
      const isUnread = !email.isRead;
      const isRead = email.isRead;

      if (!existing) {
        sendersMap.set(senderEmail, {
          email: senderEmail,
          name: senderName,
          totalEmails: 1,
          unreadCount: isUnread ? 1 : 0,
          readCount: isRead ? 1 : 0,
          firstEmailDate: email.date,
          lastEmailDate: email.date,
          lastSeen: new Date()
        });
        return;
      }

      existing.totalEmails += 1;
      existing.unreadCount += isUnread ? 1 : 0;
      existing.readCount += isRead ? 1 : 0;
      existing.lastEmailDate = email.date > existing.lastEmailDate ? email.date : existing.lastEmailDate;
      existing.firstEmailDate = email.date < existing.firstEmailDate ? email.date : existing.firstEmailDate;
      existing.lastSeen = new Date();
    });

    const db: SenderDatabase = {
      lastUpdated: new Date(),
      senders: Array.from(sendersMap.values())
    };

    const dir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error saving sender database:', error);
  }
}

function displayResults(analysis: SubAgentAnalysis) {
  const deleteCount = analysis.recommendedActions.delete.length;
  const unsubscribeCount = analysis.recommendedActions.unsubscribe.length;
  const reviewCount = analysis.recommendedActions.review.length;
  const keepCount = analysis.recommendedActions.keep.length;

  printTitle(
    'Email Analysis Results',
    'Every stored sender was checked and categorized.'
  );

  printKeyValues([
    { label: 'Emails analyzed', value: analysis.totalEmailsScanned },
    { label: 'Senders analyzed', value: analysis.analyses.length },
    { label: 'Delete', value: deleteCount, color: deleteCount > 0 ? 'red' : 'gray' },
    { label: 'Unsubscribe', value: unsubscribeCount, color: unsubscribeCount > 0 ? 'cyan' : 'gray' },
    { label: 'Review', value: reviewCount, color: reviewCount > 0 ? 'yellow' : 'gray' },
    { label: 'Keep', value: keepCount, color: 'green' },
    { label: 'Timestamp', value: formatDateTime(analysis.timestamp) }
  ]);

  console.log('');
  console.log(color(analysis.summary, 'gray'));

  printRecommendationTable('Recommended For Deletion', getAnalysesForSenders(analysis, analysis.recommendedActions.delete));
  printRecommendationTable('Recommended For Unsubscription', getAnalysesForSenders(analysis, analysis.recommendedActions.unsubscribe));
  printRecommendationTable('Needs Review', getAnalysesForSenders(analysis, analysis.recommendedActions.review));
  printRecommendationTable('Recommended To Keep', getAnalysesForSenders(analysis, analysis.recommendedActions.keep));
}

function printRecommendationTable(title: string, rows: EmailAnalysis[]) {
  printSection(`${title} (${rows.length})`);
  printTable(
    rows,
    [
      { header: 'Sender', width: 32, get: row => row.sender },
      { header: 'Emails', width: 6, get: row => row.totalEmails },
      { header: 'Unread', width: 6, get: row => row.unreadCount },
      { header: 'Read', width: 8, get: row => formatPercent(row.readRate) },
      { header: 'Conf', width: 7, get: row => formatPercent(row.confidence * 100) },
      { header: 'Reason', width: 70, get: row => row.reason }
    ],
    'No senders in this category.'
  );
}

function getAnalysesForSenders(analysis: SubAgentAnalysis, senders: string[]): EmailAnalysis[] {
  return senders
    .map(sender => analysis.analyses.find(item => item.sender === sender))
    .filter((item): item is EmailAnalysis => Boolean(item))
    .sort((a, b) => b.confidence - a.confidence || b.totalEmails - a.totalEmails);
}

function saveAnalysisReport(analysis: any, config: any) {
  try {
    const reportDir = './reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = `${reportDir}/analysis_${timestamp}.json`;

    fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2));
    console.log(`\nAnalysis report saved to: ${reportPath}`);
  } catch (error) {
    console.error('Error saving report:', error);
  }
}

async function runInteractiveUnsubscribe(analysis: SubAgentAnalysis, storagePath: string) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return;

  const unsubscribeSenders = getAnalysesForSenders(analysis, analysis.recommendedActions.unsubscribe);
  const reviewSenders = getAnalysesForSenders(analysis, analysis.recommendedActions.review);

  if (unsubscribeSenders.length === 0 && reviewSenders.length === 0) return;

  const selection = await promptUnsubscribeSelection(unsubscribeSenders, reviewSenders);

  if (selection.cancelled || selection.senders.length === 0) {
    console.log(color('\nSkipping unsubscription.', 'gray'));
    return;
  }

  const agent = new UnsubscribeAgent();

  // Dry run first so user can see what will happen
  const dryResult = await agent.run({
    storagePath,
    execute: false,
    logDryRun: false,
    selectedSenders: selection.senders
  });

  printUnsubscribeResult(dryResult);

  const executableCount = dryResult.results.filter(r => r.status === 'dry_run').length;
  if (executableCount === 0) {
    console.log(color('\nNo one-click unsubscriptions available. Manual review needed for the rest.', 'yellow'));
    return;
  }

  const confirmed = await confirmPrompt(
    `Execute ${executableCount} one-click unsubscription${executableCount !== 1 ? 's' : ''}?`
  );

  if (!confirmed) return;

  const liveResult = await agent.run({
    storagePath,
    logPath: './data/unsubscribe-log.json',
    execute: true,
    logDryRun: true,
    selectedSenders: selection.senders
  });

  printUnsubscribeResult(liveResult);
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
