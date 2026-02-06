import { useEffect } from 'react';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { useFormulaEngine } from './useFormulaEngine';

/**
 * Hook that syncs the formula engine with the Zustand store.
 * Call this once from SpreadsheetContent to keep computedData in sync.
 */
export function useFormulaSync() {
  const cellData = useSpreadsheetStore(state => state.cellData);
  const setComputedData = useSpreadsheetStore(state => state.setComputedData);
  const setGetDisplayValue = useSpreadsheetStore(state => state.setGetDisplayValue);

  const { computedData, getDisplayValue } = useFormulaEngine(cellData);

  // Sync computedData to store
  useEffect(() => {
    setComputedData(computedData);
  }, [computedData, setComputedData]);

  // Sync getDisplayValue function to store
  useEffect(() => {
    setGetDisplayValue(getDisplayValue);
  }, [getDisplayValue, setGetDisplayValue]);

  return { computedData, getDisplayValue };
}
