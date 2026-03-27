import type { ComputedData, CellData } from './types';
import { getCellKey } from './drawUtils';

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'doughnut';

export type ChartConfig = {
  id: string;
  type: ChartType;
  title: string;
  dataRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  useFirstRowAsHeaders: boolean;
  useFirstColAsLabels: boolean;
  sheetId: string;
  position: { x: number; y: number; width: number; height: number };
};

export type ResolvedChartData = {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
  }[];
};

/**
 * Extracts computed cell values from a range and formats them for Chart.js.
 *
 * With useFirstRowAsHeaders + useFirstColAsLabels on a range like:
 *       A        B      C
 *  1  (empty)   Q1     Q2
 *  2  Revenue   100    200
 *  3  Cost       50     80
 *
 * Returns:
 *   labels: ["Q1", "Q2"]
 *   datasets: [
 *     { label: "Revenue", data: [100, 200] },
 *     { label: "Cost",    data: [50, 80] }
 *   ]
 */
export function resolveChartData(
  range: ChartConfig['dataRange'],
  computedData: ComputedData,
  cellData: CellData,
  useFirstRowAsHeaders: boolean,
  useFirstColAsLabels: boolean,
): ResolvedChartData {
  const { startRow, startCol, endRow, endCol } = range;

  const getValue = (row: number, col: number): string | number => {
    const key = getCellKey(row, col);
    const computed = computedData.get(key);
    if (computed) {
      if (computed.error) return '';
      if (computed.value === null || computed.value === undefined) return '';
      return computed.value as string | number;
    }
    const cell = cellData.get(key);
    if (!cell || !cell.raw) return '';
    const num = parseFloat(cell.raw);
    return isNaN(num) ? cell.raw : num;
  };

  const dataStartRow = useFirstRowAsHeaders ? startRow + 1 : startRow;
  const dataStartCol = useFirstColAsLabels ? startCol + 1 : startCol;

  // Labels from the header row
  const labels: string[] = [];
  if (useFirstRowAsHeaders) {
    for (let col = dataStartCol; col <= endCol; col++) {
      labels.push(String(getValue(startRow, col)));
    }
  } else {
    for (let col = dataStartCol; col <= endCol; col++) {
      labels.push(String(col - dataStartCol + 1));
    }
  }

  // Each data row becomes a dataset (series)
  const datasets: ResolvedChartData['datasets'] = [];
  for (let row = dataStartRow; row <= endRow; row++) {
    const seriesLabel = useFirstColAsLabels
      ? String(getValue(row, startCol))
      : `Series ${row - dataStartRow + 1}`;

    const data: number[] = [];
    for (let col = dataStartCol; col <= endCol; col++) {
      const val = getValue(row, col);
      data.push(typeof val === 'number' ? val : (parseFloat(String(val)) || 0));
    }

    datasets.push({ label: seriesLabel, data });
  }

  return { labels, datasets };
}
