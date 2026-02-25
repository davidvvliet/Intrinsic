// Token types for the lexer
export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'CELL_REF'
  | 'RANGE'
  | 'FUNCTION'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'COLON'
  | 'EOF';

export type Token = {
  type: TokenType;
  value: string;
  position: number;
};

// Cell reference with optional absolute markers
export type CellRef = {
  col: number;
  row: number;
  absCol: boolean;
  absRow: boolean;
  sheet?: string;
};

// AST Node types
export type ASTNode =
  | NumberNode
  | StringNode
  | CellRefNode
  | RangeNode
  | BinaryOpNode
  | UnaryOpNode
  | FunctionNode;

export type NumberNode = {
  type: 'number';
  value: number;
};

export type StringNode = {
  type: 'string';
  value: string;
};

export type CellRefNode = {
  type: 'cellRef';
  ref: CellRef;
};

export type RangeNode = {
  type: 'range';
  start: CellRef;
  end: CellRef;
};

export type BinaryOpNode = {
  type: 'binaryOp';
  operator: string;
  left: ASTNode;
  right: ASTNode;
};

export type UnaryOpNode = {
  type: 'unaryOp';
  operator: string;
  operand: ASTNode;
};

export type FunctionNode = {
  type: 'function';
  name: string;
  args: ASTNode[];
};

// Operator precedence (higher = binds tighter)
export const OPERATOR_PRECEDENCE: Record<string, number> = {
  '=': 1,   // Comparison equals
  '<>': 1,
  '<': 1,
  '>': 1,
  '<=': 1,
  '>=': 1,
  '&': 2,   // String concatenation
  '+': 3,
  '-': 3,
  '*': 4,
  '/': 4,
  '^': 5,   // Exponentiation (right-associative)
};

export const RIGHT_ASSOCIATIVE = new Set(['^']);
