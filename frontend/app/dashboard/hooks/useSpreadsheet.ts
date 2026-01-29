import { useEffect } from 'react';
import {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_DELTA,
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
  setZoom,
  drawGrid,
  copiedRange,
  setDashOffset,
  selection,
  highlightedCells,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  drawGrid: () => void;
  copiedRange: CopiedRange;
  setDashOffset: React.Dispatch<React.SetStateAction<number>>;
  selection: Selection | null;
  highlightedCells: Selection[] | null;
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

  // Marching ants animation for copied range and highlighted cells
  useEffect(() => {
    const hasSelections = highlightedCells && highlightedCells.length > 0;
    if (!copiedRange && !hasSelections) return;
    
    const interval = setInterval(() => {
      setDashOffset(prev => (prev + 1) % DASH_OFFSET_MODULO);
    }, MARCHING_ANTS_INTERVAL_MS);
    
    return () => clearInterval(interval);
  }, [copiedRange, highlightedCells, setDashOffset]);

  // Auto-scroll to keep selected cell in view
  useEffect(() => {
    if (!selection) return;
    scrollToCell(selection.start.row, selection.start.col, containerRef, zoom);
  }, [selection, zoom, containerRef]);
}
