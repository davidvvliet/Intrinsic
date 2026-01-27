import { useEffect } from 'react';

type Selection = {
  start: { row: number; col: number };
  end: { row: number; col: number };
} | null;

type CellPosition = { row: number; col: number } | null;

type CopiedRange = {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
} | null;

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
        const delta = e.deltaY > 0 ? -0.01 : 0.01;
        setZoom(prev => Math.min(4, Math.max(0.25, prev + delta)));
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
      setDashOffset(prev => (prev + 1) % 10);
    }, 80);
    
    return () => clearInterval(interval);
  }, [copiedRange, setDashOffset]);
}
