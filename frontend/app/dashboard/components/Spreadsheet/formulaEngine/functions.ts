/**
 * Spreadsheet function implementations
 * Each function receives an array of evaluated arguments
 */

export type FunctionResult = number | string | boolean | null;
export type FunctionArgs = (number | string | boolean | null | FunctionArgs)[];

export class FormulaFunctionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'FormulaFunctionError';
    this.code = code;
  }
}

/**
 * Flatten nested arrays (from ranges) into a single array
 */
function flatten(args: FunctionArgs): (number | string | boolean | null)[] {
  const result: (number | string | boolean | null)[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      result.push(...flatten(arg));
    } else {
      result.push(arg);
    }
  }
  return result;
}

/**
 * Extract numeric values from args, ignoring non-numbers
 */
function getNumbers(args: FunctionArgs): number[] {
  const flat = flatten(args);
  const nums: number[] = [];
  for (const val of flat) {
    if (typeof val === 'number' && !isNaN(val)) {
      nums.push(val);
    } else if (typeof val === 'string') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        nums.push(parsed);
      }
    } else if (typeof val === 'boolean') {
      nums.push(val ? 1 : 0);
    }
  }
  return nums;
}

/**
 * Require a specific number of arguments
 */
function requireArgs(name: string, args: FunctionArgs, min: number, max?: number) {
  const count = args.length;
  if (count < min) {
    throw new FormulaFunctionError('#VALUE!', `${name} requires at least ${min} argument(s)`);
  }
  if (max !== undefined && count > max) {
    throw new FormulaFunctionError('#VALUE!', `${name} accepts at most ${max} argument(s)`);
  }
}

// ============ MATH FUNCTIONS ============

function SUM(args: FunctionArgs): number {
  const nums = getNumbers(args);
  return nums.reduce((a, b) => a + b, 0);
}

function AVERAGE(args: FunctionArgs): number {
  const nums = getNumbers(args);
  if (nums.length === 0) {
    throw new FormulaFunctionError('#DIV/0!', 'AVERAGE requires at least one numeric value');
  }
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function MIN(args: FunctionArgs): number {
  const nums = getNumbers(args);
  if (nums.length === 0) {
    return 0;
  }
  return Math.min(...nums);
}

function MAX(args: FunctionArgs): number {
  const nums = getNumbers(args);
  if (nums.length === 0) {
    return 0;
  }
  return Math.max(...nums);
}

function COUNT(args: FunctionArgs): number {
  const nums = getNumbers(args);
  return nums.length;
}

function COUNTA(args: FunctionArgs): number {
  const flat = flatten(args);
  return flat.filter(v => v !== null && v !== '').length;
}

function ABS(args: FunctionArgs): number {
  requireArgs('ABS', args, 1, 1);
  const nums = getNumbers(args);
  if (nums.length === 0) {
    throw new FormulaFunctionError('#VALUE!', 'ABS requires a numeric value');
  }
  return Math.abs(nums[0]);
}

function ROUND(args: FunctionArgs): number {
  requireArgs('ROUND', args, 1, 2);
  const flat = flatten(args);
  const num = typeof flat[0] === 'number' ? flat[0] : parseFloat(String(flat[0]));
  if (isNaN(num)) {
    throw new FormulaFunctionError('#VALUE!', 'ROUND requires a numeric value');
  }
  const decimals = args.length > 1 && typeof flat[1] === 'number' ? flat[1] : 0;
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

function FLOOR(args: FunctionArgs): number {
  requireArgs('FLOOR', args, 1, 2);
  const flat = flatten(args);
  const num = typeof flat[0] === 'number' ? flat[0] : parseFloat(String(flat[0]));
  if (isNaN(num)) {
    throw new FormulaFunctionError('#VALUE!', 'FLOOR requires a numeric value');
  }
  const significance = args.length > 1 && typeof flat[1] === 'number' ? flat[1] : 1;
  if (significance === 0) {
    throw new FormulaFunctionError('#DIV/0!', 'FLOOR significance cannot be zero');
  }
  return Math.floor(num / significance) * significance;
}

function CEILING(args: FunctionArgs): number {
  requireArgs('CEILING', args, 1, 2);
  const flat = flatten(args);
  const num = typeof flat[0] === 'number' ? flat[0] : parseFloat(String(flat[0]));
  if (isNaN(num)) {
    throw new FormulaFunctionError('#VALUE!', 'CEILING requires a numeric value');
  }
  const significance = args.length > 1 && typeof flat[1] === 'number' ? flat[1] : 1;
  if (significance === 0) {
    throw new FormulaFunctionError('#DIV/0!', 'CEILING significance cannot be zero');
  }
  return Math.ceil(num / significance) * significance;
}

function SQRT(args: FunctionArgs): number {
  requireArgs('SQRT', args, 1, 1);
  const nums = getNumbers(args);
  if (nums.length === 0 || nums[0] < 0) {
    throw new FormulaFunctionError('#NUM!', 'SQRT requires a non-negative number');
  }
  return Math.sqrt(nums[0]);
}

function POWER(args: FunctionArgs): number {
  requireArgs('POWER', args, 2, 2);
  const flat = flatten(args);
  const base = typeof flat[0] === 'number' ? flat[0] : parseFloat(String(flat[0]));
  const exp = typeof flat[1] === 'number' ? flat[1] : parseFloat(String(flat[1]));
  if (isNaN(base) || isNaN(exp)) {
    throw new FormulaFunctionError('#VALUE!', 'POWER requires numeric values');
  }
  return Math.pow(base, exp);
}

function MOD(args: FunctionArgs): number {
  requireArgs('MOD', args, 2, 2);
  const flat = flatten(args);
  const num = typeof flat[0] === 'number' ? flat[0] : parseFloat(String(flat[0]));
  const divisor = typeof flat[1] === 'number' ? flat[1] : parseFloat(String(flat[1]));
  if (isNaN(num) || isNaN(divisor)) {
    throw new FormulaFunctionError('#VALUE!', 'MOD requires numeric values');
  }
  if (divisor === 0) {
    throw new FormulaFunctionError('#DIV/0!', 'MOD divisor cannot be zero');
  }
  return num % divisor;
}

// ============ LOGIC FUNCTIONS ============

function IF(args: FunctionArgs): FunctionResult {
  requireArgs('IF', args, 2, 3);
  const flat = flatten(args);
  const condition = flat[0];
  const trueVal = args.length > 1 ? flat[1] : true;
  const falseVal = args.length > 2 ? flat[2] : false;
  
  // Evaluate condition as boolean
  let isTrue = false;
  if (typeof condition === 'boolean') {
    isTrue = condition;
  } else if (typeof condition === 'number') {
    isTrue = condition !== 0;
  } else if (typeof condition === 'string') {
    isTrue = condition.length > 0;
  }
  
  return isTrue ? trueVal : falseVal;
}

function AND(args: FunctionArgs): boolean {
  requireArgs('AND', args, 1);
  const flat = flatten(args);
  for (const val of flat) {
    if (val === false || val === 0 || val === null || val === '') {
      return false;
    }
  }
  return true;
}

function OR(args: FunctionArgs): boolean {
  requireArgs('OR', args, 1);
  const flat = flatten(args);
  for (const val of flat) {
    if (val === true || (typeof val === 'number' && val !== 0) || (typeof val === 'string' && val !== '')) {
      return true;
    }
  }
  return false;
}

function NOT(args: FunctionArgs): boolean {
  requireArgs('NOT', args, 1, 1);
  const flat = flatten(args);
  const val = flat[0];
  if (typeof val === 'boolean') return !val;
  if (typeof val === 'number') return val === 0;
  if (val === null || val === '') return true;
  return false;
}

// ============ TEXT FUNCTIONS ============

function CONCAT(args: FunctionArgs): string {
  const flat = flatten(args);
  return flat.map(v => v === null ? '' : String(v)).join('');
}

function CONCATENATE(args: FunctionArgs): string {
  return CONCAT(args);
}

function LEFT(args: FunctionArgs): string {
  requireArgs('LEFT', args, 1, 2);
  const flat = flatten(args);
  const text = String(flat[0] ?? '');
  const numChars = args.length > 1 && typeof flat[1] === 'number' ? flat[1] : 1;
  return text.slice(0, numChars);
}

function RIGHT(args: FunctionArgs): string {
  requireArgs('RIGHT', args, 1, 2);
  const flat = flatten(args);
  const text = String(flat[0] ?? '');
  const numChars = args.length > 1 && typeof flat[1] === 'number' ? flat[1] : 1;
  return text.slice(-numChars);
}

function MID(args: FunctionArgs): string {
  requireArgs('MID', args, 3, 3);
  const flat = flatten(args);
  const text = String(flat[0] ?? '');
  const start = typeof flat[1] === 'number' ? flat[1] : 1;
  const numChars = typeof flat[2] === 'number' ? flat[2] : 0;
  return text.slice(start - 1, start - 1 + numChars);
}

function LEN(args: FunctionArgs): number {
  requireArgs('LEN', args, 1, 1);
  const flat = flatten(args);
  return String(flat[0] ?? '').length;
}

function UPPER(args: FunctionArgs): string {
  requireArgs('UPPER', args, 1, 1);
  const flat = flatten(args);
  return String(flat[0] ?? '').toUpperCase();
}

function LOWER(args: FunctionArgs): string {
  requireArgs('LOWER', args, 1, 1);
  const flat = flatten(args);
  return String(flat[0] ?? '').toLowerCase();
}

function TRIM(args: FunctionArgs): string {
  requireArgs('TRIM', args, 1, 1);
  const flat = flatten(args);
  return String(flat[0] ?? '').trim().replace(/\s+/g, ' ');
}

// ============ FUNCTION REGISTRY ============

export const FUNCTIONS: Record<string, (args: FunctionArgs) => FunctionResult> = {
  // Math
  SUM,
  AVERAGE,
  AVG: AVERAGE,
  MIN,
  MAX,
  COUNT,
  COUNTA,
  ABS,
  ROUND,
  FLOOR,
  CEILING,
  SQRT,
  POWER,
  POW: POWER,
  MOD,
  
  // Logic
  IF,
  AND,
  OR,
  NOT,
  
  // Text
  CONCAT,
  CONCATENATE,
  LEFT,
  RIGHT,
  MID,
  LEN,
  UPPER,
  LOWER,
  TRIM,
};

/**
 * Call a function by name
 */
export function callFunction(name: string, args: FunctionArgs): FunctionResult {
  const fn = FUNCTIONS[name.toUpperCase()];
  if (!fn) {
    throw new FormulaFunctionError('#NAME?', `Unknown function: ${name}`);
  }
  return fn(args);
}
