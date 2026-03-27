import { useEffect } from 'react';
import {
  DASH_OFFSET_MODULO,
  MARCHING_ANTS_INTERVAL_MS,
} from '../components/Spreadsheet/config';
import type {
  CopiedRange,
  Selection,
} from '../components/Spreadsheet/types';
import { scrollToCell } from '../components/Spreadsheet/scrollUtils';

export function useSpreadsheet({
  canvasRef,
  containerRef,
  zoom,
  drawGrid,
  copiedRange,
  animatingRanges,
  setDashOffset,
  selection,
  highlightedCells,
  columnWidths,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  drawGrid: () => void;
  copiedRange: CopiedRange;
  animatingRanges: CopiedRange[];
  setDashOffset: React.Dispatch<React.SetStateAction<number>>;
  selection: Selection | null;
  highlightedCells: Selection[] | null;
  columnWidths: Map<number, number>;
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

    // Use ResizeObserver to detect container size changes (not just window resize)
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    window.addEventListener('resize', resizeCanvas);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [canvasRef, containerRef, drawGrid]);

  // Redraw on state changes
  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  // Marching ants animation for copied range, highlighted cells, and animating ranges
  useEffect(() => {
    const hasSelections = highlightedCells && highlightedCells.length > 0;
    const hasAnimations = animatingRanges && animatingRanges.length > 0;
    if (!copiedRange && !hasSelections && !hasAnimations) return;

    const interval = setInterval(() => {
      setDashOffset(prev => (prev + 1) % DASH_OFFSET_MODULO);
    }, MARCHING_ANTS_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [copiedRange, highlightedCells, animatingRanges, setDashOffset]);

  // Auto-scroll to keep selected cell in view
  useEffect(() => {
    if (!selection) return;
    scrollToCell(selection.start.row, selection.start.col, containerRef, zoom, columnWidths);
  }, [selection, zoom, containerRef, columnWidths]);
}
