import { useEffect } from 'react';
import { SpreadsheetProvider, useSpreadsheetContext } from './SpreadsheetContext';
import { useSheetPersistence } from './useSheetPersistence';
import Toolbar from './Toolbar';
import FormulaBar from './FormulaBar';
import Grid from './Grid';
import SheetBar from './SheetBar';
import { getCellKey, determineCellType, a1ToRowCol } from './drawUtils';
import type { CellType, CellFormat, NumberFormatType } from './types';
import styles from './Spreadsheet.module.css';

interface SpreadsheetContentProps {
  onToolCall?: (handler: (name: string, args: any) => void) => void;
}

function SpreadsheetContent({ onToolCall }: SpreadsheetContentProps) {
  const spreadsheet = useSpreadsheetContext();
  
  // Hook handles auto-save and load on mount
  useSheetPersistence();
  
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
        spreadsheet.updateCell(cellKey, { raw: value, type: cellType });
      } else if (name === 'set_cell_range') {
        const { startCell, endCell, values } = args;
        if (!startCell || !endCell || !values) {
          return { error: 'Missing required arguments: startCell, endCell, or values' };
        }
        const start = a1ToRowCol(startCell);
        const end = a1ToRowCol(endCell);
        
        // Clone existing cellData to preserve all cells
        const mergedCellData = new Map(spreadsheet.cellData);
        
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
        spreadsheet.updateCells(mergedCellData);
      } else if (name === 'get_cell_range') {
        const { startCell, endCell } = args;
        if (!startCell || !endCell) {
          return { error: 'Missing required arguments: startCell or endCell' };
        }
        const start = a1ToRowCol(startCell);
        const end = a1ToRowCol(endCell);
        
        const result: string[][] = [];
        
        // Build 2D array from spreadsheet data
        for (let row = start.row; row <= end.row; row++) {
          const rowValues: string[] = [];
          for (let col = start.col; col <= end.col; col++) {
            const cellKey = getCellKey(row, col);
            const displayValue = spreadsheet.getDisplayValue(cellKey);
            rowValues.push(displayValue);
          }
          result.push(rowValues);
        }
        
        return result;
      } else if (name === 'format_cells') {
        const { formats } = args;
        if (!formats || !Array.isArray(formats)) {
          return { error: 'Missing or invalid required argument: formats (must be an array)' };
        }
        
        // Apply format to each cell (merge with existing format)
        for (const item of formats) {
          if (!item || typeof item !== 'object' || !item.cell) {
            continue;
          }
          
          const { row, col } = a1ToRowCol(item.cell);
          const cellKey = getCellKey(row, col);
          
          // Get existing format for this cell
          const existingFormat = spreadsheet.cellFormat.get(cellKey) || {};
          
          // Build new format object, merging with existing
          const newFormat: CellFormat = { ...existingFormat };
          
          if (item.bold !== undefined) newFormat.bold = item.bold;
          if (item.italic !== undefined) newFormat.italic = item.italic;
          if (item.fillColor !== undefined) newFormat.fillColor = item.fillColor;
          if (item.textColor !== undefined) newFormat.textColor = item.textColor;
          
          spreadsheet.updateCellFormat(cellKey, newFormat);
        }
      } else if (name === 'format_cell_range') {
        const { startCell, endCell, format } = args;
        if (!startCell || !endCell || !format || typeof format !== 'object') {
          return { error: 'Missing required arguments: startCell, endCell, or format' };
        }
        
        const start = a1ToRowCol(startCell);
        const end = a1ToRowCol(endCell);
        
        // Build format object from format properties
        const formatToApply: Partial<CellFormat> = {};
        if (format.bold !== undefined) formatToApply.bold = format.bold;
        if (format.italic !== undefined) formatToApply.italic = format.italic;
        if (format.fillColor !== undefined) formatToApply.fillColor = format.fillColor;
        if (format.textColor !== undefined) formatToApply.textColor = format.textColor;
        
        // Apply format to all cells in range
        for (let row = start.row; row <= end.row; row++) {
          for (let col = start.col; col <= end.col; col++) {
            const cellKey = getCellKey(row, col);
            const existingFormat = spreadsheet.cellFormat.get(cellKey) || {};
            const newFormat: CellFormat = { ...existingFormat, ...formatToApply };
            spreadsheet.updateCellFormat(cellKey, newFormat);
          }
        }
      }
    };
    
    onToolCall(handleToolCall);
  }, [onToolCall, spreadsheet]);
  
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
}

export default function Spreadsheet({ onToolCall }: SpreadsheetProps) {
  return (
    <SpreadsheetProvider>
      <SpreadsheetContent onToolCall={onToolCall} />
    </SpreadsheetProvider>
  );
}
