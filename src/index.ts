import dotenv from 'dotenv';
import path from 'path';

// Load environment variables - try multiple paths
const cwdEnv = path.join(process.cwd(), '.env');
dotenv.config({ path: cwdEnv });

import { EmailScanner } from './emailScanner';
import { EmailAnalysisAgent } from './subAgent';
import { loadConfig, Logger } from './utils';
import { Email, SenderDatabase } from './types';
import fs from 'fs';

async function main() {
  try {
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
      const newEmails = await scanner.scanEmails(100, storedData.lastScan, storedData.lastUid);
      logger.info(`Found ${newEmails.length} new emails since last scan`);
      if (newEmails.length > 0) {
        logger.info('New email UIDs:', newEmails.map(email => email.uid));
        logger.info('New email senders:', [...new Set(newEmails.map(email => email.sender?.email || email.from))]);
      }

      // Merge and deduplicate emails, preserving read state
      const allEmails = mergeEmails(storedData.emails, newEmails);
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
      displayResults(analysis, logger);

      // Save analysis report
      saveAnalysisReport(analysis, config);

    } catch (error) {
      logger.error('Error during email scanning', error);
      throw error;
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
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

function displayResults(analysis: any, logger: Logger) {
  logger.info('='.repeat(60));
  logger.info('EMAIL ANALYSIS RESULTS');
  logger.info('='.repeat(60));

  logger.info(`\nTotal Emails Analyzed: ${analysis.totalEmailsScanned}`);
  logger.info(`Total Senders Analyzed: ${analysis.analyses.length}`);
  logger.info(`Analysis Timestamp: ${analysis.timestamp}`);
  logger.info(`\n${analysis.summary}`);

  logger.info('\n--- RECOMMENDED FOR DELETION ---');
  if (analysis.recommendedActions.delete.length > 0) {
    analysis.recommendedActions.delete.forEach((sender: string) => {
      const detail = analysis.analyses.find((a: any) => a.sender === sender);
      logger.info(`  • ${sender} (Confidence: ${(detail?.confidence * 100).toFixed(1)}%)`);
      logger.info(`    Reason: ${detail?.reason}`);
    });
  } else {
    logger.info('  None');
  }

  logger.info('\n--- RECOMMENDED FOR UNSUBSCRIPTION ---');
  if (analysis.recommendedActions.unsubscribe.length > 0) {
    analysis.recommendedActions.unsubscribe.forEach((sender: string) => {
      const detail = analysis.analyses.find((a: any) => a.sender === sender);
      logger.info(`  • ${sender} (Confidence: ${(detail?.confidence * 100).toFixed(1)}%)`);
      logger.info(`    Reason: ${detail?.reason}`);
    });
  } else {
    logger.info('  None');
  }

  logger.info('\n--- RECOMMENDED FOR REVIEW ---');
  if (analysis.recommendedActions.review.length > 0) {
    analysis.recommendedActions.review.forEach((sender: string) => {
      const detail = analysis.analyses.find((a: any) => a.sender === sender);
      logger.info(`  • ${sender} (Confidence: ${(detail?.confidence * 100).toFixed(1)}%)`);
      logger.info(`    Reason: ${detail?.reason}`);
    });
  } else {
    logger.info('  None');
  }

  logger.info('\n--- RECOMMENDED TO KEEP ---');
  if (analysis.recommendedActions.keep.length > 0) {
    analysis.recommendedActions.keep.forEach((sender: string) => {
      const detail = analysis.analyses.find((a: any) => a.sender === sender);
      logger.info(`  • ${sender} (Confidence: ${(detail?.confidence * 100).toFixed(1)}%)`);
      logger.info(`    Reason: ${detail?.reason}`);
    });
  } else {
    logger.info('  None');
  }

  logger.info('\n' + '='.repeat(60));
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

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
