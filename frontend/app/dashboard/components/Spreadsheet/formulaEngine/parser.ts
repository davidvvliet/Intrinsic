import type { Token, ASTNode } from './types';
import { OPERATOR_PRECEDENCE, RIGHT_ASSOCIATIVE } from './types';
import { parseCellRef } from './cellRef';

export class ParserError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = 'ParserError';
    this.position = position;
  }
}

/**
 * Recursive descent parser for spreadsheet formulas
 * Builds an AST from tokens
 */
export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private peek(offset: number = 0): Token {
    const idx = this.pos + offset;
    return idx < this.tokens.length ? this.tokens[idx] : this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    const token = this.current();
    if (token.type !== 'EOF') {
      this.pos++;
    }
    return token;
  }

  private expect(type: Token['type'], message?: string): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new ParserError(
        message || `Expected ${type}, got ${token.type}`,
        token.position
      );
    }
    return this.advance();
  }

  /**
   * Parse the token stream into an AST
   */
  parse(): ASTNode {
    const node = this.parseExpression(0);
    if (this.current().type !== 'EOF') {
      throw new ParserError(
        `Unexpected token: ${this.current().value}`,
        this.current().position
      );
    }
    return node;
  }

  /**
   * Parse expression with operator precedence (Pratt parser style)
   */
  private parseExpression(minPrecedence: number): ASTNode {
    let left = this.parsePrimary();

    while (true) {
      const token = this.current();
      if (token.type !== 'OPERATOR') break;

      const precedence = OPERATOR_PRECEDENCE[token.value];
      if (precedence === undefined || precedence < minPrecedence) break;

      this.advance(); // consume operator

      // Handle right associativity (for ^)
      const nextMinPrec = RIGHT_ASSOCIATIVE.has(token.value) ? precedence : precedence + 1;
      const right = this.parseExpression(nextMinPrec);

      left = {
        type: 'binaryOp',
        operator: token.value,
        left,
        right,
      };
    }

    return left;
  }

  /**
   * Parse primary expressions (atoms, unary, parenthesized, functions)
   */
  private parsePrimary(): ASTNode {
    const token = this.current();

    // Unary minus/plus
    if (token.type === 'OPERATOR' && (token.value === '-' || token.value === '+')) {
      this.advance();
      const operand = this.parsePrimary();
      // Optimization: fold constant unary operations
      if (operand.type === 'number' && token.value === '-') {
        return { type: 'number', value: -operand.value };
      }
      if (operand.type === 'number' && token.value === '+') {
        return operand;
      }
      return { type: 'unaryOp', operator: token.value, operand };
    }

    // Number
    if (token.type === 'NUMBER') {
      this.advance();
      return { type: 'number', value: parseFloat(token.value) };
    }

    // String
    if (token.type === 'STRING') {
      this.advance();
      return { type: 'string', value: token.value };
    }

    // Range (A1:B2)
    if (token.type === 'RANGE') {
      this.advance();
      const [startStr, endStr] = token.value.split(':');
      const start = parseCellRef(startStr);
      const end = parseCellRef(endStr);
      if (!start || !end) {
        throw new ParserError(`Invalid range: ${token.value}`, token.position);
      }
      return { type: 'range', start, end };
    }

    // Cell reference
    if (token.type === 'CELL_REF') {
      this.advance();
      const ref = parseCellRef(token.value);
      if (!ref) {
        throw new ParserError(`Invalid cell reference: ${token.value}`, token.position);
      }
      return { type: 'cellRef', ref };
    }

    // Function call
    if (token.type === 'FUNCTION') {
      return this.parseFunction();
    }

    // Parenthesized expression
    if (token.type === 'LPAREN') {
      this.advance(); // consume '('
      const expr = this.parseExpression(0);
      this.expect('RPAREN', 'Expected closing parenthesis');
      return expr;
    }

    throw new ParserError(
      `Unexpected token: ${token.type} "${token.value}"`,
      token.position
    );
  }

  /**
   * Parse function call: FUNC(arg1, arg2, ...)
   */
  private parseFunction(): ASTNode {
    const nameToken = this.expect('FUNCTION');
    this.expect('LPAREN', `Expected '(' after function name ${nameToken.value}`);

    const args: ASTNode[] = [];

    // Handle empty argument list
    if (this.current().type !== 'RPAREN') {
      args.push(this.parseExpression(0));

      while (this.current().type === 'COMMA') {
        this.advance(); // consume ','
        args.push(this.parseExpression(0));
      }
    }

    this.expect('RPAREN', `Expected ')' after function arguments`);

    return {
      type: 'function',
      name: nameToken.value,
      args,
    };
  }
}

/**
 * Convenience function to parse a formula string
 */
export function parse(tokens: Token[]): ASTNode {
  const parser = new Parser(tokens);
  return parser.parse();
}
