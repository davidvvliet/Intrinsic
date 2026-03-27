import { useState, useEffect, useCallback } from 'react';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import ChartRenderer from './ChartRenderer';
import type { ChartConfig, ChartType } from './chartDataResolver';
import styles from './ChartDialog.module.css';

const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: 'bar', label: 'Bar' },
  { type: 'line', label: 'Line' },
  { type: 'pie', label: 'Pie' },
  { type: 'doughnut', label: 'Doughnut' },
  { type: 'scatter', label: 'Scatter' },
  { type: 'area', label: 'Area' },
];

export default function ChartDialog() {
  const chartDialogOpen = useSpreadsheetStore(state => state.chartDialogOpen);
  const setChartDialogOpen = useSpreadsheetStore(state => state.setChartDialogOpen);
  const addChart = useSpreadsheetStore(state => state.addChart);
  const selection = useSpreadsheetStore(state => state.selection);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);

  const [chartType, setChartType] = useState<ChartType>('bar');
  const [useHeaders, setUseHeaders] = useState(true);
  const [useLabels, setUseLabels] = useState(true);
  const [title, setTitle] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (chartDialogOpen) {
      setChartType('bar');
      setUseHeaders(true);
      setUseLabels(true);
      setTitle('');
    }
  }, [chartDialogOpen]);

  const handleClose = useCallback(() => {
    setChartDialogOpen(false);
  }, [setChartDialogOpen]);

  // Close on Escape
  useEffect(() => {
    if (!chartDialogOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [chartDialogOpen, handleClose]);

  if (!chartDialogOpen || !selection || !activeSheetId) return null;

  const dataRange = {
    startRow: Math.min(selection.start.row, selection.end.row),
    startCol: Math.min(selection.start.col, selection.end.col),
    endRow: Math.max(selection.start.row, selection.end.row),
    endCol: Math.max(selection.start.col, selection.end.col),
  };

  // Preview chart config (not yet saved)
  const previewConfig: ChartConfig = {
    id: 'preview',
    type: chartType,
    title,
    dataRange,
    useFirstRowAsHeaders: useHeaders,
    useFirstColAsLabels: useLabels,
    sheetId: activeSheetId,
    position: { x: 100, y: 100, width: 500, height: 350 },
  };

  const handleInsert = () => {
    const chart: ChartConfig = {
      ...previewConfig,
      id: `chart_${Date.now()}`,
    };
    addChart(chart);
    setChartDialogOpen(false);
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={handleClose}>×</button>
        <h3 className={styles.title}>Insert Chart</h3>

        <div className={styles.body}>
          <div className={styles.sidebar}>
            <div className={styles.field}>
              <label className={styles.label}>Chart type</label>
              <div className={styles.typeGrid}>
                {CHART_TYPES.map(ct => (
                  <button
                    key={ct.type}
                    className={`${styles.typeButton} ${chartType === ct.type ? styles.typeButtonActive : ''}`}
                    onClick={() => setChartType(ct.type)}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Title</label>
              <input
                className={styles.input}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Chart title (optional)"
              />
            </div>

            <div className={styles.checkboxGroup}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={useHeaders}
                  onChange={e => setUseHeaders(e.target.checked)}
                />
                Use first row as headers
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={useLabels}
                  onChange={e => setUseLabels(e.target.checked)}
                />
                Use first column as labels
              </label>
            </div>
          </div>

          <div className={styles.preview}>
            <ChartRenderer chart={previewConfig} />
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={handleClose}>Cancel</button>
          <button className={styles.insertButton} onClick={handleInsert}>Insert</button>
        </div>
      </div>
    </div>
  );
}
