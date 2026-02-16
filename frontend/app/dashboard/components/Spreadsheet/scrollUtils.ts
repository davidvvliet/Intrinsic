import { CELL_WIDTH, CELL_HEIGHT, HEADER_WIDTH, HEADER_HEIGHT } from './config';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';

export function scrollToCell(
  row: number,
  col: number,
  containerRef: React.RefObject<HTMLDivElement | null>,
  zoom: number,
  columnWidths: Map<number, number>
): void {
  const container = containerRef.current;
  if (!container) return;

  // Get frozen state from store
  const frozenRows = useSpreadsheetStore.getState().frozenRows;
  const frozenColumns = useSpreadsheetStore.getState().frozenColumns;

  const cellHeight = CELL_HEIGHT * zoom;
  const headerWidth = HEADER_WIDTH * zoom;
  const headerHeight = HEADER_HEIGHT * zoom;

  // Helper to get column width
  const getColumnWidth = (c: number): number => {
    return (columnWidths.get(c) || CELL_WIDTH) * zoom;
  };

  // Helper to get column X position
  const getColumnX = (c: number): number => {
    let x = 0;
    for (let i = 0; i < c; i++) {
      x += columnWidths.get(i) || CELL_WIDTH;
    }
    return x;
  };

  // Calculate frozen dimensions
  let frozenWidth = 0;
  for (let i = 0; i < frozenColumns; i++) {
    frozenWidth += getColumnWidth(i);
  }
  const frozenHeight = frozenRows * cellHeight;

  // If cell is in frozen area, no need to scroll
  if (row < frozenRows && col < frozenColumns) {
    return; // Cell is always visible (frozen corner)
  }

  let newScrollLeft = container.scrollLeft;
  let newScrollTop = container.scrollTop;

  // Handle horizontal scrolling (if not in frozen columns)
  if (col >= frozenColumns) {
    const cellLeft = getColumnX(col) * zoom;
    const cellWidth = getColumnWidth(col);
    const cellRight = cellLeft + cellWidth;

    // Visible viewport for scrollable columns (excluding headers and frozen columns)
    const viewportWidth = container.clientWidth - headerWidth - frozenWidth;
    const viewportLeft = container.scrollLeft + frozenWidth;
    const viewportRight = viewportLeft + viewportWidth;

    if (cellLeft < viewportLeft) {
      newScrollLeft = cellLeft - frozenWidth;
    } else if (cellRight > viewportRight) {
      newScrollLeft = cellRight - frozenWidth - viewportWidth;
    }
  }

  // Handle vertical scrolling (if not in frozen rows)
  if (row >= frozenRows) {
    const cellTop = row * cellHeight;
    const cellBottom = cellTop + cellHeight;

    // Visible viewport for scrollable rows (excluding headers and frozen rows)
    const viewportHeight = container.clientHeight - headerHeight - frozenHeight;
    const viewportTop = container.scrollTop + frozenHeight;
    const viewportBottom = viewportTop + viewportHeight;

    if (cellTop < viewportTop) {
      newScrollTop = cellTop - frozenHeight;
    } else if (cellBottom > viewportBottom) {
      newScrollTop = cellBottom - frozenHeight - viewportHeight;
    }
  }

  if (newScrollLeft !== container.scrollLeft || newScrollTop !== container.scrollTop) {
    container.scrollTo({ left: newScrollLeft, top: newScrollTop });
  }
}
