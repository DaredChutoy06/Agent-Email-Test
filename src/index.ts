import dotenv from 'dotenv';
import path from 'path';

// Load environment variables - try multiple paths
const cwdEnv = path.join(process.cwd(), '.env');
dotenv.config({ path: cwdEnv });

import { EmailScanner } from './emailScanner';
import { EmailAnalysisAgent } from './subAgent';
import { loadConfig, Logger } from './utils';
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

      // Scan recent emails
      logger.info('Scanning emails from INBOX...');
      const newEmails = await scanner.scanEmails(100);
      logger.info(`Found ${newEmails.length} recent emails`);

      // Load previously stored emails
      const storedEmails = await scanner.loadStoredEmails();
      logger.info(`Loaded ${storedEmails.length} previously stored emails`);

      // Combine and deduplicate emails
      const allEmails = deduplicateEmails([...storedEmails, ...newEmails]);
      logger.info(`Total unique emails: ${allEmails.length}`);

      // Save combined emails
      await scanner.saveEmails(allEmails);

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
        recommendedDelete: analysis.recommendedActions.delete.length,
        recommendedUnsubscribe: analysis.recommendedActions.unsubscribe.length,
        recommendedReview: analysis.recommendedActions.review.length
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

function deduplicateEmails(emails: any[]) {
  const seen = new Set<string>();
  return emails.filter(email => {
    const key = `${email.from}_${email.subject}_${email.date}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function displayResults(analysis: any, logger: Logger) {
  logger.info('='.repeat(60));
  logger.info('EMAIL ANALYSIS RESULTS');
  logger.info('='.repeat(60));

  logger.info(`\nTotal Emails Analyzed: ${analysis.totalEmailsScanned}`);
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
    analysis.recommendedActions.review.slice(0, 5).forEach((sender: string) => {
      const detail = analysis.analyses.find((a: any) => a.sender === sender);
      logger.info(`  • ${sender} (Confidence: ${(detail?.confidence * 100).toFixed(1)}%)`);
      logger.info(`    Reason: ${detail?.reason}`);
    });
    if (analysis.recommendedActions.review.length > 5) {
      logger.info(`  ... and ${analysis.recommendedActions.review.length - 5} more`);
    }
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
