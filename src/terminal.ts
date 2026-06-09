type ColorName = 'gray' | 'red' | 'green' | 'yellow' | 'blue' | 'cyan' | 'bold' | 'dim';

interface TableColumn<T> {
  header: string;
  width?: number;
  get: (row: T) => string | number | undefined;
}

interface KeyValueItem {
  label: string;
  value: string | number;
  color?: ColorName;
}

const colorCodes: Record<ColorName, [number, number]> = {
  gray: [90, 39],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  cyan: [36, 39],
  bold: [1, 22],
  dim: [2, 22]
};

const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

export function color(text: string, colorName: ColorName): string {
  if (!useColor) return text;
  const [open, close] = colorCodes[colorName];
  return `\u001b[${open}m${text}\u001b[${close}m`;
}

export function printTitle(title: string, subtitle?: string): void {
  const width = Math.max(72, visibleLength(title) + 4);
  console.log('');
  console.log(color('='.repeat(width), 'cyan'));
  console.log(color(title.toUpperCase(), 'bold'));
  if (subtitle) {
    console.log(color(subtitle, 'gray'));
  }
  console.log(color('='.repeat(width), 'cyan'));
}

export function printSection(title: string): void {
  console.log('');
  console.log(color(title, 'bold'));
  console.log(color('-'.repeat(Math.max(20, visibleLength(title))), 'gray'));
}

export function printKeyValues(items: KeyValueItem[], columns = 2): void {
  const labelWidth = Math.max(...items.map(item => visibleLength(item.label)), 8);
  const rows: string[] = [];

  items.forEach(item => {
    const value = String(item.value);
    const formattedValue = item.color ? color(value, item.color) : value;
    rows.push(`${padRight(item.label, labelWidth)} : ${formattedValue}`);
  });

  const columnWidth = Math.max(...rows.map(row => visibleLength(row)), 24) + 4;
  for (let i = 0; i < rows.length; i += columns) {
    console.log(
      rows
        .slice(i, i + columns)
        .map(row => padRight(row, columnWidth))
        .join('')
        .trimEnd()
    );
  }
}

export function printTable<T>(rows: T[], columns: TableColumn<T>[], emptyMessage = 'None'): void {
  if (rows.length === 0) {
    console.log(color(emptyMessage, 'gray'));
    return;
  }

  const widths = columns.map(column => {
    const contentWidth = Math.max(
      visibleLength(column.header),
      ...rows.map(row => visibleLength(toCell(column.get(row))))
    );
    return Math.min(column.width || contentWidth, contentWidth);
  });

  const header = columns
    .map((column, index) => padRight(truncate(column.header, widths[index]), widths[index]))
    .join('  ');
  console.log(color(header, 'bold'));
  console.log(color(widths.map(width => '-'.repeat(width)).join('  '), 'gray'));

  rows.forEach(row => {
    console.log(
      columns
        .map((column, index) => padRight(truncate(toCell(column.get(row)), widths[index]), widths[index]))
        .join('  ')
    );
  });
}

export function truncate(value: string, width: number): string {
  if (visibleLength(value) <= width) return value;
  if (width <= 1) return value.slice(0, width);
  return `${value.slice(0, width - 1)}~`;
}

export function formatPercent(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'n/a';
  return `${value.toFixed(1)}%`;
}

export function formatDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export function statusColor(status: string): ColorName {
  switch (status) {
    case 'success':
    case 'keep':
      return 'green';
    case 'dry_run':
    case 'review':
    case 'needs_review':
      return 'yellow';
    case 'delete':
    case 'failed':
      return 'red';
    case 'unsubscribe':
      return 'cyan';
    case 'blocked':
      return 'blue';
    default:
      return 'gray';
  }
}

function toCell(value: string | number | undefined): string {
  if (value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function padRight(value: string, width: number): string {
  const length = visibleLength(value);
  if (length >= width) return value;
  return `${value}${' '.repeat(width - length)}`;
}

function visibleLength(value: string): number {
  return value.replace(/\u001b\[[0-9;]*m/g, '').length;
}
