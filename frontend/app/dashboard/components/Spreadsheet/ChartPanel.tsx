import { useState, useCallback, useRef, useEffect } from 'react';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import ChartRenderer from './ChartRenderer';
import type { ChartConfig } from './chartDataResolver';
import styles from './ChartPanel.module.css';

const EMPTY_CHARTS: ChartConfig[] = [];

export default function ChartPanel() {
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const charts = useSpreadsheetStore(state =>
    state.chartsBySheet.get(state.activeSheetId || '') || EMPTY_CHARTS
  );
  const removeChart = useSpreadsheetStore(state => state.removeChart);
  const setEditingChartId = useSpreadsheetStore(state => state.setEditingChartId);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);

  // Click outside any chart to deselect
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.${styles.overlay}`)) {
        setSelectedChartId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!activeSheetId || charts.length === 0) return null;

  return (
    <>
      {charts.map(chart => (
        <ChartOverlay
          key={chart.id}
          chart={chart}
          selected={selectedChartId === chart.id}
          onSelect={() => setSelectedChartId(chart.id)}
          onRemove={() => { setEditingChartId(null); removeChart(activeSheetId, chart.id); setSelectedChartId(null); }}
          onDoubleClick={() => setEditingChartId(chart.id)}
        />
      ))}
    </>
  );
}

type OverlayProps = {
  chart: ChartConfig;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDoubleClick: () => void;
};

function ChartOverlay({ chart, selected, onSelect, onRemove, onDoubleClick }: OverlayProps) {
  const [pos, setPos] = useState({ x: chart.position.x, y: chart.position.y });
  const [size, setSize] = useState({ width: chart.position.width, height: chart.position.height });
  const updateChart = useSpreadsheetStore(state => state.updateChart);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const posRef = useRef(pos);
  const sizeRef = useRef(size);
  posRef.current = pos;
  sizeRef.current = size;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    onSelect();
    if ((e.target as HTMLElement).closest(`.${styles.closeButton}`) ||
        (e.target as HTMLElement).closest(`.${styles.resizeHandle}`)) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
      });
    };
    const handleUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      if (activeSheetId) {
        updateChart(activeSheetId, chart.id, { position: { ...sizeRef.current, ...posRef.current } });
      }
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [pos, onSelect, activeSheetId, updateChart, chart.id]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.width, origH: size.height };

    const handleMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      setSize({
        width: Math.max(250, resizeRef.current.origW + (ev.clientX - resizeRef.current.startX)),
        height: Math.max(180, resizeRef.current.origH + (ev.clientY - resizeRef.current.startY)),
      });
    };
    const handleUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      if (activeSheetId) {
        updateChart(activeSheetId, chart.id, { position: { ...posRef.current, ...sizeRef.current } });
      }
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [size, activeSheetId, updateChart, chart.id]);

  return (
    <div
      className={`${styles.overlay} ${selected ? styles.selected : ''}`}
      style={{ left: pos.x, top: pos.y, width: size.width, height: size.height }}
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
    >
      {selected && (
        <button className={styles.closeButton} onClick={onRemove} title="Remove chart">×</button>
      )}
      <div className={styles.chartBody}>
        <ChartRenderer chart={chart} />
      </div>
      {selected && (
        <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />
      )}
    </div>
  );
}
