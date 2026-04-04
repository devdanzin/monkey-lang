// Mini-ML Parser
//
// Syntax:
//   let x = e1 in e2
//   let rec f = e1 in e2
//   fn x => e
//   if e1 then e2 else e3
//   match e with | p1 => e1 | p2 => e2
//   e1 + e2, e1 - e2, e1 * e2, e1 / e2
//   e1 == e2, e1 != e2, e1 < e2, e1 > e2, e1 <= e2, e1 >= e2
//   e1 && e2, e1 || e2
//   e1 e2       (application)
//   (e)         (grouping)
//   42, true, false, "hello"
//   x           (variable)

import {
  intLit, boolLit, strLit, varRef, lam, app, letExpr, letRec,
  ifExpr, binOp, matchExpr, matchCase, pVar, pLit, pCon, pWild,
} from './index.js';

class Token {
  constructor(type, value, pos) { this.type = type; this.value = value; this.pos = pos; }
}

const KEYWORDS = new Set(['let', 'rec', 'in', 'fn', 'if', 'then', 'else', 'match', 'with', 'true', 'false']);

export function tokenize(input) {
  const tokens = [];
  let pos = 0;
  
  while (pos < input.length) {
    // Skip whitespace
    if (/\s/.test(input[pos])) { pos++; continue; }
    
    // Skip comments
    if (input[pos] === '(' && input[pos + 1] === '*') {
      pos += 2;
      while (pos < input.length - 1 && !(input[pos] === '*' && input[pos + 1] === ')')) pos++;
      pos += 2;
      continue;
    }
    
    // Two-char operators
    const two = input.slice(pos, pos + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '=>', '->'].includes(two)) {
      tokens.push(new Token('op', two, pos));
      pos += 2;
      continue;
    }
    
    // Single-char operators/punctuation
    if ('+-*/%<>()=|_,.'.includes(input[pos])) {
      tokens.push(new Token('op', input[pos], pos));
      pos++;
      continue;
    }
    
    // Integer
    if (/\d/.test(input[pos])) {
      let num = '';
      while (pos < input.length && /\d/.test(input[pos])) num += input[pos++];
      tokens.push(new Token('int', parseInt(num, 10), pos - num.length));
      continue;
    }
    
    // String
    if (input[pos] === '"') {
      pos++;
      let str = '';
      while (pos < input.length && input[pos] !== '"') {
        if (input[pos] === '\\') { pos++; str += input[pos++]; }
        else str += input[pos++];
      }
      pos++; // closing "
      tokens.push(new Token('string', str, pos - str.length - 2));
      continue;
    }
    
    // Identifier or keyword
    if (/[a-zA-Z_]/.test(input[pos])) {
      let id = '';
      while (pos < input.length && /[a-zA-Z0-9_']/.test(input[pos])) id += input[pos++];
      const type = KEYWORDS.has(id) ? 'kw' : 'id';
      tokens.push(new Token(type, id, pos - id.length));
      continue;
    }
    
    throw new Error(`Unexpected character '${input[pos]}' at position ${pos}`);
  }
  
  tokens.push(new Token('eof', null, pos));
  return tokens;
}

export function parse(input) {
  const tokens = tokenize(input);
  let pos = 0;
  
  function peek() { return tokens[pos]; }
  function advance() { return tokens[pos++]; }
  function expect(type, value) {
    const t = advance();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error(`Expected ${type}${value ? ` '${value}'` : ''} at pos ${t.pos}, got ${t.type} '${t.value}'`);
    }
    return t;
  }
  function match(type, value) {
    if (peek().type === type && (value === undefined || peek().value === value)) {
      return advance();
    }
    return null;
  }
  
  function parseExpr() { return parseOr(); }
  
  function parseOr() {
    let left = parseAnd();
    while (match('op', '||')) {
      left = binOp('||', left, parseAnd());
    }
    return left;
  }
  
  function parseAnd() {
    let left = parseComparison();
    while (match('op', '&&')) {
      left = binOp('&&', left, parseComparison());
    }
    return left;
  }
  
  function parseComparison() {
    let left = parseAddSub();
    const ops = ['==', '!=', '<', '>', '<=', '>='];
    while (ops.includes(peek().value)) {
      const op = advance().value;
      left = binOp(op, left, parseAddSub());
    }
    return left;
  }
  
  function parseAddSub() {
    let left = parseMulDiv();
    while (peek().value === '+' || peek().value === '-') {
      const op = advance().value;
      left = binOp(op, left, parseMulDiv());
    }
    return left;
  }
  
  function parseMulDiv() {
    let left = parseApp();
    while (peek().value === '*' || peek().value === '/' || peek().value === '%') {
      const op = advance().value;
      left = binOp(op, left, parseApp());
    }
    return left;
  }
  
  function parseApp() {
    let expr = parseAtom();
    // Application: f x y z → app(app(app(f, x), y), z)
    while (isAtomStart()) {
      expr = app(expr, parseAtom());
    }
    return expr;
  }
  
  function isAtomStart() {
    const t = peek();
    return t.type === 'int' || t.type === 'string' || t.type === 'id'
      || (t.type === 'kw' && (t.value === 'true' || t.value === 'false'))
      || (t.type === 'op' && t.value === '(');
  }
  
  function parseAtom() {
    const t = peek();
    
    // Integer literal
    if (t.type === 'int') { advance(); return intLit(t.value); }
    
    // String literal
    if (t.type === 'string') { advance(); return strLit(t.value); }
    
    // Boolean literal
    if (t.type === 'kw' && t.value === 'true') { advance(); return boolLit(true); }
    if (t.type === 'kw' && t.value === 'false') { advance(); return boolLit(false); }
    
    // Parenthesized expression
    if (t.type === 'op' && t.value === '(') {
      advance();
      const expr = parseExpr();
      expect('op', ')');
      return expr;
    }
    
    // Let expression
    if (t.type === 'kw' && t.value === 'let') {
      advance();
      const isRec = match('kw', 'rec');
      const name = expect('id').value;
      expect('op', '=');
      const value = parseExpr();
      expect('kw', 'in');
      const body = parseExpr();
      return isRec ? letRec(name, value, body) : letExpr(name, value, body);
    }
    
    // Lambda
    if (t.type === 'kw' && t.value === 'fn') {
      advance();
      const param = expect('id').value;
      expect('op', '=>');
      const body = parseExpr();
      return lam(param, body);
    }
    
    // If-then-else
    if (t.type === 'kw' && t.value === 'if') {
      advance();
      const cond = parseExpr();
      expect('kw', 'then');
      const thenBranch = parseExpr();
      expect('kw', 'else');
      const elseBranch = parseExpr();
      return ifExpr(cond, thenBranch, elseBranch);
    }
    
    // Match expression
    if (t.type === 'kw' && t.value === 'match') {
      advance();
      const scrutinee = parseExpr();
      expect('kw', 'with');
      const cases = [];
      while (match('op', '|')) {
        const pattern = parsePattern();
        expect('op', '=>');
        const body = parseExpr();
        cases.push(matchCase(pattern, body));
      }
      return matchExpr(scrutinee, cases);
    }
    
    // Variable
    if (t.type === 'id') { advance(); return varRef(t.value); }
    
    throw new Error(`Unexpected token ${t.type} '${t.value}' at pos ${t.pos}`);
  }
  
  function parsePattern() {
    const t = peek();
    
    if (t.type === 'op' && t.value === '_') { advance(); return pWild(); }
    if (t.type === 'int') { advance(); return pLit(t.value, 'int'); }
    if (t.type === 'kw' && t.value === 'true') { advance(); return pLit(true, 'bool'); }
    if (t.type === 'kw' && t.value === 'false') { advance(); return pLit(false, 'bool'); }
    if (t.type === 'string') { advance(); return pLit(t.value, 'string'); }
    
    if (t.type === 'id') {
      const name = advance().value;
      // Check if it's a constructor (uppercase) with args
      if (name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase()) {
        const args = [];
        while (isPatternStart()) {
          args.push(parsePattern());
        }
        return pCon(name, args);
      }
      return pVar(name);
    }
    
    if (t.type === 'op' && t.value === '(') {
      advance();
      const pat = parsePattern();
      expect('op', ')');
      return pat;
    }
    
    throw new Error(`Unexpected pattern token ${t.type} '${t.value}' at pos ${t.pos}`);
  }
  
  function isPatternStart() {
    const t = peek();
    return t.type === 'id' || t.type === 'int' || t.type === 'string'
      || (t.type === 'kw' && (t.value === 'true' || t.value === 'false'))
      || (t.type === 'op' && (t.value === '_' || t.value === '('));
  }
  
  const result = parseExpr();
  if (peek().type !== 'eof') {
    throw new Error(`Unexpected token after expression: ${peek().type} '${peek().value}' at pos ${peek().pos}`);
  }
  return result;
}

// High-level: parse and infer
import { infer, defaultEnv } from './index.js';

export function typeOf(input, env) {
  const ast = parse(input);
  return infer(ast, env || defaultEnv());
}
