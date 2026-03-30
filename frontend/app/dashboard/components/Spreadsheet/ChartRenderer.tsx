import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import { useSpreadsheetStore } from '../../stores/spreadsheetStore';
import { resolveChartData, type ChartConfig } from './chartDataResolver';
import type { ComputedData, CellData } from './types';

// Register Chart.js components once
ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  Filler, Tooltip, Legend, Title,
);

const EMPTY_COMPUTED: ComputedData = new Map();
const EMPTY_CELLS: CellData = new Map();

const COLORS = [
  '#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D01',
  '#46BDC6', '#7B61FF', '#F538A0', '#00ACC1', '#FF7043',
];

type Props = {
  chart: ChartConfig;
};

export default function ChartRenderer({ chart }: Props) {
  const computedData = useSpreadsheetStore(state =>
    state.allSheetsComputed.get(chart.sheetId) || EMPTY_COMPUTED
  );
  const cellData = useSpreadsheetStore(state =>
    state.allSheetsData.get(chart.sheetId) || EMPTY_CELLS
  );

  // Migrate old single-range format to new multi-range format
  const dataRanges = chart.dataRanges || (
    (chart as any).dataRange
      ? [{
          start: { row: (chart as any).dataRange.startRow, col: (chart as any).dataRange.startCol },
          end: { row: (chart as any).dataRange.endRow, col: (chart as any).dataRange.endCol }
        }]
      : []
  );

  const resolved = useMemo(
    () => resolveChartData(
      dataRanges, computedData, cellData,
      chart.useFirstRowAsHeaders, chart.useFirstColAsLabels,
    ),
    [dataRanges, computedData, cellData, chart.useFirstRowAsHeaders, chart.useFirstColAsLabels],
  );

  const chartJsData = useMemo(() => ({
    labels: resolved.labels,
    datasets: resolved.datasets.map((ds, i) => ({
      ...ds,
      backgroundColor: chart.type === 'line' || chart.type === 'scatter'
        ? COLORS[i % COLORS.length]
        : chart.type === 'pie' || chart.type === 'doughnut'
          ? ds.data.map((_, j) => COLORS[j % COLORS.length])
          : COLORS[i % COLORS.length],
      borderColor: chart.type === 'line'
        ? COLORS[i % COLORS.length]
        : undefined,
      borderWidth: chart.type === 'line' ? 2 : 1,
      fill: chart.type === 'area',
    })),
  }), [resolved, chart.type]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: !!chart.title,
        text: chart.title,
        font: { size: 14, weight: 'bold' as const },
      },
      legend: {
        position: 'bottom' as const,
        labels: { font: { size: 11 } },
      },
    },
    scales: {
      x: {
        title: {
          display: !!chart.xAxisLabel,
          text: chart.xAxisLabel || '',
          font: { size: 12 },
        },
      },
      y: {
        title: {
          display: !!chart.yAxisLabel,
          text: chart.yAxisLabel || '',
          font: { size: 12 },
        },
      },
    },
  }), [chart.title, chart.xAxisLabel, chart.yAxisLabel]);

  switch (chart.type) {
    case 'bar':
      return <Bar data={chartJsData} options={options} />;
    case 'line':
    case 'area':
      return <Line data={chartJsData} options={options} />;
    case 'pie':
      return <Pie data={chartJsData} options={options} />;
    case 'doughnut':
      return <Doughnut data={chartJsData} options={options} />;
    case 'scatter':
      return <Scatter data={chartJsData as any} options={options} />;
    default:
      return <Bar data={chartJsData} options={options} />;
  }
}
