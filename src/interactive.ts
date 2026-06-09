import { color } from './terminal';
import { EmailAnalysis } from './types';

export interface InteractiveSelection {
  senders: string[];
  cancelled: boolean;
}

interface SelectItem {
  analysis: EmailAnalysis;
  checked: boolean;
  category: 'unsubscribe' | 'review';
}

export async function promptUnsubscribeSelection(
  unsubscribeList: EmailAnalysis[],
  reviewList: EmailAnalysis[]
): Promise<InteractiveSelection> {
  const items: SelectItem[] = [
    ...unsubscribeList.map(a => ({ analysis: a, checked: true, category: 'unsubscribe' as const })),
    ...reviewList.map(a => ({ analysis: a, checked: false, category: 'review' as const }))
  ];

  if (items.length === 0) {
    return { senders: [], cancelled: false };
  }

  const termRows = process.stdout.rows || 24;
  const viewportSize = Math.max(5, Math.min(termRows - 9, 20, items.length));

  return new Promise(resolve => {
    let cursor = 0;
    let scrollOffset = 0;
    let lineCount = 0;

    function adjustScroll() {
      if (cursor < scrollOffset) scrollOffset = cursor;
      if (cursor >= scrollOffset + viewportSize) scrollOffset = cursor - viewportSize + 1;
    }

    function renderItem(item: SelectItem, index: number): string {
      const isCursor = index === cursor;
      const checkbox = item.checked ? color('[x]', 'cyan') : color('[ ]', 'gray');
      const marker = isCursor ? color('>', 'bold') : ' ';
      const senderRaw = item.analysis.sender;
      const sender = senderRaw.length > 38 ? senderRaw.slice(0, 37) + '~' : senderRaw.padEnd(38);
      const emails = String(item.analysis.totalEmails).padStart(3);
      const read = item.analysis.readRate.toFixed(0).padStart(3);
      const meta = color(`${emails} emails  ${read}% read`, 'dim');
      const cat = item.category === 'unsubscribe'
        ? color('unsubscribe', 'cyan')
        : color('review', 'yellow');

      const line = `${marker} ${checkbox} ${sender}  ${meta}  ${cat}`;
      return isCursor ? color(line, 'bold') : line;
    }

    function render(initial = false) {
      const visibleItems = items.slice(scrollOffset, scrollOffset + viewportSize);
      const hasScrollAbove = scrollOffset > 0;
      const hasScrollBelow = scrollOffset + viewportSize < items.length;
      const selectedCount = items.filter(i => i.checked).length;

      const lines: string[] = [
        '',
        color('  Select senders to unsubscribe from:', 'bold'),
        color('  ↑/↓ navigate   Space toggle   a select all   n none   Enter confirm   q skip', 'gray'),
        color('  ' + '─'.repeat(76), 'gray'),
        ...(hasScrollAbove ? [color('  ↑ more above', 'dim')] : []),
        ...visibleItems.map((item, i) => '  ' + renderItem(item, scrollOffset + i)),
        ...(hasScrollBelow ? [color('  ↓ more below', 'dim')] : []),
        '',
        color(`  ${selectedCount} of ${items.length} selected`, 'dim')
      ];

      if (!initial && lineCount > 0) {
        process.stdout.write(`\x1B[${lineCount}A`);
      }

      process.stdout.write('\x1B[?25l');
      for (const line of lines) {
        process.stdout.write(`\r\x1B[K${line}\n`);
      }

      lineCount = lines.length;
    }

    function cleanup() {
      process.stdout.write('\x1B[?25h');
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
    }

    render(true);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    function onData(key: string) {
      switch (key) {
        case '\x03': // Ctrl+C
        case 'q':
        case 'Q':
          cleanup();
          process.stdout.write('\n');
          resolve({ senders: [], cancelled: true });
          break;

        case '\r':
        case '\n': {
          cleanup();
          process.stdout.write('\n');
          const selected = items.filter(i => i.checked).map(i => i.analysis.sender);
          resolve({ senders: selected, cancelled: false });
          break;
        }

        case '\x1B[A': // Up arrow
          cursor = Math.max(0, cursor - 1);
          adjustScroll();
          render();
          break;

        case '\x1B[B': // Down arrow
          cursor = Math.min(items.length - 1, cursor + 1);
          adjustScroll();
          render();
          break;

        case ' ':
          items[cursor].checked = !items[cursor].checked;
          render();
          break;

        case 'a':
        case 'A':
          items.forEach(item => { item.checked = true; });
          render();
          break;

        case 'n':
        case 'N':
          items.forEach(item => { item.checked = false; });
          render();
          break;
      }
    }

    process.stdin.on('data', onData);
  });
}

export async function confirmPrompt(message: string): Promise<boolean> {
  return new Promise(resolve => {
    process.stdout.write(`\n${color(message, 'bold')} ${color('[y/N]', 'gray')} `);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    function onData(key: string) {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();

      if (key === 'y' || key === 'Y') {
        process.stdout.write(color('yes\n', 'green'));
        resolve(true);
      } else {
        process.stdout.write(color('no\n', 'gray'));
        resolve(false);
      }
    }

    process.stdin.on('data', onData);
  });
}
