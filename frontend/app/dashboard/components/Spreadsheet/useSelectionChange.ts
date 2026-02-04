import { useEffect } from 'react';
import type { Selection } from './types';
import { getColumnLabel } from './drawUtils';

export function useSelectionChange(
  selection: Selection | null,
  onSelectionChange?: (range: string | null) => void
) {
  useEffect(() => {
    if (!onSelectionChange) return;
    
    if (!selection) {
      onSelectionChange(null);
      return;
    }
    
    // Convert selection to A1 notation
    const startCol = getColumnLabel(selection.start.col);
    const startRow = selection.start.row + 1;
    
    if (selection.start.row === selection.end.row && selection.start.col === selection.end.col) {
      // Single cell - don't show selection display
      onSelectionChange(null);
    } else {
      // Range - show selection display
      const endCol = getColumnLabel(selection.end.col);
      const endRow = selection.end.row + 1;
      onSelectionChange(`${startCol}${startRow}:${endCol}${endRow}`);
    }
  }, [selection, onSelectionChange]);
}
