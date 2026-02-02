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
      if (name === 'set_cell_value') {
        const { cell, value } = args;
        const { row, col } = a1ToRowCol(cell);
        const cellKey = getCellKey(row, col);
        const cellType = determineCellType(value);
        spreadsheet.updateCell(cellKey, { raw: value, type: cellType });
      } else if (name === 'set_cell_range') {
        const { startCell, endCell, values } = args;
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
        
        // TODO: Send result back to backend for LLM to use
        console.log('[SPREADSHEET] get_cell_range result:', result);
      } else if (name === 'format_cells') {
        const { cells, format } = args;
        
        // Apply format to each cell (merge with existing format)
        for (const cellRef of cells) {
          const { row, col } = a1ToRowCol(cellRef);
          const cellKey = getCellKey(row, col);
          
          // Get existing format for this cell
          const existingFormat = spreadsheet.cellFormat.get(cellKey) || {};
          
          // Build new format object, merging with existing
          const newFormat: CellFormat = { ...existingFormat };
          
          if (format.bold !== undefined) newFormat.bold = format.bold;
          if (format.italic !== undefined) newFormat.italic = format.italic;
          if (format.fillColor !== undefined) newFormat.fillColor = format.fillColor;
          if (format.textColor !== undefined) newFormat.textColor = format.textColor;
          
          
          spreadsheet.updateCellFormat(cellKey, newFormat);
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
