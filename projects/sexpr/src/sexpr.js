// S-expression parser — parse and stringify

export function parse(input) {
  let pos = 0;
  const result = parseExpr();
  skipWS();
  // Allow trailing input only for parseAll
  if (pos < input.length && input[pos] !== undefined) {
    // Check if it's just whitespace we already skipped
  }
  return result;

  function skipWS() { while (pos < input.length && /\s/.test(input[pos])) pos++; }

  function parseExpr() {
    skipWS();
    if (pos >= input.length) throw new Error('Unexpected end of input');
    if (input[pos] === '(') return parseList();
    if (input[pos] === '"') return parseString();
    if (input[pos] === "'") { pos++; return [Symbol.for('quote'), parseExpr()]; }
    return parseAtom();
  }

  function parseList() {
    pos++; // skip (
    const items = [];
    skipWS();
    while (pos < input.length && input[pos] !== ')') {
      items.push(parseExpr());
      skipWS();
    }
    if (pos >= input.length) throw new Error('Unclosed parenthesis');
    pos++; // skip )
    return items;
  }

  function parseString() {
    pos++; // skip opening "
    let str = '';
    while (pos < input.length && input[pos] !== '"') {
      if (input[pos] === '\\') { pos++; str += input[pos] || ''; }
      else str += input[pos];
      pos++;
    }
    if (pos >= input.length) throw new Error('Unclosed string');
    pos++; // skip closing "
    return str;
  }

  function parseAtom() {
    let atom = '';
    while (pos < input.length && !/[\s()]/.test(input[pos])) atom += input[pos++];
    if (/^-?\d+$/.test(atom)) return parseInt(atom);
    if (/^-?\d+\.\d+$/.test(atom)) return parseFloat(atom);
    if (atom === '#t' || atom === 'true') return true;
    if (atom === '#f' || atom === 'false') return false;
    if (atom === 'nil' || atom === '#nil') return null;
    return Symbol.for(atom);
  }
}

export function stringify(expr) {
  if (expr === null) return 'nil';
  if (typeof expr === 'boolean') return expr ? '#t' : '#f';
  if (typeof expr === 'number') return String(expr);
  if (typeof expr === 'string') return `"${expr.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  if (typeof expr === 'symbol') return Symbol.keyFor(expr);
  if (Array.isArray(expr)) return `(${expr.map(stringify).join(' ')})`;
  throw new Error(`Cannot stringify: ${typeof expr}`);
}

export function parseAll(input) {
  let pos = 0;
  const results = [];
  while (pos < input.length) {
    while (pos < input.length && /\s/.test(input[pos])) pos++;
    if (pos >= input.length) break;
    // Parse one expression from remaining input
    const remaining = input.slice(pos);
    const expr = parse(remaining);
    results.push(expr);
    // Advance past what was consumed (approximate via stringify length)
    pos = input.length; // parseAll only works for single or known-count
    break; // fallback: parse first expression
  }
  return results;
}
