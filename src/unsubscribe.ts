import dotenv from 'dotenv';
import path from 'path';
import { color, printKeyValues, printSection, printTable, printTitle, statusColor } from './terminal';
import {
  loadUnsubscribeSelection,
  mergeSelections,
  UnsubscribeAgent,
  UnsubscribeRunResult,
  UnsubscribeResult,
  UnsubscribeSelection
} from './unsubscribeAgent';

dotenv.config({ path: path.join(process.cwd(), '.env') });

interface CliOptions {
  selectedPath?: string;
  storagePath: string;
  logPath: string;
  execute: boolean;
  forceProtected: boolean;
  allowBodyLinks: boolean;
  logDryRun: boolean;
  json: boolean;
  selection: UnsubscribeSelection;
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const fileSelection = options.selectedPath
      ? loadUnsubscribeSelection(options.selectedPath)
      : undefined;
    const selection = mergeSelections(fileSelection, options.selection);
    const selectedSenders = [
      ...(selection.unsubscribe || []),
      ...(selection.senders || []),
      ...(selection.senderEmails || [])
    ];

    const agent = new UnsubscribeAgent();
    const result = await agent.run({
      storagePath: options.storagePath,
      logPath: options.logPath,
      execute: options.execute,
      forceProtected: options.forceProtected,
      allowBodyLinks: options.allowBodyLinks,
      logDryRun: options.logDryRun,
      selectedSenders,
      selectedMessageIds: selection.messageIds || [],
      selectedEmailIds: selection.emailIds || []
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    printResult(result);
  } catch (error: any) {
    console.error(`[ERROR] ${error?.message || error}`);
    printUsage();
    process.exit(1);
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    storagePath: process.env.EMAIL_STORAGE_PATH || './data/emails.json',
    logPath: './data/unsubscribe-log.json',
    execute: false,
    forceProtected: false,
    allowBodyLinks: false,
    logDryRun: false,
    json: false,
    selection: {
      senders: [],
      messageIds: [],
      emailIds: []
    }
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--selected':
        options.selectedPath = requireValue(arg, next);
        i++;
        break;
      case '--sender':
        options.selection.senders?.push(requireValue(arg, next));
        i++;
        break;
      case '--message-id':
        options.selection.messageIds?.push(requireValue(arg, next));
        i++;
        break;
      case '--email-id':
        options.selection.emailIds?.push(requireValue(arg, next));
        i++;
        break;
      case '--storage':
        options.storagePath = requireValue(arg, next);
        i++;
        break;
      case '--log':
        options.logPath = requireValue(arg, next);
        i++;
        break;
      case '--execute':
        options.execute = true;
        break;
      case '--dry-run':
        options.execute = false;
        break;
      case '--force-protected':
        options.forceProtected = true;
        break;
      case '--allow-body-links':
        options.allowBodyLinks = true;
        break;
      case '--log-dry-run':
        options.logDryRun = true;
        break;
      case '--json':
        options.json = true;
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

function requireValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printResult(result: UnsubscribeRunResult): void {
  const counts = countStatuses(result.results);

  printTitle(
    result.dryRun ? 'Unsubscribe Dry Run' : 'Unsubscribe Execution',
    result.dryRun
      ? 'No subscriptions were changed. Review the plan below before using --execute.'
      : 'Execution finished. See statuses below.'
  );

  printKeyValues([
    { label: 'Selected', value: result.totalSelectedSenders },
    { label: 'Safe to execute', value: counts.dry_run || 0, color: 'cyan' },
    { label: 'Succeeded', value: counts.success || 0, color: 'green' },
    { label: 'Needs review', value: counts.needs_review || 0, color: 'yellow' },
    { label: 'Blocked', value: counts.blocked || 0, color: 'blue' },
    { label: 'Failed', value: counts.failed || 0, color: 'red' }
  ]);

  printSection('Results');
  printTable(
    result.results,
    [
      { header: 'Status', width: 16, get: row => color(formatStatus(row.status), statusColor(row.status)) },
      { header: 'Sender', width: 34, get: row => row.sender },
      { header: 'Emails', width: 6, get: row => row.emailCount },
      { header: 'Strategy', width: 16, get: row => row.strategy },
      { header: 'Target', width: 42, get: row => row.target || '' },
      { header: 'Reason', width: 68, get: row => row.reason }
    ],
    'No matching senders found.'
  );

  if (result.dryRun && counts.dry_run > 0) {
    console.log('');
    console.log(color('Run again with --execute to perform only the one-click rows marked SAFE TO EXECUTE.', 'gray'));
  }
}

function countStatuses(results: UnsubscribeResult[]): Record<UnsubscribeResult['status'], number> {
  return results.reduce((counts, result) => {
    counts[result.status] += 1;
    return counts;
  }, {
    dry_run: 0,
    success: 0,
    needs_review: 0,
    blocked: 0,
    failed: 0
  });
}

function formatStatus(status: UnsubscribeResult['status']): string {
  switch (status) {
    case 'dry_run':
      return 'safe to execute';
    case 'needs_review':
      return 'needs review';
    default:
      return status;
  }
}

function printUsage(): void {
  console.log(`
Usage:
  npm run unsubscribe -- --selected selected-unsubscribe.json
  npm run unsubscribe -- --sender newsletter@example.com
  npm run unsubscribe -- --selected selected-unsubscribe.json --execute

Selection file examples:
  ["newsletter@example.com", "marketing@example.com"]

  {
    "unsubscribe": ["newsletter@example.com"],
    "messageIds": ["<message-id@example.com>"],
    "emailIds": ["stored-email-id"]
  }

Safe defaults:
  Dry-run mode is the default.
  Only RFC one-click List-Unsubscribe URLs are executed with --execute.
  Body links and protected senders require explicit flags.
`);
}

main();
