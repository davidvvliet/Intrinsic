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

    const cell = cellData.get(key);
    if (!cell || cell.raw === '') continue;

    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  }

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
  const startRow = range.startRow + 1;
  const endRow = range.endRow + 1;
  return `${startCol}${startRow}:${endCol}${endRow}`;
}

/**
 * Serialize spreadsheet data to sparse cell format for LLM context.
 * Only includes cells with data, groups by row, marks formulas.
 */
export function serializeToSparse(
  cellData: CellData,
  getDisplayValue: (key: string) => string,
): string {
  const range = getUsedRange(cellData);

  if (!range) {
    return '';
  }

  // Collect all non-empty cells grouped by row
  const rowMap = new Map<number, { col: number; key: string }[]>();

  cellData.forEach((cell, key) => {
    if (!cell || cell.raw === '') return;
    const [rowStr, colStr] = key.split(',');
    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);

    if (!rowMap.has(row)) {
      rowMap.set(row, []);
    }
    rowMap.get(row)!.push({ col, key });
  });

  // Sort rows
  const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);

  const lines: string[] = [];
  let lastRow = -1;

  for (const row of sortedRows) {
    // Insert empty row gap marker
    if (lastRow >= 0 && row - lastRow > 1) {
      const gapStart = lastRow + 1;
      const gapEnd = row - 1;
      if (gapStart === gapEnd) {
        lines.push(`(row ${gapStart + 1} empty)`);
      } else {
        lines.push(`(rows ${gapStart + 1}-${gapEnd + 1} empty)`);
      }
    }
    lastRow = row;

    // Sort cells in this row by column
    const cells = rowMap.get(row)!.sort((a, b) => a.col - b.col);

    // Build cell entries for this row
    const entries: string[] = [];
    for (const { col, key } of cells) {
      const cell = cellData.get(key)!;
      const cellRef = `${getColumnLabel(col)}${row + 1}`;

      if (cell.type === 'formula') {
        const computed = getDisplayValue(key);
        entries.push(`${cellRef}: ${cell.raw} → ${computed} [formula]`);
      } else if (cell.type === 'number') {
        entries.push(`${cellRef}: ${getDisplayValue(key)}`);
      } else {
        entries.push(`${cellRef}: "${cell.raw}"`);
      }
    }

    lines.push(entries.join(' | '));
  }

  return lines.join('\n');
}

/**
 * Get a complete context string for the LLM, including range info and data.
 */
export function getSheetContextForLLM(
  cellData: CellData,
  getDisplayValue: (key: string) => string,
): string {
  const range = getUsedRange(cellData);

  if (!range) {
    return 'Sheet is empty.';
  }

  const rangeStr = usedRangeToA1(range);
  const sparse = serializeToSparse(cellData, getDisplayValue);

  return `Used range: ${rangeStr}\n\n${sparse}`;
}
