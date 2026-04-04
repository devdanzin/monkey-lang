// ===== Simple Optimizing Compiler =====
// Parses arithmetic expressions, builds AST, applies optimizations, generates code

// ===== AST Nodes =====

export class Num { constructor(value) { this.type = 'Num'; this.value = value; } }
export class Var { constructor(name) { this.type = 'Var'; this.name = name; } }
export class BinOp { constructor(op, left, right) { this.type = 'BinOp'; this.op = op; this.left = left; this.right = right; } }
export class UnaryOp { constructor(op, operand) { this.type = 'UnaryOp'; this.op = op; this.operand = operand; } }
export class Assign { constructor(name, value) { this.type = 'Assign'; this.name = name; this.value = value; } }
export class If { constructor(cond, then, els) { this.type = 'If'; this.cond = cond; this.then = then; this.els = els; } }
export class Block { constructor(stmts) { this.type = 'Block'; this.stmts = stmts; } }
export class Print { constructor(expr) { this.type = 'Print'; this.expr = expr; } }

// ===== Parser =====

export function parse(input) {
  const tokens = tokenize(input);
  let pos = 0;
  
  function peek() { return tokens[pos]; }
  function advance() { return tokens[pos++]; }
  function expect(type) {
    const t = advance();
    if (t?.type !== type) throw new Error(`Expected ${type}, got ${t?.type || 'EOF'}`);
    return t;
  }
  
  function parseProgram() {
    const stmts = [];
    while (pos < tokens.length && peek()?.type !== 'EOF') {
      stmts.push(parseStatement());
    }
    return new Block(stmts);
  }
  
  function parseStatement() {
    if (peek()?.value === 'if') return parseIf();
    if (peek()?.value === 'print') { advance(); const e = parseExpr(); expect('SEMI'); return new Print(e); }
    if (peek()?.type === 'IDENT' && tokens[pos + 1]?.value === '=') {
      const name = advance().value;
      advance(); // =
      const value = parseExpr();
      expect('SEMI');
      return new Assign(name, value);
    }
    const expr = parseExpr();
    expect('SEMI');
    return expr;
  }
  
  function parseIf() {
    advance(); // if
    expect('LPAREN');
    const cond = parseExpr();
    expect('RPAREN');
    expect('LBRACE');
    const then = parseBlock();
    expect('RBRACE');
    let els = null;
    if (peek()?.value === 'else') {
      advance();
      expect('LBRACE');
      els = parseBlock();
      expect('RBRACE');
    }
    return new If(cond, then, els);
  }
  
  function parseBlock() {
    const stmts = [];
    while (peek()?.type !== 'RBRACE' && pos < tokens.length) {
      stmts.push(parseStatement());
    }
    return new Block(stmts);
  }
  
  function parseExpr() { return parseComparison(); }
  
  function parseComparison() {
    let left = parseAddSub();
    while (peek()?.value === '==' || peek()?.value === '!=' || peek()?.value === '<' || peek()?.value === '>') {
      const op = advance().value;
      left = new BinOp(op, left, parseAddSub());
    }
    return left;
  }
  
  function parseAddSub() {
    let left = parseMulDiv();
    while (peek()?.value === '+' || peek()?.value === '-') {
      const op = advance().value;
      left = new BinOp(op, left, parseMulDiv());
    }
    return left;
  }
  
  function parseMulDiv() {
    let left = parseUnary();
    while (peek()?.value === '*' || peek()?.value === '/' || peek()?.value === '%') {
      const op = advance().value;
      left = new BinOp(op, left, parseUnary());
    }
    return left;
  }
  
  function parseUnary() {
    if (peek()?.value === '-') {
      advance();
      return new UnaryOp('-', parsePrimary());
    }
    return parsePrimary();
  }
  
  function parsePrimary() {
    if (peek()?.type === 'NUM') return new Num(advance().value);
    if (peek()?.type === 'IDENT') return new Var(advance().value);
    if (peek()?.type === 'LPAREN') {
      advance();
      const expr = parseExpr();
      expect('RPAREN');
      return expr;
    }
    throw new Error(`Unexpected token: ${peek()?.value}`);
  }
  
  return parseProgram();
}

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    if (/\s/.test(input[i])) { i++; continue; }
    if (/[0-9]/.test(input[i])) {
      let n = '';
      while (i < input.length && /[0-9.]/.test(input[i])) { n += input[i]; i++; }
      tokens.push({ type: 'NUM', value: Number(n) });
      continue;
    }
    if (/[a-zA-Z_]/.test(input[i])) {
      let id = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) { id += input[i]; i++; }
      tokens.push({ type: 'IDENT', value: id });
      continue;
    }
    if (input[i] === '=' && input[i+1] === '=') { tokens.push({ type: 'OP', value: '==' }); i += 2; continue; }
    if (input[i] === '!' && input[i+1] === '=') { tokens.push({ type: 'OP', value: '!=' }); i += 2; continue; }
    const single = { '(': 'LPAREN', ')': 'RPAREN', '{': 'LBRACE', '}': 'RBRACE', ';': 'SEMI', '+': 'OP', '-': 'OP', '*': 'OP', '/': 'OP', '%': 'OP', '=': 'OP', '<': 'OP', '>': 'OP' };
    if (single[input[i]]) { tokens.push({ type: single[input[i]], value: input[i] }); i++; continue; }
    throw new Error(`Unexpected char: ${input[i]}`);
  }
  tokens.push({ type: 'EOF' });
  return tokens;
}

// ===== Constant Folding =====

export function constantFold(node) {
  if (!node) return node;
  
  if (node.type === 'BinOp') {
    const left = constantFold(node.left);
    const right = constantFold(node.right);
    
    if (left.type === 'Num' && right.type === 'Num') {
      const result = evalOp(node.op, left.value, right.value);
      return new Num(result);
    }
    
    // Algebraic simplifications
    if (node.op === '+' && right.type === 'Num' && right.value === 0) return left;
    if (node.op === '+' && left.type === 'Num' && left.value === 0) return right;
    if (node.op === '*' && right.type === 'Num' && right.value === 1) return left;
    if (node.op === '*' && left.type === 'Num' && left.value === 1) return right;
    if (node.op === '*' && (right.type === 'Num' && right.value === 0 || left.type === 'Num' && left.value === 0)) return new Num(0);
    
    return new BinOp(node.op, left, right);
  }
  
  if (node.type === 'UnaryOp') {
    const operand = constantFold(node.operand);
    if (operand.type === 'Num') return new Num(-operand.value);
    return new UnaryOp(node.op, operand);
  }
  
  if (node.type === 'Block') return new Block(node.stmts.map(constantFold));
  if (node.type === 'Assign') return new Assign(node.name, constantFold(node.value));
  if (node.type === 'Print') return new Print(constantFold(node.expr));
  if (node.type === 'If') {
    const cond = constantFold(node.cond);
    // If condition is constant, eliminate branch
    if (cond.type === 'Num') {
      return cond.value ? constantFold(node.then) : (node.els ? constantFold(node.els) : new Block([]));
    }
    return new If(cond, constantFold(node.then), node.els ? constantFold(node.els) : null);
  }
  
  return node;
}

function evalOp(op, a, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b !== 0 ? Math.trunc(a / b) : 0;
    case '%': return a % b;
    case '==': return a === b ? 1 : 0;
    case '!=': return a !== b ? 1 : 0;
    case '<': return a < b ? 1 : 0;
    case '>': return a > b ? 1 : 0;
    default: throw new Error(`Unknown op: ${op}`);
  }
}

// ===== Dead Code Elimination =====

export function eliminateDeadCode(node, usedVars = null) {
  if (node.type === 'Block') {
    // First pass: find used variables
    if (!usedVars) {
      usedVars = new Set();
      collectUsedVars(node, usedVars);
    }
    
    const stmts = node.stmts
      .map(s => eliminateDeadCode(s, usedVars))
      .filter(s => s !== null);
    
    return new Block(stmts);
  }
  
  if (node.type === 'Assign') {
    // If variable is never used, eliminate the assignment
    if (!usedVars.has(node.name)) return null;
    return node;
  }
  
  return node;
}

function collectUsedVars(node, vars) {
  if (!node) return;
  if (node.type === 'Var') vars.add(node.name);
  if (node.type === 'BinOp') { collectUsedVars(node.left, vars); collectUsedVars(node.right, vars); }
  if (node.type === 'UnaryOp') collectUsedVars(node.operand, vars);
  if (node.type === 'Assign') collectUsedVars(node.value, vars);
  if (node.type === 'Block') node.stmts.forEach(s => collectUsedVars(s, vars));
  if (node.type === 'Print') collectUsedVars(node.expr, vars);
  if (node.type === 'If') { collectUsedVars(node.cond, vars); collectUsedVars(node.then, vars); collectUsedVars(node.els, vars); }
}

// ===== Code Generation (3-address) =====

export function generateCode(node) {
  const instructions = [];
  let tempCount = 0;
  
  function newTemp() { return `t${tempCount++}`; }
  
  function gen(node) {
    if (node.type === 'Num') {
      const t = newTemp();
      instructions.push(`${t} = ${node.value}`);
      return t;
    }
    if (node.type === 'Var') return node.name;
    if (node.type === 'BinOp') {
      const l = gen(node.left);
      const r = gen(node.right);
      const t = newTemp();
      instructions.push(`${t} = ${l} ${node.op} ${r}`);
      return t;
    }
    if (node.type === 'UnaryOp') {
      const o = gen(node.operand);
      const t = newTemp();
      instructions.push(`${t} = ${node.op}${o}`);
      return t;
    }
    if (node.type === 'Assign') {
      const v = gen(node.value);
      instructions.push(`${node.name} = ${v}`);
      return node.name;
    }
    if (node.type === 'Print') {
      const v = gen(node.expr);
      instructions.push(`print ${v}`);
      return null;
    }
    if (node.type === 'Block') {
      for (const s of node.stmts) gen(s);
      return null;
    }
    if (node.type === 'If') {
      const c = gen(node.cond);
      const elseLabel = `L${tempCount++}`;
      const endLabel = `L${tempCount++}`;
      instructions.push(`if_false ${c} goto ${elseLabel}`);
      gen(node.then);
      instructions.push(`goto ${endLabel}`);
      instructions.push(`${elseLabel}:`);
      if (node.els) gen(node.els);
      instructions.push(`${endLabel}:`);
      return null;
    }
    return null;
  }
  
  gen(node);
  return instructions;
}

// ===== Compile (full pipeline) =====

export function compile(source) {
  let ast = parse(source);
  ast = constantFold(ast);
  ast = eliminateDeadCode(ast);
  const code = generateCode(ast);
  return { ast, code };
}
