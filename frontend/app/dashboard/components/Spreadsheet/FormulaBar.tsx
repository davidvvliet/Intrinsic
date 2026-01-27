import { useSpreadsheetContext } from './SpreadsheetContext';
import { getColumnLabel } from './drawUtils';
import styles from './FormulaBar.module.css';

export default function FormulaBar() {
  const { selection, inputValue } = useSpreadsheetContext();

  // Format cell reference (e.g., "A1", "B5")
  const cellRef = selection
    ? `${getColumnLabel(selection.start.col)}${selection.start.row + 1}`
    : '';

  return (
    <div className={styles.formulaBar}>
      <div className={styles.formulaBarLabel}>{cellRef}</div>
      <div className={styles.formulaBarInput}>
        <span className={styles.fxLabel}>
          <span className={styles.fxF}>f</span>x
        </span>
        <span className={styles.formulaValue}>{inputValue}</span>
      </div>
    </div>
  );
}
