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
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const addChart = useSpreadsheetStore(state => state.addChart);
  const setEditingChartId = useSpreadsheetStore(state => state.setEditingChartId);

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
    if (!selection || !activeSheetId) return;

    const id = `chart_${Date.now()}`;
    const chart: ChartConfig = {
      id,
      type: 'bar',
      title: '',
      dataRange: {
        startRow: Math.min(selection.start.row, selection.end.row),
        startCol: Math.min(selection.start.col, selection.end.col),
        endRow: Math.max(selection.start.row, selection.end.row),
        endCol: Math.max(selection.start.col, selection.end.col),
      },
      useFirstRowAsHeaders: true,
      useFirstColAsLabels: true,
      sheetId: activeSheetId,
      position: { x: 100, y: 100, width: 500, height: 350 },
    };

    addChart(chart);
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
            disabled={!selection}
          >
            <span className={styles.checkmark} />
            <span className={styles.optionLabel}>Chart</span>
          </button>
        </div>
      )}
    </>
  );
}
