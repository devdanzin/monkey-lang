// parser.js — Tokenizer + Parser for a simple expression language
//
// Syntax:
//   expr = let name = expr in expr
//        | if expr then expr else expr
//        | fn name -> expr
//        | comparison
//   comparison = addition (('==' | '!=' | '<' | '>' | '<=' | '>=') addition)*
//   addition = multiplication (('+' | '-') multiplication)*
//   multiplication = unary (('*' | '/' | '%') unary)*
//   unary = '-' unary | postfix
//   postfix = primary ('[' expr ']' | '(' expr ')')*
//   primary = number | string | true | false | null | name
//            | '(' expr ')' | '[' expr* ']'
//            | len(expr) | push(expr, expr)

// ===== Tokenizer =====
const TOKEN_TYPES = {
  NUMBER: 'NUMBER', STRING: 'STRING', IDENT: 'IDENT', BOOL: 'BOOL', NULL: 'NULL',
  PLUS: '+', MINUS: '-', STAR: '*', SLASH: '/', PERCENT: '%',
  EQ: '==', NE: '!=', LT: '<', GT: '>', LE: '<=', GE: '>=',
  AND: '&&', OR: '||', NOT: '!',
  ASSIGN: '=', ARROW: '->',
  LPAREN: '(', RPAREN: ')', LBRACKET: '[', RBRACKET: ']', COMMA: ',',
  LET: 'let', IN: 'in', IF: 'if', THEN: 'then', ELSE: 'else', FN: 'fn',
  EOF: 'EOF',
};

export function tokenize(source) {
  const tokens = [];
  let i = 0;

  while (i < source.length) {
    // Skip whitespace
    if (/\s/.test(source[i])) { i++; continue; }

    // Skip comments
    if (source[i] === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }

    // Numbers
    if (/\d/.test(source[i]) || (source[i] === '.' && /\d/.test(source[i + 1]))) {
      let num = '';
      while (i < source.length && /[\d.]/.test(source[i])) num += source[i++];
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseFloat(num) });
      continue;
    }

    // Strings
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i++];
      let str = '';
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') {
          i++;
          if (source[i] === 'n') str += '\n';
          else if (source[i] === 't') str += '\t';
          else str += source[i];
        } else {
          str += source[i];
        }
        i++;
      }
      i++; // skip closing quote
      tokens.push({ type: TOKEN_TYPES.STRING, value: str });
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(source[i])) {
      let ident = '';
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i])) ident += source[i++];
      const keywords = { let: TOKEN_TYPES.LET, in: TOKEN_TYPES.IN, if: TOKEN_TYPES.IF,
                         then: TOKEN_TYPES.THEN, else: TOKEN_TYPES.ELSE, fn: TOKEN_TYPES.FN };
      if (keywords[ident]) tokens.push({ type: keywords[ident] });
      else if (ident === 'true') tokens.push({ type: TOKEN_TYPES.BOOL, value: true });
      else if (ident === 'false') tokens.push({ type: TOKEN_TYPES.BOOL, value: false });
      else if (ident === 'null') tokens.push({ type: TOKEN_TYPES.NULL, value: null });
      else tokens.push({ type: TOKEN_TYPES.IDENT, value: ident });
      continue;
    }

    // Two-character operators
    const two = source.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '->'].includes(two)) {
      const typeMap = { '==': TOKEN_TYPES.EQ, '!=': TOKEN_TYPES.NE, '<=': TOKEN_TYPES.LE,
                        '>=': TOKEN_TYPES.GE, '&&': TOKEN_TYPES.AND, '||': TOKEN_TYPES.OR,
                        '->': TOKEN_TYPES.ARROW };
      tokens.push({ type: typeMap[two] });
      i += 2;
      continue;
    }

    // Single-character operators
    const singles = { '+': TOKEN_TYPES.PLUS, '-': TOKEN_TYPES.MINUS, '*': TOKEN_TYPES.STAR,
                      '/': TOKEN_TYPES.SLASH, '%': TOKEN_TYPES.PERCENT, '<': TOKEN_TYPES.LT,
                      '>': TOKEN_TYPES.GT, '!': TOKEN_TYPES.NOT, '=': TOKEN_TYPES.ASSIGN,
                      '(': TOKEN_TYPES.LPAREN, ')': TOKEN_TYPES.RPAREN,
                      '[': TOKEN_TYPES.LBRACKET, ']': TOKEN_TYPES.RBRACKET,
                      ',': TOKEN_TYPES.COMMA };
    if (singles[source[i]]) {
      tokens.push({ type: singles[source[i]] });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: '${source[i]}' at position ${i}`);
  }

  tokens.push({ type: TOKEN_TYPES.EOF });
  return tokens;
}

// ===== Parser =====
export function parse(source) {
  const tokens = typeof source === 'string' ? tokenize(source) : source;
  let pos = 0;

  function peek() { return tokens[pos]; }
  function advance() { return tokens[pos++]; }
  function expect(type) {
    const tok = advance();
    if (tok.type !== type) throw new Error(`Expected ${type}, got ${tok.type}`);
    return tok;
  }
  function match(type) {
    if (peek().type === type) { advance(); return true; }
    return false;
  }

  function parseExpr() {
    // let binding
    if (peek().type === TOKEN_TYPES.LET) {
      advance();
      const name = expect(TOKEN_TYPES.IDENT).value;
      expect(TOKEN_TYPES.ASSIGN);
      const value = parseExpr();
      expect(TOKEN_TYPES.IN);
      const body = parseExpr();
      return { tag: 'let', name, value, body };
    }

    // if-then-else
    if (peek().type === TOKEN_TYPES.IF) {
      advance();
      const cond = parseExpr();
      expect(TOKEN_TYPES.THEN);
      const then = parseExpr();
      expect(TOKEN_TYPES.ELSE);
      const els = parseExpr();
      return { tag: 'if', cond, then, else: els };
    }

    // lambda: fn x -> body
    if (peek().type === TOKEN_TYPES.FN) {
      advance();
      const param = expect(TOKEN_TYPES.IDENT).value;
      expect(TOKEN_TYPES.ARROW);
      const body = parseExpr();
      return { tag: 'lam', param, body };
    }

    return parseOr();
  }

  function parseOr() {
    let left = parseAnd();
    while (peek().type === TOKEN_TYPES.OR) {
      advance();
      left = { tag: 'binop', op: '||', left, right: parseAnd() };
    }
    return left;
  }

  function parseAnd() {
    let left = parseComparison();
    while (peek().type === TOKEN_TYPES.AND) {
      advance();
      left = { tag: 'binop', op: '&&', left, right: parseComparison() };
    }
    return left;
  }

  function parseComparison() {
    let left = parseAddition();
    const ops = [TOKEN_TYPES.EQ, TOKEN_TYPES.NE, TOKEN_TYPES.LT, TOKEN_TYPES.GT, TOKEN_TYPES.LE, TOKEN_TYPES.GE];
    while (ops.includes(peek().type)) {
      const op = advance().type;
      left = { tag: 'binop', op, left, right: parseAddition() };
    }
    return left;
  }

  function parseAddition() {
    let left = parseMultiplication();
    while (peek().type === TOKEN_TYPES.PLUS || peek().type === TOKEN_TYPES.MINUS) {
      const op = advance().type;
      left = { tag: 'binop', op, left, right: parseMultiplication() };
    }
    return left;
  }

  function parseMultiplication() {
    let left = parseUnary();
    while (peek().type === TOKEN_TYPES.STAR || peek().type === TOKEN_TYPES.SLASH || peek().type === TOKEN_TYPES.PERCENT) {
      const op = advance().type;
      left = { tag: 'binop', op, left, right: parseUnary() };
    }
    return left;
  }

  function parseUnary() {
    if (peek().type === TOKEN_TYPES.MINUS) {
      advance();
      return { tag: 'binop', op: '-', left: { tag: 'lit', value: 0 }, right: parseUnary() };
    }
    if (peek().type === TOKEN_TYPES.NOT) {
      advance();
      return { tag: 'binop', op: '!', left: parseUnary(), right: undefined };
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let expr = parsePrimary();
    while (true) {
      if (peek().type === TOKEN_TYPES.LBRACKET) {
        advance();
        const index = parseExpr();
        expect(TOKEN_TYPES.RBRACKET);
        expr = { tag: 'idx', obj: expr, index };
      } else if (peek().type === TOKEN_TYPES.LPAREN) {
        advance();
        const arg = parseExpr();
        expect(TOKEN_TYPES.RPAREN);
        expr = { tag: 'app', fn: expr, arg };
      } else {
        break;
      }
    }
    return expr;
  }

  function parsePrimary() {
    const tok = peek();

    if (tok.type === TOKEN_TYPES.NUMBER) {
      advance();
      return { tag: 'lit', value: tok.value };
    }

    if (tok.type === TOKEN_TYPES.STRING) {
      advance();
      return { tag: 'lit', value: tok.value };
    }

    if (tok.type === TOKEN_TYPES.BOOL) {
      advance();
      return { tag: 'lit', value: tok.value };
    }

    if (tok.type === TOKEN_TYPES.NULL) {
      advance();
      return { tag: 'lit', value: null };
    }

    if (tok.type === TOKEN_TYPES.IDENT) {
      const name = advance().value;
      // Built-in functions
      if (name === 'len' && peek().type === TOKEN_TYPES.LPAREN) {
        advance();
        const obj = parseExpr();
        expect(TOKEN_TYPES.RPAREN);
        return { tag: 'len', obj };
      }
      if (name === 'push' && peek().type === TOKEN_TYPES.LPAREN) {
        advance();
        const arr = parseExpr();
        expect(TOKEN_TYPES.COMMA);
        const val = parseExpr();
        expect(TOKEN_TYPES.RPAREN);
        return { tag: 'push', arr, value: val };
      }
      return { tag: 'var', name };
    }

    if (tok.type === TOKEN_TYPES.LPAREN) {
      advance();
      const expr = parseExpr();
      expect(TOKEN_TYPES.RPAREN);
      return expr;
    }

    if (tok.type === TOKEN_TYPES.LBRACKET) {
      advance();
      const elements = [];
      while (peek().type !== TOKEN_TYPES.RBRACKET) {
        elements.push(parseExpr());
        if (peek().type === TOKEN_TYPES.COMMA) advance();
      }
      expect(TOKEN_TYPES.RBRACKET);
      return { tag: 'arr', elements };
    }

    throw new Error(`Unexpected token: ${tok.type}`);
  }

  const ast = parseExpr();
  if (peek().type !== TOKEN_TYPES.EOF) {
    throw new Error(`Unexpected token after expression: ${peek().type}`);
  }
  return ast;
}

// ===== Convenience: parse + compile + run =====
import { Compiler, VM } from './index.js';

export function run(source) {
  const ast = parse(source);
  const compiler = new Compiler();
  const chunk = compiler.compile(ast);
  const vm = new VM(chunk);
  return vm.run();
}

export { TOKEN_TYPES };
