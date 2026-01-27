import { SpreadsheetProvider } from './SpreadsheetContext';
import Toolbar from './Toolbar';
import FormulaBar from './FormulaBar';
import Grid from './Grid';
import styles from './Spreadsheet.module.css';

export default function Spreadsheet() {
  return (
    <SpreadsheetProvider>
      <div className={styles.spreadsheet}>
        <Toolbar />
        <FormulaBar />
        <Grid />
      </div>
    </SpreadsheetProvider>
  );
}
