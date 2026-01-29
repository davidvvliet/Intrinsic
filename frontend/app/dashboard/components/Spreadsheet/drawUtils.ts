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
} from './config';
import type { CellData, CellFormat, CellFormatData, Selection, CopiedRange, CellType, ComputedData } from './types';
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

export function getColumnLabel(col: number): string {
  let label = '';
  let c = col;
  while (c >= 0) {
    label = String.fromCharCode(65 + (c % 26)) + label;
    c = Math.floor(c / 26) - 1;
  }
  return label;
}

export function drawGrid({
  ctx,
  canvas,
  container,
  cellData,
  cellFormat,
  computedData,
  selection,
  pointingSelection,
  copiedRange,
  dashOffset,
  zoom,
  isEditing,
}: {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  container: HTMLDivElement;
  cellData: CellData;
  cellFormat: CellFormatData;
  computedData: ComputedData;
  selection: Selection;
  pointingSelection: Selection;
  copiedRange: CopiedRange;
  dashOffset: number;
  zoom: number;
  isEditing: boolean;
}) {
  const scrollLeft = container.scrollLeft;
  const scrollTop = container.scrollTop;

  // Effective dimensions with zoom
  const cellWidth = CELL_WIDTH * zoom;
  const cellHeight = CELL_HEIGHT * zoom;
  const headerWidth = HEADER_WIDTH * zoom;
  const headerHeight = HEADER_HEIGHT * zoom;

  // Clear canvas
  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Calculate visible range (accounting for header offset)
  const startCol = Math.floor(scrollLeft / cellWidth);
  const endCol = Math.min(startCol + Math.ceil((canvas.width - headerWidth) / cellWidth) + 1, NUM_COLS);
  const startRow = Math.floor(scrollTop / cellHeight);
  const endRow = Math.min(startRow + Math.ceil((canvas.height - headerHeight) / cellHeight) + 1, NUM_ROWS);

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

  // Calculate pointing selection bounds (for formula reference mode)
  let pointMinRow = -1, pointMaxRow = -1, pointMinCol = -1, pointMaxCol = -1;
  if (pointingSelection) {
    pointMinRow = Math.min(pointingSelection.start.row, pointingSelection.end.row);
    pointMaxRow = Math.max(pointingSelection.start.row, pointingSelection.end.row);
    pointMinCol = Math.min(pointingSelection.start.col, pointingSelection.end.col);
    pointMaxCol = Math.max(pointingSelection.start.col, pointingSelection.end.col);
  }

  // PASS 1: Draw all fills first (so borders can be drawn on top)
  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const x = headerWidth + col * cellWidth - scrollLeft;
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

      // Draw pointing selection highlight (formula reference mode)
      const inPointingSelection = row >= pointMinRow && row <= pointMaxRow && col >= pointMinCol && col <= pointMaxCol;
      if (inPointingSelection) {
        ctx.fillStyle = POINTING_SELECTION_HIGHLIGHT;
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
      const x = headerWidth + col * cellWidth - scrollLeft;
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
        
        // Reset text align and fill style
        ctx.textAlign = 'left';
        ctx.fillStyle = TEXT_COLOR;
        ctx.restore();
      }
    }
  }

  // Draw pointing selection border (formula reference mode) with marching ants
  if (pointingSelection) {
    const pointX = headerWidth + pointMinCol * cellWidth - scrollLeft;
    const pointY = headerHeight + pointMinRow * cellHeight - scrollTop;
    const pointWidth = (pointMaxCol - pointMinCol + 1) * cellWidth;
    const pointHeight = (pointMaxRow - pointMinRow + 1) * cellHeight;
    
    ctx.setLineDash(DASH_PATTERN);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeStyle = POINTING_SELECTION_BORDER;
    ctx.lineWidth = ACTIVE_BORDER_WIDTH;
    ctx.strokeRect(pointX, pointY, pointWidth, pointHeight);
    ctx.setLineDash([]);
    ctx.strokeStyle = CELL_BORDER;
    ctx.lineWidth = DEFAULT_BORDER_WIDTH;
  }

  // Draw marching ants around copied range (offset by headers)
  if (copiedRange) {
    const copyX = headerWidth + copiedRange.minCol * cellWidth - scrollLeft;
    const copyY = headerHeight + copiedRange.minRow * cellHeight - scrollTop;
    const copyWidth = (copiedRange.maxCol - copiedRange.minCol + 1) * cellWidth;
    const copyHeight = (copiedRange.maxRow - copiedRange.minRow + 1) * cellHeight;
    
    ctx.setLineDash(DASH_PATTERN);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeStyle = TEXT_COLOR;
    ctx.lineWidth = ACTIVE_BORDER_WIDTH;
    ctx.strokeRect(copyX, copyY, copyWidth, copyHeight);
    ctx.setLineDash([]);
  }

  // Draw column headers (A, B, C...)
  ctx.fillStyle = HEADER_BG;
  ctx.fillRect(headerWidth, 0, canvas.width - headerWidth, headerHeight);
  ctx.strokeStyle = HEADER_BORDER;
  ctx.lineWidth = DEFAULT_BORDER_WIDTH;
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.font = `bold ${HEADER_FONT_SIZE * zoom}px Arial`;

  for (let col = startCol; col < endCol; col++) {
    const x = headerWidth + col * cellWidth - scrollLeft;
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
  ctx.fillRect(0, headerHeight, headerWidth, canvas.height - headerHeight);
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
