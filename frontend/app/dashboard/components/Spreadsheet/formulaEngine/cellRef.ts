import type { CellRef } from './types';

/**
 * Convert column index to letter(s): 0 -> A, 25 -> Z, 26 -> AA
 */
export function colToLetter(col: number): string {
  let result = '';
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode(65 + (c % 26)) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

/**
 * Convert column letter(s) to index: A -> 0, Z -> 25, AA -> 26
 */
export function letterToCol(letters: string): number {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

/**
 * Parse a cell reference string like "A1", "$A1", "A$1", "$A$1"
 * Also handles sheet-qualified refs like "'Sheet Name'!A1"
 * Returns null if invalid
 */
export function parseCellRef(ref: string): CellRef | null {
  let sheet: string | undefined;
  let cellPart = ref;

  // Check for sheet prefix: 'Sheet Name'!A1 or SheetName!A1
  const sheetMatch = ref.match(/^'([^']+)'!(.+)$/);
  if (sheetMatch) {
    sheet = sheetMatch[1];
    cellPart = sheetMatch[2];
  } else if (ref.includes('!')) {
    const bangIdx = ref.indexOf('!');
    sheet = ref.slice(0, bangIdx);
    cellPart = ref.slice(bangIdx + 1);
  }

  const match = cellPart.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/);
  if (!match) return null;

  const [, absCols, colLetters, absRows, rowDigits] = match;
  const col = letterToCol(colLetters.toUpperCase());
  const row = parseInt(rowDigits, 10) - 1; // Convert to 0-based

  if (row < 0 || col < 0) return null;

  return {
    col,
    row,
    absCol: absCols === '$',
    absRow: absRows === '$',
    ...(sheet !== undefined && { sheet }),
  };
}

/**
 * Format a cell reference back to string: {col: 0, row: 0} -> "A1"
 */
export function formatCellRef(ref: CellRef): string {
  const colPart = ref.absCol ? '$' : '';
  const rowPart = ref.absRow ? '$' : '';
  return `${colPart}${colToLetter(ref.col)}${rowPart}${ref.row + 1}`;
}

/**
 * Format from row/col numbers directly
 */
export function formatCell(row: number, col: number): string {
  return `${colToLetter(col)}${row + 1}`;
}

/**
 * Convert internal key format "row,col" to CellRef
 */
export function keyToCellRef(key: string): CellRef | null {
  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const row = parseInt(parts[0], 10);
  const col = parseInt(parts[1], 10);
  if (isNaN(row) || isNaN(col)) return null;
  return { row, col, absRow: false, absCol: false };
}

/**
 * Convert CellRef to internal key format "row,col" or "sheetName:row,col"
 */
export function cellRefToKey(ref: CellRef): string {
  const key = `${ref.row},${ref.col}`;
  return ref.sheet ? `${ref.sheet}:${key}` : key;
}

/**
 * Expand a range into array of cell keys
 * e.g., A1:B2 -> ["0,0", "0,1", "1,0", "1,1"]
 * For cross-sheet ranges: ["SheetName:0,0", "SheetName:0,1", ...]
 */
export function expandRange(start: CellRef, end: CellRef): string[] {
  const keys: string[] = [];
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const sheet = start.sheet || end.sheet;

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const key = `${row},${col}`;
      keys.push(sheet ? `${sheet}:${key}` : key);
    }
  }
  return keys;
}

/**
 * Check if a string looks like a cell reference (for tokenizer)
 */
export function isCellRefPattern(str: string): boolean {
  return /^\$?[A-Za-z]+\$?\d+$/.test(str);
}

/**
 * Adjust cell reference when copying formulas (handles relative/absolute refs)
 */
export function adjustCellRef(
  ref: CellRef,
  rowDelta: number,
  colDelta: number
): CellRef {
  return {
    col: ref.absCol ? ref.col : ref.col + colDelta,
    row: ref.absRow ? ref.row : ref.row + rowDelta,
    absCol: ref.absCol,
    absRow: ref.absRow,
  };
}
