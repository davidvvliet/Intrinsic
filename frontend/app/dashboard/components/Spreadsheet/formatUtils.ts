import type { NumberFormatSettings, NumberFormatType } from './types';

// Default settings for each format type
export const FORMAT_DEFAULTS: Record<NumberFormatType, Partial<NumberFormatSettings>> = {
  automatic: {},
  text: {},
  number: { decimals: 2 },
  percent: { decimals: 2 },
  scientific: { decimals: 2 },
  accounting: { decimals: 2, currencySymbol: '$' },
  financial: { decimals: 2 },
  currency: { decimals: 2, currencySymbol: '$' },
  currencyRounded: { decimals: 0, currencySymbol: '$' },
  date: { datePattern: 'dd/mm/yyyy' },
  time: { datePattern: 'hh:mm:ss' },
  datetime: { datePattern: 'dd/mm/yyyy hh:mm:ss' },
  duration: {},
};

// Format labels for UI
export const FORMAT_LABELS: Record<NumberFormatType, string> = {
  automatic: 'Automatic',
  text: 'Plain text',
  number: 'Number',
  percent: 'Percent',
  scientific: 'Scientific',
  accounting: 'Accounting',
  financial: 'Financial',
  currency: 'Currency',
  currencyRounded: 'Currency rounded',
  date: 'Date',
  time: 'Time',
  datetime: 'Date time',
  duration: 'Duration',
};

// Format examples for UI
export const FORMAT_EXAMPLES: Record<NumberFormatType, string> = {
  automatic: '',
  text: '',
  number: '1,000.12',
  percent: '10.12%',
  scientific: '1.01E+03',
  accounting: '$ (1,000.12)',
  financial: '(1,000.12)',
  currency: '$1,000.12',
  currencyRounded: '$1,000',
  date: '04/07/1776',
  time: '15:14:00',
  datetime: '04/07/1776 15:14:00',
  duration: '24:01:00',
};

// Check if a string can be parsed as a number
function isNumericString(value: string): boolean {
  if (!value || value.trim() === '') return false;
  const num = Number(value.replace(/,/g, ''));
  return !isNaN(num) && isFinite(num);
}

// Parse a value to a number, handling common formats
function parseNumber(value: string): number | null {
  if (!value || value.trim() === '') return null;
  
  // Remove commas and trim
  let cleaned = value.replace(/,/g, '').trim();
  
  // Handle percentages (convert to decimal)
  if (cleaned.endsWith('%')) {
    const num = Number(cleaned.slice(0, -1));
    return isNaN(num) ? null : num / 100;
  }
  
  // Handle currency symbols
  cleaned = cleaned.replace(/^[£$€¥]/g, '').trim();
  
  // Handle parentheses for negative numbers
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }
  
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

// Format number with thousand separators
function formatWithCommas(num: number, decimals: number): string {
  const parts = num.toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

// Format as number (1,000.12)
export function formatNumber(value: string, decimals: number = 2): string {
  const num = parseNumber(value);
  if (num === null) return value;
  return formatWithCommas(num, decimals);
}

// Format as percent (10.12%)
export function formatPercent(value: string, decimals: number = 2): string {
  const num = parseNumber(value);
  if (num === null) return value;
  return formatWithCommas(num * 100, decimals) + '%';
}

// Format as scientific notation (1.01E+03)
export function formatScientific(value: string, decimals: number = 2): string {
  const num = parseNumber(value);
  if (num === null) return value;
  return num.toExponential(decimals).toUpperCase();
}

// Format as accounting ($ (1,000.12) for negative, $ 1,000.12 for positive)
export function formatAccounting(value: string, decimals: number = 2, symbol: string = '$'): string {
  const num = parseNumber(value);
  if (num === null) return value;
  if (num < 0) {
    return `${symbol} (${formatWithCommas(Math.abs(num), decimals)})`;
  }
  return `${symbol} ${formatWithCommas(num, decimals)}`;
}

// Format as financial ((1,000.12) for negative)
export function formatFinancial(value: string, decimals: number = 2): string {
  const num = parseNumber(value);
  if (num === null) return value;
  if (num < 0) {
    return `(${formatWithCommas(Math.abs(num), decimals)})`;
  }
  return formatWithCommas(num, decimals);
}

// Format as currency ($1,000.12)
export function formatCurrency(value: string, decimals: number = 2, symbol: string = '$'): string {
  const num = parseNumber(value);
  if (num === null) return value;
  if (num < 0) {
    return `-${symbol}${formatWithCommas(Math.abs(num), decimals)}`;
  }
  return `${symbol}${formatWithCommas(num, decimals)}`;
}

// Format as currency rounded ($1,000)
export function formatCurrencyRounded(value: string, symbol: string = '$'): string {
  const num = parseNumber(value);
  if (num === null) return value;
  const rounded = Math.round(num);
  if (rounded < 0) {
    return `-${symbol}${formatWithCommas(Math.abs(rounded), 0)}`;
  }
  return `${symbol}${formatWithCommas(rounded, 0)}`;
}

// Parse Excel-style date serial number or date string
function parseDate(value: string): Date | null {
  const num = parseNumber(value);
  if (num !== null) {
    // Excel serial date (days since 1899-12-30)
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
    return date;
  }
  
  // Try parsing as date string
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

// Format as date (26/09/2008)
export function formatDate(value: string): string {
  const date = parseDate(value);
  if (!date) return value;
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

// Format as time (15:59:00)
export function formatTime(value: string): string {
  const date = parseDate(value);
  if (!date) return value;
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
}

// Format as datetime (26/09/2008 15:59:00)
export function formatDatetime(value: string): string {
  const date = parseDate(value);
  if (!date) return value;
  
  return `${formatDate(value)} ${formatTime(value)}`;
}

// Format as duration (24:01:00) - value is in hours or seconds
export function formatDuration(value: string): string {
  const num = parseNumber(value);
  if (num === null) return value;
  
  // Assume value is in hours
  const totalSeconds = Math.abs(num) * 3600;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Main format function that applies the appropriate format
export function applyFormat(value: string, format: NumberFormatSettings | undefined): string {
  if (!format || format.type === 'automatic' || format.type === 'text') {
    return value;
  }
  
  const decimals = format.decimals ?? FORMAT_DEFAULTS[format.type].decimals ?? 2;
  const symbol = format.currencySymbol ?? FORMAT_DEFAULTS[format.type].currencySymbol ?? '$';
  
  switch (format.type) {
    case 'number':
      return formatNumber(value, decimals);
    case 'percent':
      return formatPercent(value, decimals);
    case 'scientific':
      return formatScientific(value, decimals);
    case 'accounting':
      return formatAccounting(value, decimals, symbol);
    case 'financial':
      return formatFinancial(value, decimals);
    case 'currency':
      return formatCurrency(value, decimals, symbol);
    case 'currencyRounded':
      return formatCurrencyRounded(value, symbol);
    case 'date':
      return formatDate(value);
    case 'time':
      return formatTime(value);
    case 'datetime':
      return formatDatetime(value);
    case 'duration':
      return formatDuration(value);
    default:
      return value;
  }
}

// Check if value should be right-aligned based on format
export function shouldRightAlign(value: string, format: NumberFormatSettings | undefined): boolean {
  if (!format || format.type === 'text') {
    // For automatic/no format, check if value is numeric
    return isNumericString(value);
  }
  
  // All number formats should be right-aligned
  return true;
}
