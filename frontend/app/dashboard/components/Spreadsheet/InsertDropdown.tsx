import { useState, useRef, useEffect, useCallback } from 'react';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import type { ChartConfig } from './chartDataResolver';
import styles from './FormatDropdown.module.css';

export default function InsertDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const selection = useSpreadsheetStore(state => state.selection);
  const selectedRanges = useSpreadsheetStore(state => state.selectedRanges);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const addChart = useSpreadsheetStore(state => state.addChart);
  const setEditingChartId = useSpreadsheetStore(state => state.setEditingChartId);
  const clearSelectedRanges = useSpreadsheetStore(state => state.clearSelectedRanges);

  // Position the dropdown directly below the button when it opens
  useEffect(() => {
    if (!isOpen || !buttonRef.current || !dropdownRef.current) return;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const dropdownRect = dropdownRef.current.getBoundingClientRect();
    let top = buttonRect.bottom + 4;
    let left = buttonRect.left;
    if (left + dropdownRect.width > window.innerWidth) {
      left = window.innerWidth - dropdownRect.width - 8;
    }
    if (top + dropdownRect.height > window.innerHeight) {
      top = buttonRect.top - dropdownRect.height - 4;
    }
    setPosition({ top, left });
  }, [isOpen]);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const preventFocusLoss = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleInsertChart = () => {
    setIsOpen(false);
    if (!activeSheetId) return;

    const selectionAsRange = selection ? [{
      start: { row: Math.min(selection.start.row, selection.end.row), col: Math.min(selection.start.col, selection.end.col) },
      end: { row: Math.max(selection.start.row, selection.end.row), col: Math.max(selection.start.col, selection.end.col) },
    }] : [];

    // Combine locked ranges with current selection (like Google Sheets)
    const ranges = selectedRanges.length > 0
      ? [...selectedRanges, ...selectionAsRange]
      : selectionAsRange;

    if (!ranges || ranges.length === 0) return;

    const id = `chart_${Date.now()}`;
    const chart: ChartConfig = {
      id,
      type: 'bar',
      title: '',
      dataRanges: ranges,
      useFirstRowAsHeaders: true,
      useFirstColAsLabels: true,
      sheetId: activeSheetId,
      position: { x: 100, y: 100, width: 500, height: 350 },
      xAxisLabel: '',
      yAxisLabel: '',
    };

    addChart(chart);
    clearSelectedRanges();
    setEditingChartId(id);
  };

  return (
    <>
      <button
        ref={buttonRef}
        className={styles.button}
        onMouseDown={preventFocusLoss}
        onClick={() => setIsOpen(o => !o)}
        title="Insert"
      >
        <span className={styles.label}>Insert</span>
        <span className={styles.arrow}>▾</span>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          style={{ top: `${position.top}px`, left: `${position.left}px`, minWidth: 180 }}
          onMouseDown={preventFocusLoss}
        >
          <button
            className={styles.option}
            onClick={handleInsertChart}
            disabled={!selection && selectedRanges.length === 0}
          >
            <span className={styles.checkmark} />
            <span className={styles.optionLabel}>Chart</span>
          </button>
        </div>
      )}
    </>
  );
}
