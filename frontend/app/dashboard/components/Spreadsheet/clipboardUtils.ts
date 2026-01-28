import type { CellData, CellFormat, CellFormatData, NumberFormatSettings } from './types';
import { getCellKey, determineCellType } from './drawUtils';

export type CopyRange = {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
};

/**
 * Build TSV string from cell data
 */
export function buildTSV(
  cellData: CellData,
  range: CopyRange
): string {
  const rows: string[] = [];
  for (let r = range.minRow; r <= range.maxRow; r++) {
    const cols: string[] = [];
    for (let c = range.minCol; c <= range.maxCol; c++) {
      cols.push(cellData.get(getCellKey(r, c))?.raw || '');
    }
    rows.push(cols.join('\t'));
  }
  return rows.join('\n');
}

/**
 * Convert CellFormat to inline CSS string
 */
export function formatToInlineStyle(format: CellFormat): string {
  const styles: string[] = [];
  if (format.bold) styles.push('font-weight: bold');
  if (format.italic) styles.push('font-style: italic');
  if (format.strikethrough) styles.push('text-decoration: line-through');
  if (format.textColor) styles.push(`color: ${format.textColor}`);
  if (format.fillColor) styles.push(`background-color: ${format.fillColor}`);
  return styles.join('; ');
}

/**
 * Build HTML table from cell data and formats
 */
export function buildHTML(
  cellData: CellData,
  cellFormat: CellFormatData,
  range: CopyRange
): string {
  let html = '<table>';
  for (let r = range.minRow; r <= range.maxRow; r++) {
    html += '<tr>';
    for (let c = range.minCol; c <= range.maxCol; c++) {
      const key = getCellKey(r, c);
      const value = cellData.get(key)?.raw || '';
      const format = cellFormat.get(key);
      const style = format ? formatToInlineStyle(format) : '';
      const styleAttr = style ? ` style="${style}"` : '';
      
      // Add data attributes for number format
      const dataAttrs: string[] = [];
      if (format?.numberFormat) {
        dataAttrs.push(`data-number-format-type="${format.numberFormat.type}"`);
        if (format.numberFormat.decimals !== undefined) {
          dataAttrs.push(`data-number-format-decimals="${format.numberFormat.decimals}"`);
        }
        if (format.numberFormat.currencySymbol) {
          dataAttrs.push(`data-number-format-currency-symbol="${format.numberFormat.currencySymbol}"`);
        }
        if (format.numberFormat.datePattern) {
          dataAttrs.push(`data-number-format-date-pattern="${format.numberFormat.datePattern}"`);
        }
      }
      const dataAttr = dataAttrs.length > 0 ? ` ${dataAttrs.join(' ')}` : '';
      
      // Escape HTML entities in value
      const escapedValue = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      html += `<td${styleAttr}${dataAttr}>${escapedValue}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  return html;
}

/**
 * Parse TSV string to 2D array
 */
export function parseTSV(text: string): string[][] {
  return text.split('\n').map(line => line.split('\t'));
}

/**
 * Parse inline CSS style to CellFormat
 */
export function parseInlineStyle(style: string): CellFormat {
  const format: CellFormat = {};
  const declarations = style.split(';').map(d => d.trim()).filter(Boolean);
  
  for (const decl of declarations) {
    const [prop, value] = decl.split(':').map(s => s.trim());
    switch (prop) {
      case 'font-weight':
        if (value === 'bold' || value === '700') format.bold = true;
        break;
      case 'font-style':
        if (value === 'italic') format.italic = true;
        break;
      case 'text-decoration':
        if (value.includes('line-through')) format.strikethrough = true;
        break;
      case 'color':
        format.textColor = value;
        break;
      case 'background-color':
      case 'background':
        // Only use if it looks like a color (not gradient, etc.)
        if (value.startsWith('#') || value.startsWith('rgb')) {
          format.fillColor = value;
        }
        break;
    }
  }
  return format;
}

/**
 * Parse number format from data attributes
 */
function parseNumberFormat(cell: HTMLElement): NumberFormatSettings | undefined {
  const type = cell.getAttribute('data-number-format-type');
  if (!type) return undefined;
  
  const format: NumberFormatSettings = { type: type as any };
  
  const decimals = cell.getAttribute('data-number-format-decimals');
  if (decimals !== null) {
    const dec = parseInt(decimals, 10);
    if (!isNaN(dec)) format.decimals = dec;
  }
  
  const currencySymbol = cell.getAttribute('data-number-format-currency-symbol');
  if (currencySymbol !== null) {
    format.currencySymbol = currencySymbol;
  }
  
  const datePattern = cell.getAttribute('data-number-format-date-pattern');
  if (datePattern !== null) {
    format.datePattern = datePattern;
  }
  
  return format;
}

/**
 * Parse HTML table to values and formats
 */
export function parseHTML(html: string): { values: string[][], formats: CellFormat[][] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  
  if (!table) {
    // No table found, return empty
    return { values: [], formats: [] };
  }
  
  const values: string[][] = [];
  const formats: CellFormat[][] = [];
  
  const rows = table.querySelectorAll('tr');
  rows.forEach(row => {
    const rowValues: string[] = [];
    const rowFormats: CellFormat[] = [];
    
    const cells = row.querySelectorAll('td, th');
    cells.forEach(cell => {
      rowValues.push(cell.textContent || '');
      const style = (cell as HTMLElement).getAttribute('style') || '';
      const format = parseInlineStyle(style);
      
      // Parse number format from data attributes
      const numberFormat = parseNumberFormat(cell as HTMLElement);
      if (numberFormat) {
        format.numberFormat = numberFormat;
      }
      
      rowFormats.push(format);
    });
    
    values.push(rowValues);
    formats.push(rowFormats);
  });
  
  return { values, formats };
}

/**
 * Write to clipboard with both TSV and HTML formats
 */
export async function writeToClipboard(
  cellData: CellData,
  cellFormat: CellFormatData,
  range: CopyRange
): Promise<void> {
  const tsv = buildTSV(cellData, range);
  const html = buildHTML(cellData, cellFormat, range);
  
  try {
    const clipboardItem = new ClipboardItem({
      'text/plain': new Blob([tsv], { type: 'text/plain' }),
      'text/html': new Blob([html], { type: 'text/html' }),
    });
    await navigator.clipboard.write([clipboardItem]);
  } catch {
    // Fallback to text-only if ClipboardItem not supported
    await navigator.clipboard.writeText(tsv);
  }
}

/**
 * Read from clipboard, trying HTML first then falling back to TSV
 */
export async function readFromClipboard(): Promise<{ values: string[][], formats: CellFormat[][] | null }> {
  try {
    const clipboardItems = await navigator.clipboard.read();
    
    for (const item of clipboardItems) {
      // Try HTML first
      if (item.types.includes('text/html')) {
        const htmlBlob = await item.getType('text/html');
        const html = await htmlBlob.text();
        const parsed = parseHTML(html);
        if (parsed.values.length > 0) {
          return parsed;
        }
      }
      
      // Fall back to plain text
      if (item.types.includes('text/plain')) {
        const textBlob = await item.getType('text/plain');
        const text = await textBlob.text();
        return { values: parseTSV(text), formats: null };
      }
    }
  } catch {
    // Fallback to readText if read() not supported or permission denied
    const text = await navigator.clipboard.readText();
    return { values: parseTSV(text), formats: null };
  }
  
  return { values: [], formats: null };
}

/**
 * Apply pasted values and formats to cell data
 */
export function applyPaste(
  values: string[][],
  formats: CellFormat[][] | null,
  anchorRow: number,
  anchorCol: number,
  maxRows: number,
  maxCols: number,
  cellData: CellData,
  cellFormat: CellFormatData
): { newCellData: CellData; newCellFormat: CellFormatData } {
  const newCellData = new Map(cellData);
  const newCellFormat = new Map(cellFormat);
  
  values.forEach((rowValues, rowOffset) => {
    rowValues.forEach((value, colOffset) => {
      const newRow = anchorRow + rowOffset;
      const newCol = anchorCol + colOffset;
      
      if (newRow < maxRows && newCol < maxCols) {
        const key = getCellKey(newRow, newCol);
        
        // Set value
        if (value.trim()) {
          newCellData.set(key, {
            raw: value,
            type: determineCellType(value),
          });
        } else {
          newCellData.delete(key);
        }
        
        // Set format if available
        if (formats && formats[rowOffset] && formats[rowOffset][colOffset]) {
          const format = formats[rowOffset][colOffset];
          // Only set if format has any properties
          if (Object.keys(format).length > 0) {
            newCellFormat.set(key, { ...newCellFormat.get(key), ...format });
          }
        }
      }
    });
  });
  
  return { newCellData, newCellFormat };
}
