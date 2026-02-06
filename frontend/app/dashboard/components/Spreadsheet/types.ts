export type CellType = 'text' | 'number' | 'formula';

export type NumberFormatType = 
  | 'automatic'
  | 'text'
  | 'number'
  | 'percent'
  | 'scientific'
  | 'accounting'
  | 'financial'
  | 'currency'
  | 'currencyRounded'
  | 'date'
  | 'time'
  | 'datetime'
  | 'duration';

export type NumberFormatSettings = {
  type: NumberFormatType;
  decimals?: number;
  currencySymbol?: string;
  datePattern?: string;
};

export type CellFormat = {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  textColor?: string;
  fillColor?: string;
  numberFormat?: NumberFormatSettings;
};

export type CellValue = {
  raw: string;
  type: CellType;
};

export type CellData = Map<string, CellValue>;

export type CellFormatData = Map<string, CellFormat>;

export type CellPosition = {
  row: number;
  col: number;
} | null;

export type Selection = {
  start: { row: number; col: number };
  end: { row: number; col: number };
};

export type ScrollPosition = {
  left: number;
  top: number;
};

export type CopiedRange = {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
} | null;

// Formula engine types
export type ComputedValue = {
  value: number | string | boolean | null;
  error?: string;
};

export type ComputedData = Map<string, ComputedValue>;

// Undo/Redo types
export type DeltaEntry<T> = {
  old: T | null;
  new: T | null;
};

export type Action = {
  dataDelta: Map<string, DeltaEntry<CellValue>>;
  formatDelta: Map<string, DeltaEntry<CellFormat>>;
  timestamp: number;
};
