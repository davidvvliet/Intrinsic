import type { Token, TokenType } from './types';
import { isCellRefPattern } from './cellRef';

export class TokenizerError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = 'TokenizerError';
    this.position = position;
  }
}

/**
 * Tokenize a formula string into tokens
 * Formula should start with '=' (which is skipped)
 */
export function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  // Skip leading '=' if present
  if (formula.startsWith('=')) {
    pos = 1;
  }

  const isWhitespace = (ch: string) => /\s/.test(ch);
  const isDigit = (ch: string) => /\d/.test(ch);
  const isAlpha = (ch: string) => /[A-Za-z]/.test(ch);
  const isAlphaNum = (ch: string) => /[A-Za-z0-9]/.test(ch);

  while (pos < formula.length) {
    const ch = formula[pos];

    // Skip whitespace
    if (isWhitespace(ch)) {
      pos++;
      continue;
    }

    // Numbers (including decimals)
    if (isDigit(ch) || (ch === '.' && pos + 1 < formula.length && isDigit(formula[pos + 1]))) {
      const start = pos;
      let hasDecimal = ch === '.';
      pos++;
      while (pos < formula.length) {
        const c = formula[pos];
        if (isDigit(c)) {
          pos++;
        } else if (c === '.' && !hasDecimal) {
          hasDecimal = true;
          pos++;
        } else if (c === 'E' || c === 'e') {
          // Scientific notation
          pos++;
          if (pos < formula.length && (formula[pos] === '+' || formula[pos] === '-')) {
            pos++;
          }
          while (pos < formula.length && isDigit(formula[pos])) {
            pos++;
          }
          break;
        } else {
          break;
        }
      }
      tokens.push({ type: 'NUMBER', value: formula.slice(start, pos), position: start });
      continue;
    }

    // Strings (double-quoted)
    if (ch === '"') {
      const start = pos;
      pos++;
      let value = '';
      while (pos < formula.length) {
        if (formula[pos] === '"') {
          if (pos + 1 < formula.length && formula[pos + 1] === '"') {
            // Escaped quote
            value += '"';
            pos += 2;
          } else {
            pos++;
            break;
          }
        } else {
          value += formula[pos];
          pos++;
        }
      }
      tokens.push({ type: 'STRING', value, position: start });
      continue;
    }

    // Identifiers (cell refs, function names, or ranges like A1:B2)
    if (isAlpha(ch) || ch === '$') {
      const start = pos;
      // Collect the full identifier (may include $ for absolute refs)
      while (pos < formula.length && (isAlphaNum(formula[pos]) || formula[pos] === '$')) {
        pos++;
      }
      const identifier = formula.slice(start, pos);

      // Check if this is a range (A1:B2)
      if (pos < formula.length && formula[pos] === ':') {
        const colonPos = pos;
        pos++;
        const rangeStart = pos;
        while (pos < formula.length && (isAlphaNum(formula[pos]) || formula[pos] === '$')) {
          pos++;
        }
        if (pos > rangeStart) {
          const endRef = formula.slice(rangeStart, pos);
          if (isCellRefPattern(identifier) && isCellRefPattern(endRef)) {
            tokens.push({ type: 'RANGE', value: `${identifier}:${endRef}`, position: start });
            continue;
          }
        }
        // Not a valid range, backtrack
        pos = colonPos;
      }

      // Check if it's a cell reference or function name
      if (isCellRefPattern(identifier)) {
        tokens.push({ type: 'CELL_REF', value: identifier, position: start });
      } else {
        // Assume it's a function name (will be validated during parsing/evaluation)
        tokens.push({ type: 'FUNCTION', value: identifier.toUpperCase(), position: start });
      }
      continue;
    }

    // Operators
    if ('+-*/^&'.includes(ch)) {
      tokens.push({ type: 'OPERATOR', value: ch, position: pos });
      pos++;
      continue;
    }

    // Comparison operators
    if (ch === '<') {
      if (pos + 1 < formula.length && formula[pos + 1] === '>') {
        tokens.push({ type: 'OPERATOR', value: '<>', position: pos });
        pos += 2;
      } else if (pos + 1 < formula.length && formula[pos + 1] === '=') {
        tokens.push({ type: 'OPERATOR', value: '<=', position: pos });
        pos += 2;
      } else {
        tokens.push({ type: 'OPERATOR', value: '<', position: pos });
        pos++;
      }
      continue;
    }

    if (ch === '>') {
      if (pos + 1 < formula.length && formula[pos + 1] === '=') {
        tokens.push({ type: 'OPERATOR', value: '>=', position: pos });
        pos += 2;
      } else {
        tokens.push({ type: 'OPERATOR', value: '>', position: pos });
        pos++;
      }
      continue;
    }

    if (ch === '=') {
      tokens.push({ type: 'OPERATOR', value: '=', position: pos });
      pos++;
      continue;
    }

    // Parentheses
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', position: pos });
      pos++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', position: pos });
      pos++;
      continue;
    }

    // Comma
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ',', position: pos });
      pos++;
      continue;
    }

    // Colon (standalone, not part of range)
    if (ch === ':') {
      tokens.push({ type: 'COLON', value: ':', position: pos });
      pos++;
      continue;
    }

    // Unknown character
    throw new TokenizerError(`Unexpected character: ${ch}`, pos);
  }

  tokens.push({ type: 'EOF', value: '', position: pos });
  return tokens;
}
