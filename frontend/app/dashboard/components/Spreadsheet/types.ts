export type CellType = 'text' | 'number' | 'formula';

export type CellFormat = {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  textColor?: string;
  fillColor?: string;
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
} | null;

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
