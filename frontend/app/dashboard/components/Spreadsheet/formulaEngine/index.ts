import { tokenize, TokenizerError } from './tokenizer';
import { parse, ParserError } from './parser';
import { safeEvaluate, type CellValueGetter } from './evaluator';
import type { ComputedValue } from '../types';
import type { ASTNode, CellRef } from './types';
import { cellRefToKey, expandRange, parseCellRef } from './cellRef';

// Re-export useful types and utilities
export { parseCellRef, cellRefToKey, expandRange } from './cellRef';
export type { CellRef, ASTNode } from './types';
export type { ComputedValue } from '../types';
export type { CellValueGetter } from './evaluator';

/**
 * Parse a formula string into an AST
 * Returns null if parsing fails
 */
export function parseFormula(formula: string): { ast: ASTNode } | { error: string } {
  try {
    const tokens = tokenize(formula);
    const ast = parse(tokens);
    return { ast };
  } catch (err) {
    if (err instanceof TokenizerError || err instanceof ParserError) {
      return { error: '#ERROR!' };
    }
    return { error: '#ERROR!' };
  }
}

/**
 * Evaluate a formula string and return the computed value
 * Main entry point for formula evaluation
 */
export function evaluateFormula(
  formula: string,
  getCellValue: CellValueGetter
): ComputedValue {
  try {
    const tokens = tokenize(formula);
    const ast = parse(tokens);
    return safeEvaluate(ast, getCellValue);
  } catch (err) {
    if (err instanceof TokenizerError) {
      return { value: null, error: '#ERROR!' };
    }
    if (err instanceof ParserError) {
      return { value: null, error: '#ERROR!' };
    }
    return { value: null, error: '#ERROR!' };
  }
}

/**
 * Extract all cell references from a formula (for dependency tracking)
 */
export function extractDependencies(formula: string): string[] {
  try {
    const tokens = tokenize(formula);
    const ast = parse(tokens);
    const deps = new Set<string>();
    collectDependencies(ast, deps);
    return Array.from(deps);
  } catch {
    return [];
  }
}

/**
 * Recursively collect cell dependencies from an AST
 */
function collectDependencies(node: ASTNode, deps: Set<string>): void {
  switch (node.type) {
    case 'cellRef':
      deps.add(cellRefToKey(node.ref));
      break;
    case 'range':
      // Add all cells in the range
      const keys = expandRange(node.start, node.end);
      keys.forEach(key => deps.add(key));
      break;
    case 'binaryOp':
      collectDependencies(node.left, deps);
      collectDependencies(node.right, deps);
      break;
    case 'unaryOp':
      collectDependencies(node.operand, deps);
      break;
    case 'function':
      node.args.forEach(arg => collectDependencies(arg, deps));
      break;
    // number and string have no dependencies
  }
}

/**
 * Check if a value is a formula (starts with =)
 */
export function isFormula(value: string): boolean {
  return value.startsWith('=');
}

/**
 * Adjust formula cell references when copying (handles relative/absolute refs)
 */
export function adjustFormulaReferences(
  formula: string,
  rowDelta: number,
  colDelta: number
): string {
  // Simple regex-based adjustment for cell references
  // This handles A1, $A1, A$1, $A$1 patterns
  return formula.replace(
    /(\$?)([A-Za-z]+)(\$?)(\d+)/g,
    (match, absCol, colLetters, absRow, rowDigits) => {
      const ref = parseCellRef(match);
      if (!ref) return match;

      // Adjust based on absolute markers
      const newCol = ref.absCol ? ref.col : ref.col + colDelta;
      const newRow = ref.absRow ? ref.row : ref.row + rowDelta;

      // Validate bounds (don't allow negative)
      if (newCol < 0 || newRow < 0) {
        return '#REF!';
      }

      // Rebuild the reference
      const colPart = ref.absCol ? '$' : '';
      const rowPart = ref.absRow ? '$' : '';
      
      // Convert column number back to letters
      let colStr = '';
      let c = newCol;
      while (c >= 0) {
        colStr = String.fromCharCode(65 + (c % 26)) + colStr;
        c = Math.floor(c / 26) - 1;
      }

      return `${colPart}${colStr}${rowPart}${newRow + 1}`;
    }
  );
}
