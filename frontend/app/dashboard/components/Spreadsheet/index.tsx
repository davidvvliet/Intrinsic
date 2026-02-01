import { SpreadsheetProvider } from './SpreadsheetContext';
import { useSheetPersistence } from './useSheetPersistence';
import Toolbar from './Toolbar';
import FormulaBar from './FormulaBar';
import Grid from './Grid';
import SheetBar from './SheetBar';
import styles from './Spreadsheet.module.css';

function SpreadsheetContent() {
  // Hook handles auto-save and load on mount
  useSheetPersistence();
  
  return (
    <div className={styles.spreadsheet}>
      <Toolbar />
      <FormulaBar />
      <Grid />
      <SheetBar />
    </div>
  );
}

export default function Spreadsheet() {
  return (
    <SpreadsheetProvider>
      <SpreadsheetContent />
    </SpreadsheetProvider>
  );
}
