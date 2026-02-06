import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { RefProvider } from './RefContext';
import { useSheetPersistence } from './useSheetPersistence';
import { useSelectionChange } from './useSelectionChange';
import { useFormulaSync } from './useFormulaSync';
import Toolbar from './Toolbar';
import FormulaBar from './FormulaBar';
import Grid from './Grid';
import SheetBar from './SheetBar';
import { getCellKey, determineCellType, a1ToRowCol } from './drawUtils';
import type { CellFormat } from './types';
import styles from './Spreadsheet.module.css';

interface SpreadsheetContentProps {
  onToolCall?: (handler: (name: string, args: any) => void) => void;
  onSelectionChange?: (range: string | null) => void;
}

function SpreadsheetContent({ onToolCall, onSelectionChange }: SpreadsheetContentProps) {
  // Get state and actions from store
  const selection = useSpreadsheetStore(state => state.selection);
  const setAnimatingRanges = useSpreadsheetStore(state => state.setAnimatingRanges);
  const updateCell = useSpreadsheetStore(state => state.updateCell);
  const updateCells = useSpreadsheetStore(state => state.updateCells);
  const updateCellFormat = useSpreadsheetStore(state => state.updateCellFormat);

  // Sync formula engine with store
  useFormulaSync();

  // Hook handles auto-save and load on mount
  useSheetPersistence();

  // Watch selection changes and notify parent
  useSelectionChange(selection, onSelectionChange);

  // Create tool execution handler
  useEffect(() => {
    if (!onToolCall) return;

    const handleToolCall = (name: string, args: any) => {
      // Validate args are not empty
      if (!args || Object.keys(args).length === 0) {
        return { error: 'Tool call arguments are missing or empty' };
      }

      if (name === 'set_cell_value') {
        const { cell, value } = args;
        if (!cell || value === undefined) {
          return { error: 'Missing required arguments: cell and value' };
        }
        const { row, col } = a1ToRowCol(cell);
        const cellKey = getCellKey(row, col);
        const cellType = determineCellType(value);

        // Add animation for single cell - force immediate render
        const range = { minRow: row, maxRow: row, minCol: col, maxCol: col };
        flushSync(() => {
          setAnimatingRanges(prev => [...prev, range]);
        });

        updateCell(cellKey, { raw: value, type: cellType });

        // Remove animation after delay
        setTimeout(() => {
          setAnimatingRanges(prev => prev.filter(r => r !== range));
        }, 2000);
      } else if (name === 'set_cell_range') {
        const { startCell, endCell, values } = args;
        if (!startCell || !endCell || !values) {
          return { error: 'Missing required arguments: startCell, endCell, or values' };
        }
        const start = a1ToRowCol(startCell);
        const end = a1ToRowCol(endCell);

        // Add animation for range - force immediate render
        const range = { minRow: start.row, maxRow: end.row, minCol: start.col, maxCol: end.col };
        flushSync(() => {
          setAnimatingRanges(prev => [...prev, range]);
        });

        // Clone existing cellData to preserve all cells
        const currentCellData = useSpreadsheetStore.getState().cellData;
        const mergedCellData = new Map(currentCellData);

        // Update only the range cells in the cloned Map
        for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
          const row = start.row + rowIdx;
          if (row > end.row) break;

          const rowValues = values[rowIdx];
          for (let colIdx = 0; colIdx < rowValues.length; colIdx++) {
            const col = start.col + colIdx;
            if (col > end.col) break;

            const value = rowValues[colIdx];
            const cellKey = getCellKey(row, col);
            const cellType = determineCellType(value);
            mergedCellData.set(cellKey, { raw: value, type: cellType });
          }
        }

        // Single bulk update with merged data (preserves all existing cells)
        updateCells(mergedCellData);

        // Remove animation after delay
        setTimeout(() => {
          setAnimatingRanges(prev => prev.filter(r => r !== range));
        }, 2000);
      } else if (name === 'get_cell_range') {
        const { startCell, endCell } = args;
        if (!startCell || !endCell) {
          return { error: 'Missing required arguments: startCell or endCell' };
        }
        const start = a1ToRowCol(startCell);
        const end = a1ToRowCol(endCell);

        const result: ({ value: string; raw?: string })[][] = [];
        const currentCellData = useSpreadsheetStore.getState().cellData;
        const currentGetDisplayValue = useSpreadsheetStore.getState().getDisplayValue;

        // Build 2D array from spreadsheet data
        for (let row = start.row; row <= end.row; row++) {
          const rowValues: ({ value: string; raw?: string })[] = [];
          for (let col = start.col; col <= end.col; col++) {
            const cellKey = getCellKey(row, col);
            const displayValue = currentGetDisplayValue(cellKey);
            const cell = currentCellData.get(cellKey);
            if (cell?.type === 'formula') {
              rowValues.push({ value: displayValue, raw: cell.raw });
            } else {
              rowValues.push({ value: displayValue });
            }
          }
          result.push(rowValues);
        }

        return result;
      } else if (name === 'format_cells') {
        const { formats } = args;
        if (!formats || !Array.isArray(formats)) {
          return { error: 'Missing or invalid required argument: formats (must be an array)' };
        }

        // Collect all cells being formatted for animation
        const animatingCells: Array<{ row: number; col: number }> = [];
        const currentCellFormat = useSpreadsheetStore.getState().cellFormat;

        // Apply format to each cell (merge with existing format)
        for (const item of formats) {
          if (!item || typeof item !== 'object' || !item.cell) {
            continue;
          }

          const { row, col } = a1ToRowCol(item.cell);
          const cellKey = getCellKey(row, col);
          animatingCells.push({ row, col });

          // Get existing format for this cell
          const existingFormat = currentCellFormat.get(cellKey) || {};

          // Build new format object, merging with existing
          const newFormat: CellFormat = { ...existingFormat };

          if (item.bold !== undefined) newFormat.bold = item.bold;
          if (item.italic !== undefined) newFormat.italic = item.italic;
          if (item.fillColor !== undefined) newFormat.fillColor = item.fillColor;
          if (item.textColor !== undefined) newFormat.textColor = item.textColor;

          updateCellFormat(cellKey, newFormat);
        }

        // Add animations for all affected cells (create bounding box)
        if (animatingCells.length > 0) {
          const minRow = Math.min(...animatingCells.map(c => c.row));
          const maxRow = Math.max(...animatingCells.map(c => c.row));
          const minCol = Math.min(...animatingCells.map(c => c.col));
          const maxCol = Math.max(...animatingCells.map(c => c.col));
          const range = { minRow, maxRow, minCol, maxCol };
          flushSync(() => {
            setAnimatingRanges(prev => [...prev, range]);
          });

          // Remove animation after delay
          setTimeout(() => {
            setAnimatingRanges(prev => prev.filter(r => r !== range));
          }, 2000);
        }
      } else if (name === 'format_cell_range') {
        const { startCell, endCell, format } = args;
        if (!startCell || !endCell || !format || typeof format !== 'object') {
          return { error: 'Missing required arguments: startCell, endCell, or format' };
        }

        const start = a1ToRowCol(startCell);
        const end = a1ToRowCol(endCell);

        // Add animation for range - force immediate render
        const range = { minRow: start.row, maxRow: end.row, minCol: start.col, maxCol: end.col };
        flushSync(() => {
          setAnimatingRanges(prev => [...prev, range]);
        });

        // Build format object from format properties
        const formatToApply: Partial<CellFormat> = {};
        if (format.bold !== undefined) formatToApply.bold = format.bold;
        if (format.italic !== undefined) formatToApply.italic = format.italic;
        if (format.fillColor !== undefined) formatToApply.fillColor = format.fillColor;
        if (format.textColor !== undefined) formatToApply.textColor = format.textColor;

        const currentCellFormat = useSpreadsheetStore.getState().cellFormat;

        // Apply format to all cells in range
        for (let row = start.row; row <= end.row; row++) {
          for (let col = start.col; col <= end.col; col++) {
            const cellKey = getCellKey(row, col);
            const existingFormat = currentCellFormat.get(cellKey) || {};
            const newFormat: CellFormat = { ...existingFormat, ...formatToApply };
            updateCellFormat(cellKey, newFormat);
          }
        }

        // Remove animation after delay
        setTimeout(() => {
          setAnimatingRanges(prev => prev.filter(r => r !== range));
        }, 2000);
      }
    };

    onToolCall(handleToolCall);
  }, [onToolCall, setAnimatingRanges, updateCell, updateCells, updateCellFormat]);

  return (
    <div className={styles.spreadsheet}>
      <Toolbar />
      <FormulaBar />
      <Grid />
      <SheetBar />
    </div>
  );
}

interface SpreadsheetProps {
  onToolCall?: (handler: (name: string, args: any) => void) => void;
  onSelectionChange?: (range: string | null) => void;
}

export default function Spreadsheet({ onToolCall, onSelectionChange }: SpreadsheetProps) {
  return (
    <RefProvider>
      <SpreadsheetContent onToolCall={onToolCall} onSelectionChange={onSelectionChange} />
    </RefProvider>
  );
}
