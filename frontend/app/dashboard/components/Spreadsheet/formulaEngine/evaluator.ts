import type { ASTNode } from './types';
import type { ComputedValue } from '../types';
// cellRefToKey and expandRange handled inline for cross-sheet support
import { callFunction, FormulaFunctionError } from './functions';
import type { FunctionArgs, FunctionResult } from './functions';

export class EvaluatorError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'EvaluatorError';
    this.code = code;
  }
}

/**
 * Cell value getter function type
 * Returns the computed value for a cell given its key (row,col format)
 * Optional sheet parameter for cross-sheet references
 */
export type CellValueGetter = (key: string, sheet?: string) => ComputedValue | null;

/**
 * Evaluate an AST node and return the result
 */
export function evaluate(
  node: ASTNode,
  getCellValue: CellValueGetter
): FunctionResult {
  switch (node.type) {
    case 'number':
      return node.value;

    case 'string':
      return node.value;

    case 'cellRef': {
      const cellKey = `${node.ref.row},${node.ref.col}`;
      const computed = getCellValue(cellKey, node.ref.sheet);
      if (!computed) {
        return null; // Empty cell
      }
      if (computed.error) {
        throw new EvaluatorError(computed.error, `Cell reference error`);
      }
      return computed.value;
    }

    case 'range': {
      // Expand range to array of values (without sheet prefix in keys)
      const sheet = node.start.sheet || node.end.sheet;
      const minRow = Math.min(node.start.row, node.end.row);
      const maxRow = Math.max(node.start.row, node.end.row);
      const minCol = Math.min(node.start.col, node.end.col);
      const maxCol = Math.max(node.start.col, node.end.col);
      const values: FunctionResult[] = [];
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const cellKey = `${row},${col}`;
          const computed = getCellValue(cellKey, sheet);
          if (computed) {
            if (computed.error) {
              throw new EvaluatorError(computed.error, `Range contains error`);
            }
            values.push(computed.value);
          } else {
            values.push(null); // Empty cell
          }
        }
      }
      // Return as array (functions will handle flattening)
      return values as unknown as FunctionResult;
    }

    case 'binaryOp': {
      const left = evaluate(node.left, getCellValue);
      const right = evaluate(node.right, getCellValue);
      return evaluateBinaryOp(node.operator, left, right);
    }

    case 'unaryOp': {
      const operand = evaluate(node.operand, getCellValue);
      return evaluateUnaryOp(node.operator, operand);
    }

    case 'function': {
      // Evaluate arguments (but keep ranges as arrays)
      const args: FunctionArgs = node.args.map(arg => {
        const result = evaluate(arg, getCellValue);
        return result as FunctionArgs[number];
      });
      return callFunction(node.name, args);
    }

    default: {
      const _exhaustive: never = node;
      throw new EvaluatorError('#ERROR!', `Unknown node type: ${(_exhaustive as ASTNode).type}`);
    }
  }
}

/**
 * Evaluate a binary operation
 */
function evaluateBinaryOp(
  operator: string,
  left: FunctionResult,
  right: FunctionResult
): FunctionResult {
  // Handle null values
  const leftNum = toNumber(left);
  const rightNum = toNumber(right);
  const leftStr = toString(left);
  const rightStr = toString(right);

  switch (operator) {
    // Arithmetic
    case '+':
      return leftNum + rightNum;
    case '-':
      return leftNum - rightNum;
    case '*':
      return leftNum * rightNum;
    case '/':
      if (rightNum === 0) {
        throw new EvaluatorError('#DIV/0!', 'Division by zero');
      }
      return leftNum / rightNum;
    case '^':
      return Math.pow(leftNum, rightNum);

    // String concatenation
    case '&':
      return leftStr + rightStr;

    // Comparison
    case '=':
      return compareValues(left, right) === 0;
    case '<>':
      return compareValues(left, right) !== 0;
    case '<':
      return compareValues(left, right) < 0;
    case '>':
      return compareValues(left, right) > 0;
    case '<=':
      return compareValues(left, right) <= 0;
    case '>=':
      return compareValues(left, right) >= 0;

    default:
      throw new EvaluatorError('#ERROR!', `Unknown operator: ${operator}`);
  }
}

/**
 * Evaluate a unary operation
 */
function evaluateUnaryOp(operator: string, operand: FunctionResult): FunctionResult {
  const num = toNumber(operand);
  switch (operator) {
    case '-':
      return -num;
    case '+':
      return num;
    case '%':
      return num / 100;
    default:
      throw new EvaluatorError('#ERROR!', `Unknown unary operator: ${operator}`);
  }
}

/**
 * Convert a value to a number for arithmetic
 */
function toNumber(value: FunctionResult): number {
  if (value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new EvaluatorError('#VALUE!', 'Text cannot be used in arithmetic operations');
    }
    return num;
  }
  return 0;
}

/**
 * Convert a value to a string
 */
function toString(value: FunctionResult): string {
  if (value === null) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

/**
 * Compare two values (for comparison operators)
 * Returns: negative if left < right, 0 if equal, positive if left > right
 */
function compareValues(left: FunctionResult, right: FunctionResult): number {
  // Handle null
  if (left === null && right === null) return 0;
  if (left === null) return -1;
  if (right === null) return 1;

  // Compare same types
  if (typeof left === typeof right) {
    if (typeof left === 'string' && typeof right === 'string') {
      return left.localeCompare(right, undefined, { sensitivity: 'accent' });
    }
    if (typeof left === 'number' && typeof right === 'number') {
      return left - right;
    }
    if (typeof left === 'boolean' && typeof right === 'boolean') {
      return (left ? 1 : 0) - (right ? 1 : 0);
    }
  }

  // Mixed types: convert to numbers
  const leftNum = toNumber(left);
  const rightNum = toNumber(right);
  return leftNum - rightNum;
}

/**
 * Safely evaluate a formula and return ComputedValue
 */
export function safeEvaluate(
  node: ASTNode,
  getCellValue: CellValueGetter
): ComputedValue {
  try {
    const value = evaluate(node, getCellValue);
    return { value };
  } catch (err) {
    if (err instanceof EvaluatorError || err instanceof FormulaFunctionError) {
      return { value: null, error: err.code };
    }
    return { value: null, error: '#ERROR!' };
  }
}
