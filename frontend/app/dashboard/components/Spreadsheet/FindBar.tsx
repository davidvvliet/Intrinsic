import { useRef, useEffect, useCallback } from 'react';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import styles from './FindBar.module.css';

export default function FindBar() {
  const findOpen = useSpreadsheetStore(state => state.findOpen);
  const findQuery = useSpreadsheetStore(state => state.findQuery);
  const findMatches = useSpreadsheetStore(state => state.findMatches);
  const findMatchIndex = useSpreadsheetStore(state => state.findMatchIndex);
  const setFindOpen = useSpreadsheetStore(state => state.setFindOpen);
  const setFindQuery = useSpreadsheetStore(state => state.setFindQuery);
  const setFindMatches = useSpreadsheetStore(state => state.setFindMatches);
  const setFindMatchIndex = useSpreadsheetStore(state => state.setFindMatchIndex);
  const setSelection = useSpreadsheetStore(state => state.setSelection);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (findOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [findOpen]);

  // Focus input when Ctrl+F is pressed while find bar is already open
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && findOpen) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [findOpen]);

  const runSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setFindMatches([]);
      setFindMatchIndex(-1);
      return;
    }

    const state = useSpreadsheetStore.getState();
    const { cellData, getDisplayValue } = state;
    const lowerQuery = query.toLowerCase();
    const matches: { row: number; col: number }[] = [];

    cellData.forEach((_, key) => {
      const displayVal = getDisplayValue(key);
      if (displayVal && displayVal.toLowerCase().includes(lowerQuery)) {
        const [rowStr, colStr] = key.split(',');
        matches.push({ row: parseInt(rowStr), col: parseInt(colStr) });
      }
    });

    // Sort top-to-bottom, left-to-right
    matches.sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);

    setFindMatches(matches);
    if (matches.length > 0) {
      setFindMatchIndex(0);
      const { row, col } = matches[0];
      setSelection({ start: { row, col }, end: { row, col } });
    } else {
      setFindMatchIndex(-1);
    }
  }, [setFindMatches, setFindMatchIndex, setSelection]);

  const navigateMatch = useCallback((direction: 1 | -1) => {
    if (findMatches.length === 0) return;
    const next = (findMatchIndex + direction + findMatches.length) % findMatches.length;
    setFindMatchIndex(next);
    const { row, col } = findMatches[next];
    setSelection({ start: { row, col }, end: { row, col } });
  }, [findMatches, findMatchIndex, setFindMatchIndex, setSelection]);

  const handleClose = useCallback(() => {
    setFindOpen(false);
    setFindQuery('');
    setFindMatches([]);
    setFindMatchIndex(-1);
  }, [setFindOpen, setFindQuery, setFindMatches, setFindMatchIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigateMatch(e.shiftKey ? -1 : 1);
    }
  }, [handleClose, navigateMatch]);

  if (!findOpen) return null;

  return (
    <div className={styles.findBar}>
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        placeholder="Find..."
        value={findQuery}
        onChange={e => {
          setFindQuery(e.target.value);
          runSearch(e.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <span className={styles.matchCount}>
        {findQuery ? (findMatches.length > 0 ? `${findMatchIndex + 1} of ${findMatches.length}` : 'No matches') : ''}
      </span>
      <div className={styles.navButtons}>
        <button className={styles.navButton} onClick={() => navigateMatch(-1)} disabled={findMatches.length === 0} title="Previous (Shift+Enter)">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 9L7 5L11 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
        </button>
        <button className={styles.navButton} onClick={() => navigateMatch(1)} disabled={findMatches.length === 0} title="Next (Enter)">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
        </button>
      </div>
      <button className={styles.closeButton} onClick={handleClose} title="Close (Esc)">×</button>
    </div>
  );
}
