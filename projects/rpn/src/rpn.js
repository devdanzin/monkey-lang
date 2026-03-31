// RPN (Reverse Polish Notation) calculator

const BUILTINS = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => { if (b === 0) throw new Error('Division by zero'); return a / b; },
  '%': (a, b) => a % b,
  '^': (a, b) => Math.pow(a, b),
  'min': (a, b) => Math.min(a, b),
  'max': (a, b) => Math.max(a, b),
};

const UNARY = {
  'neg': (a) => -a,
  'abs': (a) => Math.abs(a),
  'sqrt': (a) => Math.sqrt(a),
  'sin': (a) => Math.sin(a),
  'cos': (a) => Math.cos(a),
  'tan': (a) => Math.tan(a),
  'ln': (a) => Math.log(a),
  'log': (a) => Math.log10(a),
  'floor': (a) => Math.floor(a),
  'ceil': (a) => Math.ceil(a),
  'round': (a) => Math.round(a),
};

const STACK_OPS = {
  'dup': (s) => { const a = s.pop(); s.push(a, a); },
  'swap': (s) => { const b = s.pop(), a = s.pop(); s.push(b, a); },
  'drop': (s) => { s.pop(); },
  'over': (s) => { const b = s.pop(), a = s.pop(); s.push(a, b, a); },
  'rot': (s) => { const c = s.pop(), b = s.pop(), a = s.pop(); s.push(b, c, a); },
  'clear': (s) => { s.length = 0; },
};

const CONSTANTS = { 'pi': Math.PI, 'e': Math.E, 'tau': Math.PI * 2 };

export function evaluate(expr) {
  const tokens = typeof expr === 'string' ? tokenize(expr) : expr;
  const stack = [];

  for (const token of tokens) {
    if (CONSTANTS[token] !== undefined) { stack.push(CONSTANTS[token]); continue; }
    if (STACK_OPS[token]) { if (token !== 'clear' && stack.length < 1) throw new Error(`Stack underflow: ${token}`); STACK_OPS[token](stack); continue; }
    if (UNARY[token]) { if (stack.length < 1) throw new Error(`Stack underflow: ${token}`); stack.push(UNARY[token](stack.pop())); continue; }
    if (BUILTINS[token]) { if (stack.length < 2) throw new Error(`Stack underflow: ${token}`); const b = stack.pop(), a = stack.pop(); stack.push(BUILTINS[token](a, b)); continue; }
    const num = parseFloat(token);
    if (isNaN(num)) throw new Error(`Unknown token: ${token}`);
    stack.push(num);
  }

  return stack;
}

export function calc(expr) {
  const stack = evaluate(expr);
  if (stack.length !== 1) throw new Error(`Expected 1 result, got ${stack.length}`);
  return stack[0];
}

export function tokenize(expr) {
  return expr.trim().split(/\s+/).filter(Boolean);
}

// Infix to RPN (shunting-yard)
export function infixToRPN(expr) {
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
  const rightAssoc = new Set(['^']);
  const tokens = expr.match(/\d+\.?\d*|[+\-*/^%()]|\w+/g) || [];
  const output = [], ops = [];

  for (const t of tokens) {
    if (/^\d/.test(t)) { output.push(t); }
    else if (t === '(') { ops.push(t); }
    else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') output.push(ops.pop());
      ops.pop(); // Remove (
    } else if (prec[t] !== undefined) {
      while (ops.length && prec[ops[ops.length - 1]] !== undefined &&
        (prec[ops[ops.length - 1]] > prec[t] || (prec[ops[ops.length - 1]] === prec[t] && !rightAssoc.has(t)))) {
        output.push(ops.pop());
      }
      ops.push(t);
    } else {
      output.push(t); // functions/constants
    }
  }
  while (ops.length) output.push(ops.pop());
  return output;
}
