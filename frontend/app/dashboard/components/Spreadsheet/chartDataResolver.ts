import type { ComputedData, CellData } from './types';
import { getCellKey } from './drawUtils';

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'doughnut';

export type ChartConfig = {
  id: string;
  type: ChartType;
  title: string;
  dataRanges: Array<{
    start: { row: number; col: number };
    end: { row: number; col: number };
  }>;
  useFirstRowAsHeaders: boolean;
  useFirstColAsLabels: boolean;
  sheetId: string;
  position: { x: number; y: number; width: number; height: number };
  xAxisLabel?: string;
  yAxisLabel?: string;
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
  dataRanges: ChartConfig['dataRanges'],
  computedData: ComputedData,
  cellData: CellData,
  useFirstRowAsHeaders: boolean,
  useFirstColAsLabels: boolean,
): ResolvedChartData {
  const labels: string[] = [];
  const datasets: ResolvedChartData['datasets'] = [];

  if (dataRanges.length === 0) {
    return { labels, datasets };
  }

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

  // Use first range for header extraction
  const firstRange = dataRanges[0];
  const firstRangeStartRow = firstRange.start.row;
  const firstRangeStartCol = firstRange.start.col;
  const firstRangeEndCol = firstRange.end.col;

  const dataStartCol = useFirstColAsLabels ? firstRangeStartCol + 1 : firstRangeStartCol;
  const headerRow = firstRangeStartRow;

  // Extract labels from first range's first row
  if (useFirstRowAsHeaders) {
    for (let col = dataStartCol; col <= firstRangeEndCol; col++) {
      labels.push(String(getValue(headerRow, col)));
    }
  } else {
    for (let col = dataStartCol; col <= firstRangeEndCol; col++) {
      labels.push(String(col - dataStartCol + 1));
    }
  }

  // Process each range to extract datasets
  for (const range of dataRanges) {
    const rangeStartRow = range.start.row;
    const rangeStartCol = range.start.col;
    const rangeEndRow = range.end.row;
    const rangeEndCol = range.end.col;

    // For the first range, skip the header row if useFirstRowAsHeaders is true
    const thisRangeDataStartRow = useFirstRowAsHeaders && range === firstRange
      ? rangeStartRow + 1
      : rangeStartRow;

    // Process each row in this range as a dataset
    for (let row = thisRangeDataStartRow; row <= rangeEndRow; row++) {
      const seriesLabel = useFirstColAsLabels
        ? String(getValue(row, rangeStartCol))
        : `Series ${datasets.length + 1}`;

      const data: number[] = [];
      for (let col = dataStartCol; col <= rangeEndCol; col++) {
        const val = getValue(row, col);
        data.push(typeof val === 'number' ? val : (parseFloat(String(val)) || 0));
      }

      datasets.push({ label: seriesLabel, data });
    }
  }

  return { labels, datasets };
}
