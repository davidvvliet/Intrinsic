import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { RefProvider } from './RefContext';
import { useSheetPersistence } from './useSheetPersistence';
import { useSelectionChange } from './useSelectionChange';
import Toolbar from './Toolbar';
import FormulaBar from './FormulaBar';
import Grid from './Grid';
import SheetBar from './SheetBar';
import FindBar from './FindBar';

import { getCellKey, parseInputValue, a1ToRowCol } from './drawUtils';
import { colToLetter } from './formulaEngine/cellRef';
import type { CellFormat } from './types';
import type { ChartConfig, ChartType } from './chartDataResolver';
import { CELL_HEIGHT, CELL_WIDTH, HEADER_WIDTH, HEADER_HEIGHT } from './config';
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
  const setSheetCellData = useSpreadsheetStore(state => state.setSheetCellData);
  const setSheetCellFormat = useSpreadsheetStore(state => state.setSheetCellFormat);
  const markSheetDirty = useSpreadsheetStore(state => state.markSheetDirty);

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
        const { cell, value, sheet } = args;
        if (!cell || value === undefined) {
          return { error: 'Missing required arguments: cell and value' };
        }
        const { row, col } = a1ToRowCol(cell);
        const cellKey = getCellKey(row, col);
        const parsed = parseInputValue(value);

        // Resolve target sheet
        const storeState = useSpreadsheetStore.getState();
        const targetSheet = sheet ? storeState.sheets.find(s => s.name === sheet) : null;
        const isOtherSheet = targetSheet && targetSheet.sheetId !== storeState.activeSheetId;

        if (isOtherSheet) {
          // Write to allSheetsData directly
          const sheetData = new Map(storeState.allSheetsData.get(targetSheet.sheetId) || new Map());
          sheetData.set(cellKey, { raw: parsed.value, type: parsed.type });
          setSheetCellData(targetSheet.sheetId, sheetData);
          markSheetDirty(targetSheet.sheetId);

          // Handle format for other sheet
          const sheetFormat = new Map(storeState.allSheetsFormat.get(targetSheet.sheetId) || new Map());
          const trimmed = value.trim();
          const existingFormat = sheetFormat.get(cellKey) || {};
          if (trimmed.endsWith('%')) {
            sheetFormat.set(cellKey, { ...existingFormat, numberFormat: { type: 'percent' } });
            setSheetCellFormat(targetSheet.sheetId, sheetFormat);
          } else if (/^[\$£€¥]/.test(trimmed)) {
            sheetFormat.set(cellKey, { ...existingFormat, numberFormat: { type: 'currency' } });
            setSheetCellFormat(targetSheet.sheetId, sheetFormat);
          } else if (parsed.type === 'number') {
            sheetFormat.set(cellKey, { ...existingFormat, numberFormat: undefined });
            setSheetCellFormat(targetSheet.sheetId, sheetFormat);
          }
        } else {
          // Active sheet - use existing logic with animation
          const range = { minRow: row, maxRow: row, minCol: col, maxCol: col };
          flushSync(() => {
            setAnimatingRanges(prev => [...prev, range]);
          });

          updateCell(cellKey, { raw: parsed.value, type: parsed.type });

          const trimmed = value.trim();
          const currentCellFormat = storeState.cellFormat;
          const existingFormat = currentCellFormat.get(cellKey) || {};
          if (trimmed.endsWith('%')) {
            updateCellFormat(cellKey, { ...existingFormat, numberFormat: { type: 'percent' } });
          } else if (/^[\$£€¥]/.test(trimmed)) {
            updateCellFormat(cellKey, { ...existingFormat, numberFormat: { type: 'currency' } });
          } else if (parsed.type === 'number') {
            updateCellFormat(cellKey, { ...existingFormat, numberFormat: undefined });
          }

          setTimeout(() => {
            setAnimatingRanges(prev => prev.filter(r => r !== range));
          }, 5000);
        }
      } else if (name === 'set_cell_range') {
        const { startCell, endCell, values, sheet } = args;
        if (!startCell || !endCell || !values) {
          return { error: 'Missing required arguments: startCell, endCell, or values' };
        }
        const start = a1ToRowCol(startCell);
        const end = a1ToRowCol(endCell);

        const storeState = useSpreadsheetStore.getState();
        const targetSheet = sheet ? storeState.sheets.find(s => s.name === sheet) : null;
        const isOtherSheet = targetSheet && targetSheet.sheetId !== storeState.activeSheetId;

        const sourceCellData = isOtherSheet
          ? (storeState.allSheetsData.get(targetSheet.sheetId) || new Map())
          : storeState.cellData;
        const sourceCellFormat = isOtherSheet
          ? (storeState.allSheetsFormat.get(targetSheet.sheetId) || new Map())
          : storeState.cellFormat;

        const mergedCellData = new Map(sourceCellData);
        const mergedCellFormat = new Map(sourceCellFormat);
        const formatUpdates: Array<{ cellKey: string; format: CellFormat }> = [];

        for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
          const row = start.row + rowIdx;
          if (row > end.row) break;

          const rowValues = values[rowIdx];
          for (let colIdx = 0; colIdx < rowValues.length; colIdx++) {
            const col = start.col + colIdx;
            if (col > end.col) break;

            const value = rowValues[colIdx];
            const cellKey = getCellKey(row, col);
            const parsed = parseInputValue(value);
            mergedCellData.set(cellKey, { raw: parsed.value, type: parsed.type });

            const trimmed = value.trim();
            const existingFormat = sourceCellFormat.get(cellKey) || {};
            if (trimmed.endsWith('%')) {
              formatUpdates.push({ cellKey, format: { ...existingFormat, numberFormat: { type: 'percent' } } });
            } else if (/^[\$£€¥]/.test(trimmed)) {
              formatUpdates.push({ cellKey, format: { ...existingFormat, numberFormat: { type: 'currency' } } });
            } else if (parsed.type === 'number') {
              formatUpdates.push({ cellKey, format: { ...existingFormat, numberFormat: undefined } });
            }
          }
        }

        if (isOtherSheet) {
          for (const { cellKey, format } of formatUpdates) {
            mergedCellFormat.set(cellKey, format);
          }
          setSheetCellData(targetSheet.sheetId, mergedCellData);
          setSheetCellFormat(targetSheet.sheetId, mergedCellFormat);
          markSheetDirty(targetSheet.sheetId);
        } else {
          const range = { minRow: start.row, maxRow: end.row, minCol: start.col, maxCol: end.col };
          flushSync(() => {
            setAnimatingRanges(prev => [...prev, range]);
          });

          updateCells(mergedCellData);
          for (const { cellKey, format } of formatUpdates) {
            updateCellFormat(cellKey, format);
          }

          setTimeout(() => {
            setAnimatingRanges(prev => prev.filter(r => r !== range));
          }, 5000);
        }
      } else if (name === 'get_cell_range') {
        const { startCell, endCell } = args;
        if (!startCell || !endCell) {
          return { error: 'Missing required arguments: startCell or endCell' };
        }
        const start = a1ToRowCol(startCell);
        const end = a1ToRowCol(endCell);

        const storeState = useSpreadsheetStore.getState();
        let targetCellData = storeState.cellData;
        let targetSheetId = storeState.activeSheetId;

        // If targeting a different sheet, read from allSheetsData
        if (args.sheet) {
          const targetSheet = storeState.sheets.find(s => s.name === args.sheet);
          if (targetSheet && targetSheet.sheetId !== storeState.activeSheetId) {
            targetCellData = storeState.allSheetsData.get(targetSheet.sheetId) || new Map();
            targetSheetId = targetSheet.sheetId;
          }
        }

        const targetComputed = storeState.allSheetsComputed.get(targetSheetId || '') || new Map();

        const result: { cell: string; value: string; raw?: string; type?: string }[] = [];

        for (let row = start.row; row <= end.row; row++) {
          for (let col = start.col; col <= end.col; col++) {
            const cellKey = getCellKey(row, col);
            const cellRef = `${colToLetter(col)}${row + 1}`;
            const computed = targetComputed.get(cellKey);
            let displayValue: string;
            if (computed !== undefined) {
              if (computed.error) {
                displayValue = computed.error;
              } else if (computed.value === null || computed.value === undefined) {
                displayValue = '';
              } else {
                displayValue = String(computed.value);
              }
            } else {
              displayValue = targetCellData.get(cellKey)?.raw || '';
            }
            const cell = targetCellData.get(cellKey);
            const entry: { cell: string; value: string; raw?: string; type?: string } = { cell: cellRef, value: displayValue };
            if (cell?.type === 'formula') {
              entry.raw = cell.raw;
              entry.type = 'formula';
            }
            result.push(entry);
          }
        }

        return result;
      } else if (name === 'format_cells') {
        const { formats, sheet } = args;
        if (!formats || !Array.isArray(formats)) {
          return { error: 'Missing or invalid required argument: formats (must be an array)' };
        }

        const storeState = useSpreadsheetStore.getState();
        const targetSheet = sheet ? storeState.sheets.find(s => s.name === sheet) : null;
        const isOtherSheet = targetSheet && targetSheet.sheetId !== storeState.activeSheetId;

        const sourceCellFormat = isOtherSheet
          ? (storeState.allSheetsFormat.get(targetSheet.sheetId) || new Map())
          : storeState.cellFormat;

        const animatingCells: Array<{ row: number; col: number }> = [];
        const mergedCellFormat = isOtherSheet ? new Map(sourceCellFormat) : null;

        for (const item of formats) {
          if (!item || typeof item !== 'object' || !item.cell) {
            continue;
          }

          const { row, col } = a1ToRowCol(item.cell);
          const cellKey = getCellKey(row, col);
          animatingCells.push({ row, col });

          const existingFormat = sourceCellFormat.get(cellKey) || {};
          const newFormat: CellFormat = { ...existingFormat };

          if (item.bold !== undefined) newFormat.bold = item.bold;
          if (item.italic !== undefined) newFormat.italic = item.italic;
          if (item.fillColor !== undefined) newFormat.fillColor = item.fillColor;
          if (item.textColor !== undefined) newFormat.textColor = item.textColor;

          if (isOtherSheet) {
            mergedCellFormat!.set(cellKey, newFormat);
          } else {
            updateCellFormat(cellKey, newFormat);
          }
        }

        if (isOtherSheet) {
          setSheetCellFormat(targetSheet.sheetId, mergedCellFormat!);
        } else if (animatingCells.length > 0) {
          const minRow = Math.min(...animatingCells.map(c => c.row));
          const maxRow = Math.max(...animatingCells.map(c => c.row));
          const minCol = Math.min(...animatingCells.map(c => c.col));
          const maxCol = Math.max(...animatingCells.map(c => c.col));
          const range = { minRow, maxRow, minCol, maxCol };
          flushSync(() => {
            setAnimatingRanges(prev => [...prev, range]);
          });

          setTimeout(() => {
            setAnimatingRanges(prev => prev.filter(r => r !== range));
          }, 5000);
        }
      } else if (name === 'format_cell_range') {
        const { startCell, endCell, format, sheet } = args;
        if (!startCell || !endCell || !format || typeof format !== 'object') {
          return { error: 'Missing required arguments: startCell, endCell, or format' };
        }

        const start = a1ToRowCol(startCell);
        const end = a1ToRowCol(endCell);

        const storeState = useSpreadsheetStore.getState();
        const targetSheet = sheet ? storeState.sheets.find(s => s.name === sheet) : null;
        const isOtherSheet = targetSheet && targetSheet.sheetId !== storeState.activeSheetId;

        const formatToApply: Partial<CellFormat> = {};
        if (format.bold !== undefined) formatToApply.bold = format.bold;
        if (format.italic !== undefined) formatToApply.italic = format.italic;
        if (format.fillColor !== undefined) formatToApply.fillColor = format.fillColor;
        if (format.textColor !== undefined) formatToApply.textColor = format.textColor;

        const sourceCellFormat = isOtherSheet
          ? (storeState.allSheetsFormat.get(targetSheet.sheetId) || new Map())
          : storeState.cellFormat;

        if (isOtherSheet) {
          const mergedCellFormat = new Map(sourceCellFormat);
          for (let row = start.row; row <= end.row; row++) {
            for (let col = start.col; col <= end.col; col++) {
              const cellKey = getCellKey(row, col);
              const existingFormat = sourceCellFormat.get(cellKey) || {};
              mergedCellFormat.set(cellKey, { ...existingFormat, ...formatToApply });
            }
          }
          setSheetCellFormat(targetSheet.sheetId, mergedCellFormat);
        } else {
          const range = { minRow: start.row, maxRow: end.row, minCol: start.col, maxCol: end.col };
          flushSync(() => {
            setAnimatingRanges(prev => [...prev, range]);
          });

          for (let row = start.row; row <= end.row; row++) {
            for (let col = start.col; col <= end.col; col++) {
              const cellKey = getCellKey(row, col);
              const existingFormat = sourceCellFormat.get(cellKey) || {};
              updateCellFormat(cellKey, { ...existingFormat, ...formatToApply });
            }
          }

          setTimeout(() => {
            setAnimatingRanges(prev => prev.filter(r => r !== range));
          }, 5000);
        }
      } else if (name === 'find_cells') {
        const { query, sheet } = args;
        if (!query) {
          return { error: 'Missing required argument: query' };
        }

        const storeState = useSpreadsheetStore.getState();
        const targetSheet = sheet ? storeState.sheets.find(s => s.name === sheet) : null;
        const isOtherSheet = targetSheet && targetSheet.sheetId !== storeState.activeSheetId;

        const sourceCellData = isOtherSheet
          ? (storeState.allSheetsData.get(targetSheet.sheetId) || new Map())
          : storeState.cellData;

        const lowerQuery = query.toLowerCase();
        const results: { cell: string; value: string }[] = [];

        sourceCellData.forEach((_: any, key: string) => {
          const displayVal = storeState.getDisplayValue(key);
          if (displayVal && displayVal.toLowerCase().includes(lowerQuery)) {
            const [rowStr, colStr] = key.split(',');
            const row = parseInt(rowStr);
            const col = parseInt(colStr);
            const cellRef = `${colToLetter(col)}${row + 1}`;
            results.push({ cell: cellRef, value: displayVal });
          }
        });

        return results;
      } else if (name === 'insert_chart') {
        const { startCell, endCell, type, title, useFirstRowAsHeaders, useFirstColAsLabels, positionCell } = args;
        if (!startCell || !endCell) {
          return { error: 'Missing required arguments: startCell and endCell' };
        }

        const start = a1ToRowCol(startCell);
        const end = a1ToRowCol(endCell);
        const storeState = useSpreadsheetStore.getState();
        const activeSheet = storeState.activeSheetId;
        if (!activeSheet) return { error: 'No active sheet' };

        // Calculate pixel position from positionCell or default to right of data range
        let posX: number;
        let posY: number;
        if (positionCell) {
          const pos = a1ToRowCol(positionCell);
          posX = HEADER_WIDTH + pos.col * CELL_WIDTH;
          posY = HEADER_HEIGHT + pos.row * CELL_HEIGHT;
        } else {
          posX = HEADER_WIDTH + (end.col + 1) * CELL_WIDTH;
          posY = HEADER_HEIGHT + start.row * CELL_HEIGHT;
        }

        const chart: ChartConfig = {
          id: `chart_${Date.now()}`,
          type: (type as ChartType) || 'bar',
          title: title || '',
          dataRange: {
            startRow: start.row,
            startCol: start.col,
            endRow: end.row,
            endCol: end.col,
          },
          useFirstRowAsHeaders: useFirstRowAsHeaders !== false,
          useFirstColAsLabels: useFirstColAsLabels !== false,
          sheetId: activeSheet,
          position: { x: posX, y: posY, width: 500, height: 350 },
        };

        storeState.addChart(chart);
        return { status: 'success', chartId: chart.id };
      }
    };

    onToolCall(handleToolCall);
  }, [onToolCall, setAnimatingRanges, updateCell, updateCells, updateCellFormat, setSheetCellData, setSheetCellFormat, markSheetDirty]);

  return (
    <div className={styles.spreadsheet}>
      <Toolbar />
      <FormulaBar />
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <FindBar />
        <Grid />
      </div>
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
