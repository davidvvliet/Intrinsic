/**
 * Spreadsheet function implementations using FormulaJS
 * Each function receives an array of evaluated arguments
 */

import * as formulajs from '@formulajs/formulajs';
import { EXCEL_FUNCTION_SIGNATURES } from './excelfunctions';

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
 * Convert FunctionArgs to FormulaJS format based on function signature
 */
function convertArgsForFormulaJS(name: string, args: FunctionArgs): any[] {
  const signature = EXCEL_FUNCTION_SIGNATURES[name.toUpperCase()];
  
  if (!signature) {
    // No signature found, default to spreading args
    return flatten(args);
  }

  // For functions that take arrays (like SUM, AVERAGE with ...)
  // Check if signature has ... which indicates multiple args that can be arrays
  if (signature.includes('...')) {
    // Flatten and return as array
    return flatten(args);
  }

  // For functions with specific positional args, spread them
  // Most FormulaJS functions accept individual arguments
  return flatten(args);
}

/**
 * Call a function by name using FormulaJS
 */
export function callFunction(name: string, args: FunctionArgs): FunctionResult {
  const upperName = name.toUpperCase();
  const formulajsFn = (formulajs as any)[upperName];
  
  if (!formulajsFn) {
    throw new FormulaFunctionError('#NAME?', `Unknown function: ${name}`);
  }

  try {
    // Convert arguments to FormulaJS format
    const convertedArgs = convertArgsForFormulaJS(upperName, args);
    
    // Call FormulaJS function with spread arguments
    const result = formulajsFn(...convertedArgs);
    
    // Check if result is an error string
    if (typeof result === 'string' && result.startsWith('#')) {
      throw new FormulaFunctionError(result, `FormulaJS error: ${result}`);
    }
    
    return result;
  } catch (err) {
    if (err instanceof FormulaFunctionError) {
      throw err;
    }
    // If FormulaJS throws an error, convert to our error format
    throw new FormulaFunctionError('#VALUE!', `Error calling ${name}: ${err}`);
  }
}
