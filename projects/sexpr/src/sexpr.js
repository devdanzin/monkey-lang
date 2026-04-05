// sexpr.js — S-expression parser/formatter

export class SSymbol { constructor(name) { this.name = name; } toString() { return this.name; } }
export class SCons { constructor(car, cdr) { this.car = car; this.cdr = cdr; } }

export const NIL = Object.freeze({ type: 'nil', toString() { return 'nil'; } });

export function symbol(name) { return new SSymbol(name); }
export function cons(car, cdr) { return new SCons(car, cdr); }

// ===== Tokenizer =====
function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
    if (ch === ';') { while (i < input.length && input[i] !== '\n') i++; continue; } // comment
    if (ch === '(' || ch === ')' || ch === "'") { tokens.push(ch); i++; continue; }
    if (ch === '"') {
      let str = ''; i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\') { i++; str += input[i] === 'n' ? '\n' : input[i] === 't' ? '\t' : input[i]; }
        else str += input[i];
        i++;
      }
      i++; // closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }
    // Atom (symbol or number)
    let atom = '';
    while (i < input.length && !' \t\n\r();"'.includes(input[i])) { atom += input[i]; i++; }
    const num = Number(atom);
    if (!isNaN(num) && atom !== '') tokens.push(num);
    else if (atom === 'nil' || atom === 'NIL') tokens.push(NIL);
    else if (atom === '#t') tokens.push(true);
    else if (atom === '#f') tokens.push(false);
    else tokens.push(symbol(atom));
  }
  return tokens;
}

// ===== Parser =====
export function parse(input) {
  const tokens = tokenize(input);
  let pos = 0;
  
  function parseExpr() {
    if (pos >= tokens.length) throw new Error('Unexpected end of input');
    const token = tokens[pos++];
    
    if (token === '(') {
      const items = [];
      while (pos < tokens.length && tokens[pos] !== ')') {
        if (tokens[pos] instanceof SSymbol && tokens[pos].name === '.') {
          pos++; // skip dot
          const cdr = parseExpr();
          pos++; // skip )
          let result = cdr;
          for (let i = items.length - 1; i >= 0; i--) result = cons(items[i], result);
          return result;
        }
        items.push(parseExpr());
      }
      if (pos < tokens.length) pos++; // skip )
      return listToSExpr(items);
    }
    
    if (token === "'") {
      return listToSExpr([symbol('quote'), parseExpr()]);
    }
    
    return token;
  }
  
  const results = [];
  while (pos < tokens.length) results.push(parseExpr());
  return results.length === 1 ? results[0] : results;
}

function listToSExpr(items) {
  let result = NIL;
  for (let i = items.length - 1; i >= 0; i--) result = cons(items[i], result);
  return result;
}

// ===== Stringify =====
export function stringify(expr) {
  if (expr === NIL) return 'nil';
  if (expr === null || expr === undefined) return 'nil';
  if (typeof expr === 'number') return String(expr);
  if (typeof expr === 'boolean') return expr ? '#t' : '#f';
  if (typeof expr === 'string') return `"${expr.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  if (expr instanceof SSymbol) return expr.name;
  if (expr instanceof SCons) {
    // Check if proper list
    if (isProperList(expr)) {
      const items = [];
      let cur = expr;
      while (cur instanceof SCons) { items.push(stringify(cur.car)); cur = cur.cdr; }
      return `(${items.join(' ')})`;
    }
    return `(${stringify(expr.car)} . ${stringify(expr.cdr)})`;
  }
  if (expr?.type === 'string') return `"${expr.value}"`;
  return String(expr);
}

function isProperList(expr) {
  let cur = expr;
  while (cur instanceof SCons) cur = cur.cdr;
  return cur === NIL;
}

// ===== Pretty Print =====
export function prettyPrint(expr, indent = 0) {
  const pad = '  '.repeat(indent);
  if (!(expr instanceof SCons)) return pad + stringify(expr);
  if (!isProperList(expr)) return pad + stringify(expr);
  
  const items = toArray(expr);
  const simple = stringify(expr);
  if (simple.length < 40) return pad + simple;
  
  return pad + '(' + items.map((item, i) => 
    i === 0 ? stringify(item) : prettyPrint(item, indent + 1).trimStart()
  ).join('\n' + '  '.repeat(indent + 1)) + ')';
}

export function toArray(expr) {
  const items = [];
  let cur = expr;
  while (cur instanceof SCons) { items.push(cur.car); cur = cur.cdr; }
  return items;
}
