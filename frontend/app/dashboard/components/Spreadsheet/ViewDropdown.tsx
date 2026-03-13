import { useState, useRef, useEffect, useCallback } from 'react';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { getColumnLabel } from './drawUtils';
import styles from './FormatDropdown.module.css';
import viewStyles from './ViewDropdown.module.css';

export default function ViewDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [freezeHovered, setFreezeHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const freezeRowRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [submenuPosition, setSubmenuPosition] = useState({ top: 0, left: 0 });

  const selection = useSpreadsheetStore(state => state.selection);
  const frozenRows = useSpreadsheetStore(state => state.frozenRows);
  const frozenColumns = useSpreadsheetStore(state => state.frozenColumns);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const updateFrozenRows = useSpreadsheetStore(state => state.updateFrozenRows);
  const updateFrozenColumns = useSpreadsheetStore(state => state.updateFrozenColumns);
  const showGridlines = useSpreadsheetStore(state => state.showGridlines);
  const toggleGridlines = useSpreadsheetStore(state => state.toggleGridlines);

  // Position the dropdown below the button
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

  // Position the submenu next to the freeze row
  useEffect(() => {
    if (!freezeHovered || !freezeRowRef.current) return;
    const rowRect = freezeRowRef.current.getBoundingClientRect();
    setSubmenuPosition({ top: rowRect.top, left: rowRect.right });
  }, [freezeHovered]);

  // Close on outside click or escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        submenuRef.current && !submenuRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setFreezeHovered(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsOpen(false); setFreezeHovered(false); }
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

  const handleFreezeRows = useCallback((rows: number) => {
    if (activeSheetId) updateFrozenRows(activeSheetId, rows);
    setIsOpen(false);
    setFreezeHovered(false);
  }, [activeSheetId, updateFrozenRows]);

  const handleFreezeColumns = useCallback((cols: number) => {
    if (activeSheetId) updateFrozenColumns(activeSheetId, cols);
    setIsOpen(false);
    setFreezeHovered(false);
  }, [activeSheetId, updateFrozenColumns]);

  const currentRow = selection?.start.row ?? 0;
  const currentCol = selection?.start.col ?? 0;

  return (
    <>
      <button
        ref={buttonRef}
        className={styles.button}
        onMouseDown={preventFocusLoss}
        onClick={() => setIsOpen(o => !o)}
        title="View options"
      >
        <span className={styles.label}>View</span>
        <span className={styles.arrow}>▾</span>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          style={{ top: `${position.top}px`, left: `${position.left}px`, minWidth: 180 }}
          onMouseDown={preventFocusLoss}
        >
          {/* Show gridlines toggle */}
          <button
            className={styles.option}
            onClick={() => { toggleGridlines(); setIsOpen(false); }}
          >
            <span className={styles.checkmark}>{showGridlines ? '✓' : ''}</span>
            <span className={styles.optionLabel}>Show gridlines</span>
          </button>

          <div className={styles.separator} />

          {/* Freeze row with submenu */}
          <div
            ref={freezeRowRef}
            className={`${viewStyles.submenuRow} ${freezeHovered ? viewStyles.submenuRowHovered : ''}`}
            onMouseEnter={() => setFreezeHovered(true)}
            onMouseLeave={(e) => {
              // Stay open if moving into the submenu
              if (submenuRef.current?.contains(e.relatedTarget as Node)) return;
              setFreezeHovered(false);
            }}
          >
            <span className={viewStyles.submenuLabel}>Freeze</span>
            <span className={viewStyles.submenuArrow}>▶</span>
          </div>
        </div>
      )}

      {isOpen && freezeHovered && (
        <div
          ref={submenuRef}
          className={styles.dropdown}
          style={{ top: `${submenuPosition.top}px`, left: `${submenuPosition.left}px`, minWidth: 180 }}
          onMouseDown={preventFocusLoss}
          onMouseLeave={(e) => {
            if (freezeRowRef.current?.contains(e.relatedTarget as Node)) return;
            setFreezeHovered(false);
          }}
        >
          <div style={{ padding: '4px 0' }}>
            <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Rows</div>
            <button className={`${styles.option} ${frozenRows === 0 ? styles.selected : ''}`} onClick={() => handleFreezeRows(0)}>
              <span className={styles.checkmark}>{frozenRows === 0 ? '✓' : ''}</span>
              <span className={styles.optionLabel}>No rows</span>
            </button>
            <button className={`${styles.option} ${frozenRows === 1 ? styles.selected : ''}`} onClick={() => handleFreezeRows(1)}>
              <span className={styles.checkmark}>{frozenRows === 1 ? '✓' : ''}</span>
              <span className={styles.optionLabel}>1 row</span>
            </button>
            <button className={`${styles.option} ${frozenRows === 2 ? styles.selected : ''}`} onClick={() => handleFreezeRows(2)}>
              <span className={styles.checkmark}>{frozenRows === 2 ? '✓' : ''}</span>
              <span className={styles.optionLabel}>2 rows</span>
            </button>
            {selection && currentRow > 0 && (
              <button className={`${styles.option} ${frozenRows === currentRow + 1 ? styles.selected : ''}`} onClick={() => handleFreezeRows(currentRow + 1)}>
                <span className={styles.checkmark}>{frozenRows === currentRow + 1 ? '✓' : ''}</span>
                <span className={styles.optionLabel}>Up to row <strong>{currentRow + 1}</strong></span>
              </button>
            )}
          </div>

          <div className={styles.separator} />

          <div style={{ padding: '4px 0' }}>
            <div style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Columns</div>
            <button className={`${styles.option} ${frozenColumns === 0 ? styles.selected : ''}`} onClick={() => handleFreezeColumns(0)}>
              <span className={styles.checkmark}>{frozenColumns === 0 ? '✓' : ''}</span>
              <span className={styles.optionLabel}>No columns</span>
            </button>
            <button className={`${styles.option} ${frozenColumns === 1 ? styles.selected : ''}`} onClick={() => handleFreezeColumns(1)}>
              <span className={styles.checkmark}>{frozenColumns === 1 ? '✓' : ''}</span>
              <span className={styles.optionLabel}>1 column</span>
            </button>
            <button className={`${styles.option} ${frozenColumns === 2 ? styles.selected : ''}`} onClick={() => handleFreezeColumns(2)}>
              <span className={styles.checkmark}>{frozenColumns === 2 ? '✓' : ''}</span>
              <span className={styles.optionLabel}>2 columns</span>
            </button>
            {selection && currentCol > 0 && (
              <button className={`${styles.option} ${frozenColumns === currentCol + 1 ? styles.selected : ''}`} onClick={() => handleFreezeColumns(currentCol + 1)}>
                <span className={styles.checkmark}>{frozenColumns === currentCol + 1 ? '✓' : ''}</span>
                <span className={styles.optionLabel}>Up to column <strong>{getColumnLabel(currentCol)}</strong></span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
