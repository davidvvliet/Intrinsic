import type { CellData } from './types';
import { getColumnLabel } from './drawUtils';

export type UsedRange = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

/**
 * Compute the used range (bounding box of all non-empty cells).
 * Returns null if the sheet is empty.
 */
export function getUsedRange(cellData: CellData): UsedRange | null {
  if (cellData.size === 0) {
    return null;
  }

  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  for (const key of cellData.keys()) {
    const [rowStr, colStr] = key.split(',');
    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);

    // Skip cells with empty values
    const cell = cellData.get(key);
    if (!cell || cell.raw === '') continue;

    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  }

  // No non-empty cells found
  if (minRow === Infinity) {
    return null;
  }

  return {
    startRow: minRow,
    endRow: maxRow,
    startCol: minCol,
    endCol: maxCol,
  };
}

/**
 * Convert a used range to A1 notation string (e.g., "A1:D10")
 */
export function usedRangeToA1(range: UsedRange): string {
  const startCol = getColumnLabel(range.startCol);
  const endCol = getColumnLabel(range.endCol);
  const startRow = range.startRow + 1; // Convert to 1-indexed
  const endRow = range.endRow + 1;
  return `${startCol}${startRow}:${endCol}${endRow}`;
}

/**
 * Serialize spreadsheet data to a markdown table.
 *
 * @param cellData - The cell data map
 * @param getDisplayValue - Function to get computed display value for a cell
 * @param maxRows - Maximum rows to include (default 50, to avoid token explosion)
 * @returns Markdown table string, or empty string if sheet is empty
 */
export function serializeToMarkdown(
  cellData: CellData,
  getDisplayValue: (key: string) => string,
  maxRows: number = 50
): string {
  const range = getUsedRange(cellData);

  if (!range) {
    return '';
  }

  const { startRow, endRow, startCol, endCol } = range;
  const totalRows = endRow - startRow + 1;
  const truncated = totalRows > maxRows;
  const displayEndRow = truncated ? startRow + maxRows - 1 : endRow;

  // Build header row with column letters
  const colHeaders = [''];  // Empty cell for row number column
  for (let col = startCol; col <= endCol; col++) {
    colHeaders.push(getColumnLabel(col));
  }

  // Build separator row
  const separator = colHeaders.map(() => '---');

  // Build data rows
  const dataRows: string[][] = [];
  for (let row = startRow; row <= displayEndRow; row++) {
    const rowData: string[] = [String(row + 1)]; // 1-indexed row number

    for (let col = startCol; col <= endCol; col++) {
      const key = `${row},${col}`;
      const cell = cellData.get(key);

      if (!cell || cell.raw === '') {
        rowData.push('');
      } else if (cell.type === 'formula') {
        // Wrap formulas in backticks for visibility
        rowData.push(`\`${cell.raw}\``);
      } else {
        // Use display value (handles formatting)
        const displayValue = getDisplayValue(key);
        // Escape pipe characters in cell values
        rowData.push(displayValue.replace(/\|/g, '\\|'));
      }
    }

    dataRows.push(rowData);
  }

  // Assemble markdown table
  const lines: string[] = [];
  lines.push('| ' + colHeaders.join(' | ') + ' |');
  lines.push('| ' + separator.join(' | ') + ' |');

  for (const row of dataRows) {
    lines.push('| ' + row.join(' | ') + ' |');
  }

  // Add truncation notice if needed
  if (truncated) {
    const remainingRows = totalRows - maxRows;
    lines.push('');
    lines.push(`_(${remainingRows} more rows not shown)_`);
  }

  return lines.join('\n');
}

/**
 * Get a complete context string for the LLM, including range info and data.
 */
export function getSheetContextForLLM(
  cellData: CellData,
  getDisplayValue: (key: string) => string,
  maxRows: number = 50
): string {
  const range = getUsedRange(cellData);

  if (!range) {
    return 'Sheet is empty.';
  }

  const rangeStr = usedRangeToA1(range);
  const markdown = serializeToMarkdown(cellData, getDisplayValue, maxRows);

  return `Used range: ${rangeStr}\n\n${markdown}`;
}
