import {
  CELL_WIDTH,
  CELL_HEIGHT,
  NUM_ROWS,
  NUM_COLS,
  HEADER_WIDTH,
  HEADER_HEIGHT,
  HEADER_BG,
  CANVAS_BG,
  TEXT_COLOR,
  SELECTION_HIGHLIGHT,
  HEADER_SELECTION_HIGHLIGHT,
  EDITING_OUTLINE,
  ACTIVE_CELL_BORDER,
  CELL_BORDER,
  HEADER_BORDER,
  CELL_FONT_SIZE,
  HEADER_FONT_SIZE,
  CELL_TEXT_PADDING,
  DEFAULT_BORDER_WIDTH,
  ACTIVE_BORDER_WIDTH,
  EDITING_OUTLINE_WIDTH,
  DASH_PATTERN,
  POINTING_SELECTION_BORDER,
  POINTING_SELECTION_HIGHLIGHT,
  FORMULA_REFERENCE_COLORS,
  LLM_ANIMATION_COLOR,
} from './config';
import type { CellData, CellFormat, CellFormatData, Selection, CopiedRange, CellType, ComputedData, NumberFormatType } from './types';
import { applyFormat, shouldRightAlign } from './formatUtils';

export function getCellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function isNumeric(value: string): boolean {
  return value.trim() !== '' && !isNaN(Number(value));
}

export function determineCellType(value: string): CellType {
  if (value.startsWith('=')) {
    return 'formula';
  }
  if (isNumeric(value)) {
    return 'number';
  }
  return 'text';
}

export type ParsedInputValue = {
  value: string;
  type: CellType;
  inferredFormat?: NumberFormatType;
};

/**
 * Parse user input to extract canonical value, type, and inferred format.
 * Converts formatted numbers to their actual values:
 * - "10%" → { value: "0.1", type: "number", inferredFormat: "percent" }
 * - "$100" → { value: "100", type: "number", inferredFormat: "currency" }
 * - "1,000" → { value: "1000", type: "number" }
 */
export function parseInputValue(input: string): ParsedInputValue {
  if (input.startsWith('=')) {
    return { value: input, type: 'formula' };
  }

  const trimmed = input.trim();

  // Percentage: "10%" → 0.1
  if (trimmed.endsWith('%')) {
    const numPart = trimmed.slice(0, -1).replace(/,/g, '');
    const num = parseFloat(numPart);
    if (!isNaN(num)) {
      return {
        value: String(num / 100),
        type: 'number',
        inferredFormat: 'percent'
      };
    }
  }

  // Currency: "$100", "£50", "€25", "¥1000"
  const currencyMatch = trimmed.match(/^([\$£€¥])(.+)$/);
  if (currencyMatch) {
    const numPart = currencyMatch[2].replace(/,/g, '').trim();
    const num = parseFloat(numPart);
    if (!isNaN(num)) {
      return {
        value: String(num),
        type: 'number',
        inferredFormat: 'currency'
      };
    }
  }

  // Number with commas: "1,000" → 1000
  if (trimmed.includes(',')) {
    const numPart = trimmed.replace(/,/g, '');
    const num = parseFloat(numPart);
    if (!isNaN(num) && isFinite(num)) {
      return {
        value: String(num),
        type: 'number'
      };
    }
  }

  // Plain number
  if (isNumeric(trimmed)) {
    return { value: trimmed, type: 'number' };
  }

  // Text
  return { value: input, type: 'text' };
}

/**
 * Limits decimal places based on integer digit count.
 * Shows max(0, 10 - integer_digit_count) decimal places.
 * Formula bar should show full value, so this only affects cell display.
 */
function limitDecimalsByIntegerDigits(value: string): string {
  // Try to parse as number
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return value; // Not a number, return as-is
  }

  // Handle negative numbers
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  // Count integer digits
  const integerPart = Math.floor(absNum);
  const integerDigits = integerPart === 0 ? 1 : Math.floor(Math.log10(integerPart)) + 1;

  // Calculate max decimal places: max(0, 10 - integer_digit_count)
  const maxDecimals = Math.max(0, 10 - integerDigits);

  // Format with calculated decimal places, then remove trailing zeros
  const formatted = num.toFixed(maxDecimals);
  // Remove trailing zeros and decimal point if no decimals remain
  return formatted.replace(/\.?0+$/, '');
}

export function getColumnLabel(col: number): string {
  let label = '';
  let c = col;
  while (c >= 0) {
    label = String.fromCharCode(65 + (c % 26)) + label;
    c = Math.floor(c / 26) - 1;
  }
  return label;
}

/**
 * Convert A1 notation to row and column indices
 * @param a1 - Cell reference in A1 notation (e.g., "A1", "B2", "AA10")
 * @returns Object with row and col (0-indexed)
 */
export function a1ToRowCol(a1: string): { row: number; col: number } {
  const match = a1.match(/^([A-Z]+)(\d+)$/i);
  if (!match) {
    throw new Error(`Invalid A1 notation: ${a1}`);
  }
  
  const [, colStr, rowStr] = match;
  
  // Convert column letters to number (A=0, B=1, ..., Z=25, AA=26, etc.)
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    const char = colStr[i].toUpperCase();
    col = col * 26 + (char.charCodeAt(0) - 64);
  }
  col -= 1; // Convert to 0-indexed
  
  // Convert row number to 0-indexed
  const row = parseInt(rowStr, 10) - 1;
  
  return { row, col };
}

export type FormulaSegment = { text: string; colorIndex: number | null };

export function getFormulaSegments(value: string): FormulaSegment[] {
  if (!value.startsWith('=')) {
    return [{ text: value, colorIndex: null }];
  }

  const cellRefPattern = /(\$?[A-Za-z]+\$?\d+(?::\$?[A-Za-z]+\$?\d+)?)/g;
  const matches = Array.from(value.matchAll(cellRefPattern));

  if (matches.length === 0) {
    return [{ text: value, colorIndex: null }];
  }

  const segments: FormulaSegment[] = [];
  let lastIndex = 0;

  matches.forEach((match, i) => {
    const matchStart = match.index!;
    const matchEnd = matchStart + match[0].length;

    if (matchStart > lastIndex) {
      segments.push({ text: value.slice(lastIndex, matchStart), colorIndex: null });
    }

    segments.push({ text: match[0], colorIndex: i });
    lastIndex = matchEnd;
  });

  if (lastIndex < value.length) {
    segments.push({ text: value.slice(lastIndex), colorIndex: null });
  }

  return segments;
}

export function drawGrid({
  ctx,
  canvas,
  container,
  cellData,
  cellFormat,
  computedData,
  selection,
  highlightedCells,
  copiedRange,
  animatingRanges,
  dashOffset,
  zoom,
  isEditing,
  columnWidths,
  getColumnX,
}: {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  container: HTMLDivElement;
  cellData: CellData;
  cellFormat: CellFormatData;
  computedData: ComputedData;
  selection: Selection | null;
  highlightedCells: Selection[] | null;
  copiedRange: CopiedRange;
  animatingRanges: CopiedRange[];
  dashOffset: number;
  zoom: number;
  isEditing: boolean;
  columnWidths: Map<number, number>;
  getColumnX: (col: number) => number;
}) {
  // Apply DPR scaling for crisp rendering on all displays
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Use CSS pixel dimensions (not canvas pixel dimensions)
  const cssWidth = canvas.width / dpr;
  const cssHeight = canvas.height / dpr;

  const scrollLeft = container.scrollLeft;
  const scrollTop = container.scrollTop;

  // Helper to get column width
  const getColumnWidth = (col: number): number => {
    return (columnWidths.get(col) || CELL_WIDTH) * zoom;
  };

  // Effective dimensions with zoom
  const cellHeight = CELL_HEIGHT * zoom;
  const headerWidth = HEADER_WIDTH * zoom;
  const headerHeight = HEADER_HEIGHT * zoom;

  // Clear canvas
  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  // Calculate visible range (accounting for header offset and variable column widths)
  // Find startCol by iterating through columns until we find one that's visible
  let startCol = 0;
  let cumulativeWidth = 0;
  while (startCol < NUM_COLS && cumulativeWidth + getColumnWidth(startCol) < scrollLeft) {
    cumulativeWidth += getColumnWidth(startCol);
    startCol++;
  }

  // Find endCol by continuing until we exceed visible area
  let endCol = startCol;
  let visibleWidth = cumulativeWidth - scrollLeft;
  while (endCol < NUM_COLS && visibleWidth < cssWidth - headerWidth) {
    visibleWidth += getColumnWidth(endCol);
    endCol++;
  }
  endCol = Math.min(endCol + 1, NUM_COLS);
  const startRow = Math.floor(scrollTop / cellHeight);
  const endRow = Math.min(startRow + Math.ceil((cssHeight - headerHeight) / cellHeight) + 1, NUM_ROWS);

  // Calculate selection bounds
  let minRow = -1, maxRow = -1, minCol = -1, maxCol = -1;
  if (selection) {
    minRow = Math.min(selection.start.row, selection.end.row);
    maxRow = Math.max(selection.start.row, selection.end.row);
    minCol = Math.min(selection.start.col, selection.end.col);
    maxCol = Math.max(selection.start.col, selection.end.col);
  }
  
  // Check if selection spans multiple cells
  const isMultiCellSelection = minRow !== maxRow || minCol !== maxCol;

  // Helper function to get the index of the highlighted cell (or -1 if not found)
  const getHighlightedCellIndex = (row: number, col: number): number => {
    if (!highlightedCells || highlightedCells.length === 0) return -1;
    
    for (let i = 0; i < highlightedCells.length; i++) {
      const sel = highlightedCells[i];
      if (!sel) continue;
      const selMinRow = Math.min(sel.start.row, sel.end.row);
      const selMaxRow = Math.max(sel.start.row, sel.end.row);
      const selMinCol = Math.min(sel.start.col, sel.end.col);
      const selMaxCol = Math.max(sel.start.col, sel.end.col);
      if (row >= selMinRow && row <= selMaxRow && col >= selMinCol && col <= selMaxCol) {
        return i;
      }
    }
    return -1;
  };

  // PASS 1: Draw all fills first (so borders can be drawn on top)
  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const cellWidth = getColumnWidth(col);
      const x = headerWidth + getColumnX(col) * zoom - scrollLeft;
      const y = headerHeight + row * cellHeight - scrollTop;

      // Skip if cell is outside visible area (behind headers)
      if (x + cellWidth < headerWidth || y + cellHeight < headerHeight) continue;

      // Get cell format
      const key = getCellKey(row, col);
      const format = cellFormat.get(key) || {};

      // Draw fill color (full size to cover whole cell)
      if (format.fillColor) {
        ctx.fillStyle = format.fillColor;
        ctx.fillRect(x, y, cellWidth, cellHeight);
      }

      // Draw selection highlight (only for multi-cell selections)
      const inSelection = row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
      if (inSelection && isMultiCellSelection) {
        ctx.fillStyle = SELECTION_HIGHLIGHT;
        ctx.fillRect(x, y, cellWidth, cellHeight);
      }

      // Draw highlighted cells (formula reference mode) with different colors per reference
      const highlightedIndex = getHighlightedCellIndex(row, col);
      if (highlightedIndex >= 0) {
        const colorIndex = highlightedIndex % FORMULA_REFERENCE_COLORS.length;
        ctx.fillStyle = FORMULA_REFERENCE_COLORS[colorIndex].fill;
        ctx.fillRect(x, y, cellWidth, cellHeight);
      }
    }
  }

  // PASS 2: Draw all borders and content (on top of fills)
  ctx.strokeStyle = CELL_BORDER;
  ctx.lineWidth = DEFAULT_BORDER_WIDTH;
  ctx.font = `${CELL_FONT_SIZE * zoom}px Arial`;
  ctx.fillStyle = TEXT_COLOR;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const cellWidth = getColumnWidth(col);
      const x = headerWidth + getColumnX(col) * zoom - scrollLeft;
      const y = headerHeight + row * cellHeight - scrollTop;

      // Skip if cell is outside visible area (behind headers)
      if (x + cellWidth < headerWidth || y + cellHeight < headerHeight) continue;

      const key = getCellKey(row, col);
      const format = cellFormat.get(key) || {};
      const isAnchor = selection && row === selection.start.row && col === selection.start.col;

      // Draw cell border
      ctx.strokeRect(x, y, cellWidth, cellHeight);

      // Draw anchor cell border (the "active" cell)
      if (isAnchor) {
        // Draw wider lighter outline when editing
        if (isEditing) {
          ctx.strokeStyle = EDITING_OUTLINE;
          ctx.lineWidth = EDITING_OUTLINE_WIDTH;
          ctx.strokeRect(x - 1, y - 1, cellWidth + 2, cellHeight + 2);
        }
        // Draw the main border
        ctx.strokeStyle = ACTIVE_CELL_BORDER;
        ctx.lineWidth = ACTIVE_BORDER_WIDTH;
        ctx.strokeRect(x, y, cellWidth, cellHeight);
        ctx.strokeStyle = CELL_BORDER;
        ctx.lineWidth = DEFAULT_BORDER_WIDTH;
      }

      // Draw cell content (but not for anchor cell when editing)
      const cellValue = cellData.get(key);
      if (cellValue && !(isAnchor && isEditing)) {
        // Use clipping to prevent overflow, but don't compress text
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
        ctx.clip();
        
        // Apply font formatting
        const fontParts: string[] = [];
        if (format.italic) fontParts.push('italic');
        if (format.bold) fontParts.push('bold');
        fontParts.push(`${CELL_FONT_SIZE * zoom}px`);
        fontParts.push('Arial');
        ctx.font = fontParts.join(' ');
        
        // Apply text color (red for errors)
        const computed = computedData.get(key);
        const hasError = computed?.error;
        ctx.fillStyle = hasError ? '#dc2626' : (format.textColor || TEXT_COLOR);
        
        // Get display value: use computed value for formulas, raw for others
        let displayValue: string;
        if (cellValue.type === 'formula') {
          if (computed?.error) {
            displayValue = computed.error;
          } else if (computed?.value !== null && computed?.value !== undefined) {
            displayValue = String(computed.value);
          } else {
            displayValue = '';
          }
        } else {
          displayValue = cellValue.raw;
        }
        
        // Limit decimal places based on integer digit count (only for numeric values, not errors)
        if (!hasError && isNumeric(displayValue)) {
          displayValue = limitDecimalsByIntegerDigits(displayValue);
        }
        
        // Apply number format to get display text
        const displayText = hasError ? displayValue : applyFormat(displayValue, format.numberFormat);
        
        // Right-align numbers/formatted values, left-align text
        let textX: number;
        if (shouldRightAlign(displayValue, format.numberFormat)) {
          ctx.textAlign = 'right';
          textX = x + cellWidth - CELL_TEXT_PADDING * zoom;
        } else {
          ctx.textAlign = 'left';
          textX = x + CELL_TEXT_PADDING * zoom;
        }
        const textY = y + cellHeight / 2;
        
        ctx.fillText(displayText, textX, textY);
        
        // Draw strikethrough if needed
        if (format.strikethrough) {
          const textWidth = ctx.measureText(displayText).width;
          const lineY = textY;
          let lineStartX: number;
          if (shouldRightAlign(displayValue, format.numberFormat)) {
            lineStartX = textX - textWidth;
          } else {
            lineStartX = textX;
          }
          ctx.beginPath();
          ctx.moveTo(lineStartX, lineY);
          ctx.lineTo(lineStartX + textWidth, lineY);
          ctx.strokeStyle = hasError ? '#dc2626' : (format.textColor || TEXT_COLOR);
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Draw underline if needed
        if (format.underline) {
          const textWidth = ctx.measureText(displayText).width;
          const lineY = textY + CELL_FONT_SIZE * 0.35 * zoom; // Position below descenders
          let lineStartX: number;
          if (shouldRightAlign(displayValue, format.numberFormat)) {
            lineStartX = textX - textWidth;
          } else {
            lineStartX = textX;
          }
          ctx.beginPath();
          ctx.moveTo(lineStartX, lineY);
          ctx.lineTo(lineStartX + textWidth, lineY);
          ctx.strokeStyle = hasError ? '#dc2626' : (format.textColor || TEXT_COLOR);
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Reset text align and fill style
        ctx.textAlign = 'left';
        ctx.fillStyle = TEXT_COLOR;
        ctx.restore();
      }
    }
  }

  // Draw highlighted cells borders (formula reference mode) with marching ants and different colors per reference
  if (highlightedCells && highlightedCells.length > 0) {
    ctx.setLineDash(DASH_PATTERN);
    ctx.lineDashOffset = -dashOffset;
    ctx.lineWidth = ACTIVE_BORDER_WIDTH;
    
    for (let i = 0; i < highlightedCells.length; i++) {
      const sel = highlightedCells[i];
      if (!sel) continue;
      
      const colorIndex = i % FORMULA_REFERENCE_COLORS.length;
      ctx.strokeStyle = FORMULA_REFERENCE_COLORS[colorIndex].border;
      
      const pointMinRow = Math.min(sel.start.row, sel.end.row);
      const pointMaxRow = Math.max(sel.start.row, sel.end.row);
      const pointMinCol = Math.min(sel.start.col, sel.end.col);
      const pointMaxCol = Math.max(sel.start.col, sel.end.col);
      
      const pointX = headerWidth + getColumnX(pointMinCol) * zoom - scrollLeft;
      const pointY = headerHeight + pointMinRow * cellHeight - scrollTop;
      let pointWidth = 0;
      for (let col = pointMinCol; col <= pointMaxCol; col++) {
        pointWidth += getColumnWidth(col);
      }
      const pointHeight = (pointMaxRow - pointMinRow + 1) * cellHeight;
      
      ctx.strokeRect(pointX, pointY, pointWidth, pointHeight);
    }
    
    ctx.setLineDash([]);
    ctx.strokeStyle = CELL_BORDER;
    ctx.lineWidth = DEFAULT_BORDER_WIDTH;
  }

  // Draw marching ants around copied range (offset by headers)
  if (copiedRange) {
    const copyX = headerWidth + getColumnX(copiedRange.minCol) * zoom - scrollLeft;
    const copyY = headerHeight + copiedRange.minRow * cellHeight - scrollTop;
    let copyWidth = 0;
    for (let col = copiedRange.minCol; col <= copiedRange.maxCol; col++) {
      copyWidth += getColumnWidth(col);
    }
    const copyHeight = (copiedRange.maxRow - copiedRange.minRow + 1) * cellHeight;

    ctx.setLineDash(DASH_PATTERN);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeStyle = TEXT_COLOR;
    ctx.lineWidth = ACTIVE_BORDER_WIDTH;
    ctx.strokeRect(copyX, copyY, copyWidth, copyHeight);
    ctx.setLineDash([]);
  }

  // Draw marching ants around LLM animating ranges
  if (animatingRanges && animatingRanges.length > 0) {
    ctx.setLineDash(DASH_PATTERN);
    ctx.lineDashOffset = -dashOffset;
    ctx.lineWidth = ACTIVE_BORDER_WIDTH;
    ctx.strokeStyle = LLM_ANIMATION_COLOR.border;

    animatingRanges.forEach(range => {
      if (!range) return;
      const x = headerWidth + getColumnX(range.minCol) * zoom - scrollLeft;
      const y = headerHeight + range.minRow * cellHeight - scrollTop;
      let width = 0;
      for (let col = range.minCol; col <= range.maxCol; col++) {
        width += getColumnWidth(col);
      }
      const height = (range.maxRow - range.minRow + 1) * cellHeight;

      ctx.strokeRect(x, y, width, height);
    });

    ctx.setLineDash([]);
  }

  // Draw column headers (A, B, C...)
  ctx.fillStyle = HEADER_BG;
  ctx.fillRect(headerWidth, 0, cssWidth - headerWidth, headerHeight);
  ctx.strokeStyle = HEADER_BORDER;
  ctx.lineWidth = DEFAULT_BORDER_WIDTH;
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.font = `bold ${HEADER_FONT_SIZE * zoom}px Arial`;

  for (let col = startCol; col < endCol; col++) {
    const cellWidth = getColumnWidth(col);
    const x = headerWidth + getColumnX(col) * zoom - scrollLeft;
    if (x + cellWidth < headerWidth) continue;
    
    // Highlight column header if in selection
    if (selection && col >= minCol && col <= maxCol) {
      ctx.fillStyle = HEADER_SELECTION_HIGHLIGHT;
      ctx.fillRect(x, 0, cellWidth, headerHeight);
    }
    
    // Draw only left, right, and bottom borders (no top border)
    ctx.beginPath();
    ctx.moveTo(x, 0); // Start at top-left
    ctx.lineTo(x, headerHeight); // Left border
    ctx.lineTo(x + cellWidth, headerHeight); // Bottom border
    ctx.lineTo(x + cellWidth, 0); // Right border
    ctx.stroke();
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(getColumnLabel(col), x + cellWidth / 2, headerHeight / 2);
  }

  // Draw row headers (1, 2, 3...)
  ctx.fillStyle = HEADER_BG;
  ctx.fillRect(0, headerHeight, headerWidth, cssHeight - headerHeight);
  ctx.strokeStyle = HEADER_BORDER;
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.font = `bold ${HEADER_FONT_SIZE * zoom}px Arial`;

  for (let row = startRow; row < endRow; row++) {
    const y = headerHeight + row * cellHeight - scrollTop;
    if (y + cellHeight < headerHeight) continue;
    
    // Highlight row header if in selection
    if (selection && row >= minRow && row <= maxRow) {
      ctx.fillStyle = HEADER_SELECTION_HIGHLIGHT;
      ctx.fillRect(0, y, headerWidth, cellHeight);
    }
    
    ctx.strokeRect(0, y, headerWidth, cellHeight);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(String(row + 1), headerWidth / 2, y + cellHeight / 2);
  }

  // Draw corner cell (top-left)
  ctx.fillStyle = HEADER_BG;
  ctx.fillRect(0, 0, headerWidth, headerHeight);
  ctx.strokeStyle = HEADER_BORDER;
  // Draw only left, right, and bottom borders (no top border)
  ctx.beginPath();
  ctx.moveTo(0, 0); // Start at top-left
  ctx.lineTo(0, headerHeight); // Left border
  ctx.lineTo(headerWidth, headerHeight); // Bottom border
  ctx.lineTo(headerWidth, 0); // Right border
  ctx.stroke();
}
