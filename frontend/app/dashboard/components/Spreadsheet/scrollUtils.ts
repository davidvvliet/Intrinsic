import { CELL_WIDTH, CELL_HEIGHT, HEADER_WIDTH, HEADER_HEIGHT } from './config';

export function scrollToCell(
  row: number,
  col: number,
  containerRef: React.RefObject<HTMLDivElement | null>,
  zoom: number
): void {
  const container = containerRef.current;
  if (!container) return;

  const cellWidth = CELL_WIDTH * zoom;
  const cellHeight = CELL_HEIGHT * zoom;
  const headerWidth = HEADER_WIDTH * zoom;
  const headerHeight = HEADER_HEIGHT * zoom;

  // Cell position (relative to scroll area, not including headers in viewport calc)
  const cellLeft = col * cellWidth;
  const cellTop = row * cellHeight;
  const cellRight = cellLeft + cellWidth;
  const cellBottom = cellTop + cellHeight;

  // Visible viewport (excluding headers)
  const viewportWidth = container.clientWidth - headerWidth;
  const viewportHeight = container.clientHeight - headerHeight;
  const viewportLeft = container.scrollLeft;
  const viewportTop = container.scrollTop;
  const viewportRight = viewportLeft + viewportWidth;
  const viewportBottom = viewportTop + viewportHeight;

  let newScrollLeft = container.scrollLeft;
  let newScrollTop = container.scrollTop;

  // Horizontal scroll
  if (cellLeft < viewportLeft) {
    newScrollLeft = cellLeft;
  } else if (cellRight > viewportRight) {
    newScrollLeft = cellRight - viewportWidth;
  }

  // Vertical scroll
  if (cellTop < viewportTop) {
    newScrollTop = cellTop;
  } else if (cellBottom > viewportBottom) {
    newScrollTop = cellBottom - viewportHeight;
  }

  if (newScrollLeft !== container.scrollLeft || newScrollTop !== container.scrollTop) {
    container.scrollTo({ left: newScrollLeft, top: newScrollTop });
  }
}
