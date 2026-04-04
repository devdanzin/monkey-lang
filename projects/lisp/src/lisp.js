// lisp.js — Lisp interpreter

// ===== S-Expression Parser =====
export function parse(source) {
  const tokens = tokenize(source);
  let pos = 0;

  function tokenize(src) {
    const toks = [];
    let i = 0;
    while (i < src.length) {
      if (/\s/.test(src[i])) { i++; continue; }
      if (src[i] === ';') { while (i < src.length && src[i] !== '\n') i++; continue; }
      if (src[i] === '(' || src[i] === ')') { toks.push(src[i++]); continue; }
      if (src[i] === "'") { toks.push("'"); i++; continue; }
      if (src[i] === '"') {
        i++; let str = '';
        while (i < src.length && src[i] !== '"') {
          if (src[i] === '\\') { i++; str += src[i++]; continue; }
          str += src[i++];
        }
        i++; toks.push({ type: 'string', value: str }); continue;
      }
      let atom = '';
      while (i < src.length && !/[\s()'"]/.test(src[i]) && src[i] !== ';') atom += src[i++];
      toks.push(atom);
    }
    return toks;
  }

  function readExpr() {
    if (pos >= tokens.length) return null;
    const tok = tokens[pos++];
    if (tok === '(') return readList();
    if (tok === "'") return ['quote', readExpr()];
    if (typeof tok === 'object' && tok.type === 'string') return tok.value;
    return parseAtom(tok);
  }

  function readList() {
    const list = [];
    while (pos < tokens.length && tokens[pos] !== ')') list.push(readExpr());
    pos++; // skip )
    return list;
  }

  function parseAtom(tok) {
    if (tok === '#t') return true;
    if (tok === '#f') return false;
    if (tok === 'nil') return null;
    const num = Number(tok);
    if (!isNaN(num) && tok !== '') return num;
    return Symbol.for(tok);
  }

  const exprs = [];
  while (pos < tokens.length) {
    const expr = readExpr();
    if (expr !== null) exprs.push(expr);
  }
  return exprs.length === 1 ? exprs[0] : ['begin', ...exprs];
}

// ===== Environment =====
export class Env {
  constructor(parent = null) {
    this.bindings = new Map();
    this.parent = parent;
  }

  get(name) {
    const sym = typeof name === 'symbol' ? name : Symbol.for(name);
    if (this.bindings.has(sym)) return this.bindings.get(sym);
    if (this.parent) return this.parent.get(sym);
    throw new Error(`Undefined: ${Symbol.keyFor(sym) || name}`);
  }

  set(name, value) {
    const sym = typeof name === 'symbol' ? name : Symbol.for(name);
    this.bindings.set(sym, value);
  }

  update(name, value) {
    const sym = typeof name === 'symbol' ? name : Symbol.for(name);
    if (this.bindings.has(sym)) { this.bindings.set(sym, value); return; }
    if (this.parent) { this.parent.update(sym, value); return; }
    throw new Error(`Undefined: ${Symbol.keyFor(sym)}`);
  }
}

// ===== Tail Call Trampoline =====
class TailCall {
  constructor(fn, args) { this.fn = fn; this.args = args; }
}

// ===== Evaluator =====
export function evaluate(expr, env) {
  let result = _eval(expr, env);
  while (result instanceof TailCall) result = result.fn(...result.args);
  return result;
}

function _eval(expr, env) {
  // Self-evaluating
  if (typeof expr === 'number') return expr;
  if (typeof expr === 'string') return expr;
  if (typeof expr === 'boolean') return expr;
  if (expr === null) return null;

  // Variable lookup
  if (typeof expr === 'symbol') return env.get(expr);

  // List (function application or special form)
  if (!Array.isArray(expr)) return expr;
  if (expr.length === 0) return null;

  const [head, ...args] = expr;
  const headSym = typeof head === 'symbol' ? Symbol.keyFor(head) : head;

  switch (headSym) {
    case 'quote': return args[0];

    case 'if': {
      const cond = evaluate(args[0], env);
      if (cond !== false && cond !== null) return new TailCall(_eval, [args[1], env]);
      return args[2] !== undefined ? new TailCall(_eval, [args[2], env]) : null;
    }

    case 'cond': {
      for (const clause of args) {
        const test = clause[0];
        const isElse = typeof test === 'symbol' && Symbol.keyFor(test) === 'else';
        if (isElse || evaluate(test, env)) {
          return new TailCall(_eval, [clause[1], env]);
        }
      }
      return null;
    }

    case 'define': {
      if (Array.isArray(args[0])) {
        // (define (f x y) body)
        const [name, ...params] = args[0];
        const body = args.length > 2 ? ['begin', ...args.slice(1)] : args[1];
        env.set(name, { type: 'closure', params, body, env });
      } else {
        env.set(args[0], evaluate(args[1], env));
      }
      return null;
    }

    case 'set!': {
      env.update(args[0], evaluate(args[1], env));
      return null;
    }

    case 'lambda': {
      const params = args[0];
      const body = args.length > 2 ? ['begin', ...args.slice(1)] : args[1];
      return { type: 'closure', params, body, env };
    }

    case 'let': {
      const bindings = args[0];
      const body = args.length > 2 ? ['begin', ...args.slice(1)] : args[1];
      const letEnv = new Env(env);
      for (const [name, valExpr] of bindings) {
        letEnv.set(name, evaluate(valExpr, env));
      }
      return new TailCall(_eval, [body, letEnv]);
    }

    case 'begin': {
      for (let i = 0; i < args.length - 1; i++) evaluate(args[i], env);
      return new TailCall(_eval, [args[args.length - 1], env]);
    }

    case 'and': {
      let result = true;
      for (const arg of args) {
        result = evaluate(arg, env);
        if (result === false || result === null) return false;
      }
      return result;
    }

    case 'or': {
      for (const arg of args) {
        const result = evaluate(arg, env);
        if (result !== false && result !== null) return result;
      }
      return false;
    }

    case 'define-macro': {
      const [name, params] = [args[0], args[1]];
      const body = args[2];
      env.set(name, { type: 'macro', params, body, env });
      return null;
    }

    default: {
      // Function application
      const fn = evaluate(head, env);
      const evalArgs = args.map(a => evaluate(a, env));

      if (typeof fn === 'function') return fn(...evalArgs);

      if (fn && fn.type === 'closure') {
        const callEnv = new Env(fn.env);
        for (let i = 0; i < fn.params.length; i++) {
          callEnv.set(fn.params[i], evalArgs[i]);
        }
        return new TailCall(_eval, [fn.body, callEnv]);
      }

      if (fn && fn.type === 'macro') {
        const macroEnv = new Env(fn.env);
        for (let i = 0; i < fn.params.length; i++) {
          macroEnv.set(fn.params[i], args[i]); // unevaluated
        }
        const expanded = evaluate(fn.body, macroEnv);
        return new TailCall(_eval, [expanded, env]);
      }

      throw new Error(`Not a function: ${String(head)}`);
    }
  }
}

// ===== Standard Environment =====
export function standardEnv() {
  const env = new Env();

  // Arithmetic
  env.set('+', (...args) => args.reduce((a, b) => a + b, 0));
  env.set('-', (a, ...rest) => rest.length === 0 ? -a : rest.reduce((acc, b) => acc - b, a));
  env.set('*', (...args) => args.reduce((a, b) => a * b, 1));
  env.set('/', (a, b) => a / b);
  env.set('modulo', (a, b) => a % b);

  // Comparison
  env.set('=', (a, b) => a === b);
  env.set('<', (a, b) => a < b);
  env.set('>', (a, b) => a > b);
  env.set('<=', (a, b) => a <= b);
  env.set('>=', (a, b) => a >= b);
  env.set('equal?', (a, b) => JSON.stringify(a) === JSON.stringify(b));

  // Predicates
  env.set('null?', (x) => x === null || (Array.isArray(x) && x.length === 0));
  env.set('number?', (x) => typeof x === 'number');
  env.set('string?', (x) => typeof x === 'string');
  env.set('boolean?', (x) => typeof x === 'boolean');
  env.set('list?', (x) => Array.isArray(x));
  env.set('pair?', (x) => Array.isArray(x) && x.length > 0);
  env.set('not', (x) => x === false || x === null);
  env.set('zero?', (x) => x === 0);

  // List operations
  env.set('cons', (a, b) => Array.isArray(b) ? [a, ...b] : [a, b]);
  env.set('car', (x) => x[0]);
  env.set('cdr', (x) => x.slice(1));
  env.set('list', (...args) => args);
  env.set('length', (x) => x.length);
  env.set('append', (...lists) => lists.flat());
  function applyFn(fn, args) {
    if (typeof fn === 'function') return fn(...args);
    if (fn && fn.type === 'closure') {
      const callEnv = new Env(fn.env);
      for (let i = 0; i < fn.params.length; i++) callEnv.set(fn.params[i], args[i]);
      return evaluate(fn.body, callEnv);
    }
    throw new Error('Not a function');
  }

  env.set('map', (fn, list) => list.map(x => applyFn(fn, [x])));
  env.set('filter', (fn, list) => list.filter(x => applyFn(fn, [x])));
  env.set('reduce', (fn, init, list) => list.reduce((a, b) => applyFn(fn, [a, b]), init));

  // String
  env.set('string-length', (s) => s.length);
  env.set('string-append', (...args) => args.join(''));
  env.set('number->string', (n) => String(n));
  env.set('string->number', (s) => Number(s));

  // I/O
  env.set('display', (x) => { /* console.log(x); */ return null; });
  env.set('newline', () => null);

  // Math
  env.set('abs', Math.abs);
  env.set('max', Math.max);
  env.set('min', Math.min);
  env.set('sqrt', Math.sqrt);
  env.set('expt', Math.pow);

  // Apply
  env.set('apply', (fn, args) => fn(...args));

  return env;
}

// ===== REPL helper =====
export function run(source) {
  const env = standardEnv();
  return evaluate(parse(source), env);
}
