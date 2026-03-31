/**
 * Tiny Pratt Parser — Top-down operator precedence
 * 
 * Elegant expression parsing:
 * - Prefix operators: -, !, ~, not
 * - Infix operators: +, -, *, /, %, ==, !=, <, >, <=, >=, &&, ||
 * - Right-associative: **, =
 * - Grouping: (expr)
 * - Function calls: f(x, y)
 * - Ternary: cond ? then : else
 * - Array/property access: a[i], a.b
 */

function createParser(options = {}) {
  const prefixParsers = new Map();
  const infixParsers = new Map();

  function prefix(token, bp, fn) {
    prefixParsers.set(token, { bp, fn: fn || ((op, right) => ({ type: 'prefix', op, right })) });
  }

  function infix(token, bp, right = false, fn = null) {
    infixParsers.set(token, {
      bp,
      rightAssoc: right,
      fn: fn || ((op, left, right) => ({ type: 'infix', op, left, right })),
    });
  }

  // Defaults
  prefix('-', 70);
  prefix('!', 70);
  prefix('~', 70);
  prefix('not', 70);

  infix('||', 10);
  infix('&&', 20);
  infix('==', 30); infix('!=', 30);
  infix('<', 40); infix('>', 40); infix('<=', 40); infix('>=', 40);
  infix('+', 50); infix('-', 50);
  infix('*', 60); infix('/', 60); infix('%', 60);
  infix('**', 80, true); // right-assoc
  infix('=', 5, true);   // assignment, right-assoc

  function parse(tokens) {
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    const expect = (t) => { if (peek() !== t) throw new Error(`Expected '${t}', got '${peek()}'`); return next(); };

    function expr(rbp = 0) {
      let left = nud();
      while (pos < tokens.length) {
        const tok = peek();
        const inf = infixParsers.get(tok);
        if (!inf || inf.bp <= rbp) break;
        next();
        const right = expr(inf.rightAssoc ? inf.bp - 1 : inf.bp);
        left = inf.fn(tok, left, right);
      }
      
      // Ternary
      if (peek() === '?') {
        next();
        const then = expr(0);
        expect(':');
        const else_ = expr(0);
        left = { type: 'ternary', cond: left, then, else: else_ };
      }
      
      return left;
    }

    function nud() {
      const tok = next();
      
      // Number
      if (/^-?\d+(\.\d+)?$/.test(tok)) return { type: 'number', value: parseFloat(tok) };
      
      // String
      if (tok.startsWith('"') || tok.startsWith("'")) return { type: 'string', value: tok.slice(1, -1) };
      
      // Boolean
      if (tok === 'true') return { type: 'boolean', value: true };
      if (tok === 'false') return { type: 'boolean', value: false };
      if (tok === 'null') return { type: 'null' };
      
      // Grouping
      if (tok === '(') {
        const e = expr(0);
        expect(')');
        return e;
      }
      
      // Prefix operator
      const pre = prefixParsers.get(tok);
      if (pre) {
        const right = expr(pre.bp);
        return pre.fn(tok, right);
      }
      
      // Identifier (possibly followed by call or access)
      if (/^[a-zA-Z_]\w*$/.test(tok)) {
        let node = { type: 'identifier', name: tok };
        
        // Function call
        while (peek() === '(' || peek() === '[' || peek() === '.') {
          if (peek() === '(') {
            next();
            const args = [];
            if (peek() !== ')') {
              args.push(expr(0));
              while (peek() === ',') { next(); args.push(expr(0)); }
            }
            expect(')');
            node = { type: 'call', callee: node, args };
          } else if (peek() === '[') {
            next();
            const index = expr(0);
            expect(']');
            node = { type: 'index', object: node, index };
          } else if (peek() === '.') {
            next();
            const prop = next();
            node = { type: 'member', object: node, property: prop };
          }
        }
        return node;
      }
      
      throw new Error(`Unexpected token: ${tok}`);
    }

    return expr(0);
  }

  return { parse, prefix, infix };
}

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const multiOps = ['**', '==', '!=', '<=', '>=', '&&', '||'];
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }
    
    // Multi-char ops
    let matched = false;
    for (const op of multiOps) {
      if (src.startsWith(op, i)) { tokens.push(op); i += op.length; matched = true; break; }
    }
    if (matched) continue;
    
    // Single-char ops and punctuation
    if ('+-*/%=<>!~?:()[].,'.includes(src[i])) { tokens.push(src[i++]); continue; }
    
    // Strings
    if (src[i] === '"' || src[i] === "'") {
      const q = src[i]; let s = q; i++;
      while (i < src.length && src[i] !== q) s += src[i++];
      s += q; i++;
      tokens.push(s); continue;
    }
    
    // Words/numbers
    let word = '';
    while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) word += src[i++];
    if (word) tokens.push(word);
    else i++; // skip unknown
  }
  return tokens;
}

module.exports = { createParser, tokenize };
