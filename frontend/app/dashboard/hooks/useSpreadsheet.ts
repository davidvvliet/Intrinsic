import { useEffect } from 'react';
import {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_DELTA,
  DASH_OFFSET_MODULO,
  MARCHING_ANTS_INTERVAL_MS,
} from '../components/Spreadsheet/config';
import type {
  Selection,
  CellPosition,
  CopiedRange,
} from '../components/Spreadsheet/types';

export function useSpreadsheet({
  canvasRef,
  containerRef,
  zoom,
  setZoom,
  isDragging,
  setIsDragging,
  setSelection,
  getCellFromEvent,
  drawGrid,
  copiedRange,
  setDashOffset,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  setSelection: React.Dispatch<React.SetStateAction<Selection>>;
  getCellFromEvent: (e: MouseEvent | React.MouseEvent) => CellPosition;
  drawGrid: () => void;
  copiedRange: CopiedRange;
  setDashOffset: React.Dispatch<React.SetStateAction<number>>;
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

  // Mouse drag selection
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const cell = getCellFromEvent(e);
      if (cell) {
        setSelection(prev => prev ? { start: prev.start, end: cell } : null);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, setIsDragging, getCellFromEvent, setSelection]);

  // Marching ants animation for copied range
  useEffect(() => {
    if (!copiedRange) return;
    
    const interval = setInterval(() => {
      setDashOffset(prev => (prev + 1) % DASH_OFFSET_MODULO);
    }, MARCHING_ANTS_INTERVAL_MS);
    
    return () => clearInterval(interval);
  }, [copiedRange, setDashOffset]);
}
