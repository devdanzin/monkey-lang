/**
 * Prolog Tokenizer + Parser
 * 
 * Parses standard Prolog syntax:
 *   fact(a, b).
 *   rule(X, Y) :- body1(X), body2(Y).
 *   ?- query(X).
 *   Lists: [1, 2, 3], [H|T]
 *   Operators: +, -, *, /, >, <, >=, =<, =:=, =\=, is, mod
 *   Cut: !
 *   If-then-else: (Cond -> Then ; Else)
 *   Strings: "hello" (as list of char codes)
 */

const { Atom, Var, Num, Compound, Cut, NIL, list, listWithTail } = require('./terms.js');

// ─── Tokenizer ──────────────────────────────────────

const TokenType = {
  ATOM: 'ATOM', VAR: 'VAR', NUM: 'NUM', STRING: 'STRING',
  LPAREN: '(', RPAREN: ')', LBRACKET: '[', RBRACKET: ']',
  COMMA: ',', DOT: '.', PIPE: '|', CUT: '!',
  NECK: ':-', QUERY: '?-', ARROW: '->', SEMI: ';',
  OP: 'OP', EOF: 'EOF',
};

const OPERATORS = new Set([
  '+', '-', '*', '/', 'mod',
  '>', '<', '>=', '=<', '=:=', '=\\=',
  '=', '\\=', '==', '\\==',
  'is', 'not',
  '=..', '@<', '@>', '@=<', '@>=',
]);

function tokenize(input) {
  const tokens = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    // Skip whitespace
    if (/\s/.test(input[i])) { i++; continue; }
    
    // Skip line comments
    if (input[i] === '%') {
      while (i < len && input[i] !== '\n') i++;
      continue;
    }
    
    // Skip block comments
    if (input[i] === '/' && input[i + 1] === '*') {
      i += 2;
      while (i < len - 1 && !(input[i] === '*' && input[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // Numbers (including floats)
    if (/\d/.test(input[i]) || (input[i] === '-' && i + 1 < len && /\d/.test(input[i + 1]) && 
        (tokens.length === 0 || ['(', '[', ',', ':-', '?-', 'OP', ';', '->'].includes(tokens[tokens.length - 1].type)))) {
      let numStr = '';
      if (input[i] === '-') { numStr += '-'; i++; }
      while (i < len && /\d/.test(input[i])) { numStr += input[i]; i++; }
      if (i < len && input[i] === '.' && i + 1 < len && /\d/.test(input[i + 1])) {
        numStr += '.'; i++;
        while (i < len && /\d/.test(input[i])) { numStr += input[i]; i++; }
        tokens.push({ type: TokenType.NUM, value: parseFloat(numStr) });
      } else {
        tokens.push({ type: TokenType.NUM, value: parseInt(numStr, 10) });
      }
      continue;
    }

    // String literals "..."
    if (input[i] === '"') {
      i++;
      let str = '';
      while (i < len && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < len) {
          i++;
          switch (input[i]) {
            case 'n': str += '\n'; break;
            case 't': str += '\t'; break;
            case '\\': str += '\\'; break;
            case '"': str += '"'; break;
            default: str += input[i];
          }
        } else {
          str += input[i];
        }
        i++;
      }
      i++; // closing quote
      tokens.push({ type: TokenType.STRING, value: str });
      continue;
    }

    // Quoted atoms 'hello world'
    if (input[i] === "'") {
      i++;
      let name = '';
      while (i < len && input[i] !== "'") {
        if (input[i] === '\\' && i + 1 < len) { i++; name += input[i]; }
        else name += input[i];
        i++;
      }
      i++; // closing quote
      tokens.push({ type: TokenType.ATOM, value: name });
      continue;
    }

    // Special multi-char tokens
    if (input.slice(i, i + 3) === '=..') { tokens.push({ type: TokenType.OP, value: '=..' }); i += 3; continue; }
    if (input.slice(i, i + 3) === '=:=') { tokens.push({ type: TokenType.OP, value: '=:=' }); i += 3; continue; }
    if (input.slice(i, i + 3) === '=\\=') { tokens.push({ type: TokenType.OP, value: '=\\=' }); i += 3; continue; }
    if (input.slice(i, i + 3) === '\\==') { tokens.push({ type: TokenType.OP, value: '\\==' }); i += 3; continue; }
    if (input.slice(i, i + 3) === '@=<') { tokens.push({ type: TokenType.OP, value: '@=<' }); i += 3; continue; }
    if (input.slice(i, i + 3) === '@>=') { tokens.push({ type: TokenType.OP, value: '@>=' }); i += 3; continue; }
    if (input.slice(i, i + 2) === ':-') { tokens.push({ type: TokenType.NECK, value: ':-' }); i += 2; continue; }
    if (input.slice(i, i + 2) === '?-') { tokens.push({ type: TokenType.QUERY, value: '?-' }); i += 2; continue; }
    if (input.slice(i, i + 2) === '->') { tokens.push({ type: TokenType.ARROW, value: '->' }); i += 2; continue; }
    if (input.slice(i, i + 2) === '>=') { tokens.push({ type: TokenType.OP, value: '>=' }); i += 2; continue; }
    if (input.slice(i, i + 2) === '=<') { tokens.push({ type: TokenType.OP, value: '=<' }); i += 2; continue; }
    if (input.slice(i, i + 2) === '==') { tokens.push({ type: TokenType.OP, value: '==' }); i += 2; continue; }
    if (input.slice(i, i + 2) === '\\=') { tokens.push({ type: TokenType.OP, value: '\\=' }); i += 2; continue; }
    if (input.slice(i, i + 2) === '@<') { tokens.push({ type: TokenType.OP, value: '@<' }); i += 2; continue; }
    if (input.slice(i, i + 2) === '@>') { tokens.push({ type: TokenType.OP, value: '@>' }); i += 2; continue; }

    // Single character tokens
    const ch = input[i];
    if (ch === '(') { tokens.push({ type: TokenType.LPAREN }); i++; continue; }
    if (ch === ')') { tokens.push({ type: TokenType.RPAREN }); i++; continue; }
    if (ch === '[') { tokens.push({ type: TokenType.LBRACKET }); i++; continue; }
    if (ch === ']') { tokens.push({ type: TokenType.RBRACKET }); i++; continue; }
    if (ch === ',') { tokens.push({ type: TokenType.COMMA }); i++; continue; }
    if (ch === '|') { tokens.push({ type: TokenType.PIPE }); i++; continue; }
    if (ch === '!') { tokens.push({ type: TokenType.CUT }); i++; continue; }
    if (ch === ';') { tokens.push({ type: TokenType.SEMI }); i++; continue; }
    if (ch === '.') {
      // Dot followed by whitespace/EOF = clause terminator
      if (i + 1 >= len || /\s/.test(input[i + 1]) || input[i + 1] === '%') {
        tokens.push({ type: TokenType.DOT }); i++; continue;
      }
    }
    
    // Operator characters
    if ('+-*/><=\\'.includes(ch)) {
      tokens.push({ type: TokenType.OP, value: ch }); i++; continue;
    }

    // Atoms (lowercase start) and Variables (uppercase or _ start)
    if (/[a-zA-Z_]/.test(ch)) {
      let word = '';
      while (i < len && /[a-zA-Z0-9_]/.test(input[i])) { word += input[i]; i++; }
      
      if (OPERATORS.has(word)) {
        tokens.push({ type: TokenType.OP, value: word });
      } else if (word === '_' || /^[A-Z_]/.test(word)) {
        tokens.push({ type: TokenType.VAR, value: word });
      } else {
        tokens.push({ type: TokenType.ATOM, value: word });
      }
      continue;
    }

    throw new Error(`Unexpected character: '${ch}' at position ${i}`);
  }

  tokens.push({ type: TokenType.EOF });
  return tokens;
}

// ─── Parser ─────────────────────────────────────────

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() { return this.tokens[this.pos]; }
  advance() { return this.tokens[this.pos++]; }
  
  expect(type) {
    const tok = this.advance();
    if (tok.type !== type) throw new Error(`Expected ${type}, got ${tok.type} (${tok.value})`);
    return tok;
  }

  // Parse a program (sequence of clauses)
  parseProgram() {
    const clauses = [];
    const queries = [];
    while (this.peek().type !== TokenType.EOF) {
      if (this.peek().type === TokenType.QUERY) {
        this.advance(); // consume ?-
        const goals = this.parseTermList();
        this.expect(TokenType.DOT);
        queries.push(goals);
      } else {
        clauses.push(this.parseClause());
      }
    }
    return { clauses, queries };
  }

  // Parse a single clause: head. OR head :- body.
  parseClause() {
    const head = this.parseTerm(999);
    if (this.peek().type === TokenType.NECK) {
      this.advance(); // consume :-
      const body = this.parseTermList();
      this.expect(TokenType.DOT);
      return { head, body };
    }
    this.expect(TokenType.DOT);
    return { head, body: [] };
  }

  // Parse comma-separated terms
  parseTermList() {
    const terms = [this.parseTerm(999)];
    while (this.peek().type === TokenType.COMMA) {
      this.advance();
      terms.push(this.parseTerm(999));
    }
    return terms;
  }

  // Operator-precedence term parser (simplified Pratt-like)
  parseTerm(maxPrec) {
    let left = this.parsePrimary();

    while (true) {
      const tok = this.peek();
      if (tok.type === TokenType.OP || (tok.type === TokenType.ATOM && OPERATORS.has(tok.value))) {
        const op = tok.value;
        const prec = opPrec(op);
        if (prec > maxPrec) break;
        this.advance();
        const right = this.parseTerm(prec - 1);
        left = new Compound(op, [left, right]);
      } else if (tok.type === TokenType.SEMI) {
        if (1100 > maxPrec) break;
        this.advance();
        const right = this.parseTerm(1099);
        left = new Compound(';', [left, right]);
      } else if (tok.type === TokenType.ARROW) {
        if (1050 > maxPrec) break;
        this.advance();
        const then = this.parseTerm(1049);
        left = new Compound('->', [left, then]);
      } else {
        break;
      }
    }

    return left;
  }

  parsePrimary() {
    const tok = this.peek();

    // Cut
    if (tok.type === TokenType.CUT) {
      this.advance();
      return new Cut();
    }

    // Number
    if (tok.type === TokenType.NUM) {
      this.advance();
      return new Num(tok.value);
    }

    // Variable
    if (tok.type === TokenType.VAR) {
      this.advance();
      if (tok.value === '_') return new Var('_anon_' + (this._anonCount = (this._anonCount || 0) + 1));
      return new Var(tok.value);
    }

    // String literal → list of character atoms
    if (tok.type === TokenType.STRING) {
      this.advance();
      const chars = [...tok.value].map(c => new Atom(c));
      return list(...chars);
    }

    // Parenthesized expression
    if (tok.type === TokenType.LPAREN) {
      this.advance();
      const term = this.parseTerm(1200);
      this.expect(TokenType.RPAREN);
      return term;
    }

    // List
    if (tok.type === TokenType.LBRACKET) {
      return this.parseList();
    }

    // Unary minus
    if (tok.type === TokenType.OP && tok.value === '-') {
      this.advance();
      const operand = this.parsePrimary();
      if (operand.type === 'num') return new Num(-operand.value);
      return new Compound('-', [new Num(0), operand]);
    }

    // Unary not / \+
    if (tok.type === TokenType.OP && (tok.value === 'not' || tok.value === '\\+')) {
      this.advance();
      const operand = this.parsePrimary();
      return new Compound('not', [operand]);
    }

    // Atom (possibly followed by args)
    if (tok.type === TokenType.ATOM) {
      this.advance();
      const name = tok.value;
      // Check for functor(args)
      if (this.peek().type === TokenType.LPAREN) {
        this.advance();
        if (this.peek().type === TokenType.RPAREN) {
          this.advance();
          return new Compound(name, []);
        }
        const args = this.parseTermList();
        this.expect(TokenType.RPAREN);
        return new Compound(name, args);
      }
      // Special atoms
      if (name === '[]') return NIL;
      if (name === 'true') return new Atom('true');
      if (name === 'fail' || name === 'false') return new Atom('fail');
      return new Atom(name);
    }

    // [] as empty list
    if (tok.type === TokenType.LBRACKET) {
      this.advance();
      if (this.peek().type === TokenType.RBRACKET) {
        this.advance();
        return NIL;
      }
    }

    throw new Error(`Unexpected token: ${tok.type} (${tok.value}) at position ${this.pos}`);
  }

  parseList() {
    this.expect(TokenType.LBRACKET);
    if (this.peek().type === TokenType.RBRACKET) {
      this.advance();
      return NIL;
    }
    const elems = [this.parseTerm(999)];
    while (this.peek().type === TokenType.COMMA) {
      this.advance();
      elems.push(this.parseTerm(999));
    }
    let tail = NIL;
    if (this.peek().type === TokenType.PIPE) {
      this.advance();
      tail = this.parseTerm(999);
    }
    this.expect(TokenType.RBRACKET);
    return listWithTail(elems, tail);
  }
}

function opPrec(op) {
  switch (op) {
    case 'is': case '=': case '\\=': case '==': case '\\==':
    case '<': case '>': case '>=': case '=<': case '=:=': case '=\\=':
    case '@<': case '@>': case '@=<': case '@>=': case '=..':
      return 700;
    case '+': case '-': return 500;
    case '*': case '/': case 'mod': return 400;
    default: return 700;
  }
}

function parse(input) {
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  return parser.parseProgram();
}

function parseTerm(input) {
  const tokens = tokenize(input + '.');
  const parser = new Parser(tokens);
  return parser.parseTerm(1200);
}

module.exports = { tokenize, parse, parseTerm, Parser, TokenType };
