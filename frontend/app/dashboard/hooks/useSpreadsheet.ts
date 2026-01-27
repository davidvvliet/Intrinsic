import { useEffect } from 'react';
import {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_DELTA,
  DASH_OFFSET_MODULO,
  MARCHING_ANTS_INTERVAL_MS,
  CELL_WIDTH,
  CELL_HEIGHT,
  HEADER_WIDTH,
  HEADER_HEIGHT,
} from '../components/Spreadsheet/config';
import type {
  CopiedRange,
  Selection,
} from '../components/Spreadsheet/types';

export function useSpreadsheet({
  canvasRef,
  containerRef,
  zoom,
  setZoom,
  drawGrid,
  copiedRange,
  setDashOffset,
  selection,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  drawGrid: () => void;
  copiedRange: CopiedRange;
  setDashOffset: React.Dispatch<React.SetStateAction<number>>;
  selection: Selection;
}) {
  // Initialize canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      
      drawGrid();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [canvasRef, containerRef, drawGrid]);

  // Redraw on state changes
  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  // Zoom with Ctrl/Cmd + wheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_DELTA : ZOOM_DELTA;
        setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [containerRef, setZoom]);

  // Marching ants animation for copied range
  useEffect(() => {
    if (!copiedRange) return;
    
    const interval = setInterval(() => {
      setDashOffset(prev => (prev + 1) % DASH_OFFSET_MODULO);
    }, MARCHING_ANTS_INTERVAL_MS);
    
    return () => clearInterval(interval);
  }, [copiedRange, setDashOffset]);

  // Auto-scroll to keep selected cell in view
  useEffect(() => {
    if (!selection) return;
    const container = containerRef.current;
    if (!container) return;

    const { row, col } = selection.start;
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
  }, [selection, zoom, containerRef]);
}
