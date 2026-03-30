import { useEffect, useCallback } from 'react';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import type { ChartConfig, ChartType } from './chartDataResolver';
import styles from './ChartSettings.module.css';

const EMPTY_CHARTS: ChartConfig[] = [];

const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: 'bar', label: 'Bar' },
  { type: 'line', label: 'Line' },
  { type: 'pie', label: 'Pie' },
  { type: 'doughnut', label: 'Doughnut' },
  { type: 'scatter', label: 'Scatter' },
  { type: 'area', label: 'Area' },
];

export default function ChartSettings() {
  const editingChartId = useSpreadsheetStore(state => state.editingChartId);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const charts = useSpreadsheetStore(state =>
    state.chartsBySheet.get(state.activeSheetId || '') || EMPTY_CHARTS
  );
  const updateChart = useSpreadsheetStore(state => state.updateChart);
  const removeChart = useSpreadsheetStore(state => state.removeChart);
  const setEditingChartId = useSpreadsheetStore(state => state.setEditingChartId);

  const chart = charts.find(c => c.id === editingChartId);

  // Close on Escape
  useEffect(() => {
    if (!editingChartId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingChartId(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [editingChartId, setEditingChartId]);

  const handleDelete = useCallback(() => {
    if (!activeSheetId || !editingChartId) return;
    setEditingChartId(null);
    removeChart(activeSheetId, editingChartId);
  }, [activeSheetId, editingChartId, removeChart, setEditingChartId]);

  if (!editingChartId || !activeSheetId || !chart) return null;

  const update = (updates: Partial<ChartConfig>) => {
    updateChart(activeSheetId, editingChartId, updates);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Chart Settings</span>
        <button className={styles.closeButton} onClick={() => setEditingChartId(null)}>×</button>
      </div>

      <div className={styles.content}>
        <div className={styles.field}>
          <label className={styles.label}>Chart type</label>
          <div className={styles.typeGrid}>
            {CHART_TYPES.map(ct => (
              <button
                key={ct.type}
                className={`${styles.typeButton} ${chart.type === ct.type ? styles.typeButtonActive : ''}`}
                onClick={() => update({ type: ct.type })}
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
            value={chart.title}
            onChange={e => update({ title: e.target.value })}
            placeholder="Chart title (optional)"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>X-Axis Label</label>
          <input
            className={styles.input}
            value={chart.xAxisLabel || ''}
            onChange={e => update({ xAxisLabel: e.target.value })}
            placeholder="X-axis label (optional)"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Y-Axis Label</label>
          <input
            className={styles.input}
            value={chart.yAxisLabel || ''}
            onChange={e => update({ yAxisLabel: e.target.value })}
            placeholder="Y-axis label (optional)"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={chart.useFirstRowAsHeaders}
              onChange={e => update({ useFirstRowAsHeaders: e.target.checked })}
            />
            Use first row as headers
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={chart.useFirstColAsLabels}
              onChange={e => update({ useFirstColAsLabels: e.target.checked })}
            />
            Use first column as labels
          </label>
        </div>

        <div className={styles.field}>
          <button className={styles.deleteButton} onClick={handleDelete}>
            Delete chart
          </button>
        </div>
      </div>
    </div>
  );
}
