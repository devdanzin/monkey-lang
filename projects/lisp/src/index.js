/**
 * Tiny Lisp
 *
 * A Scheme-like Lisp interpreter with:
 * - Lexical scoping and closures
 * - Macros (defmacro with quasiquote/unquote)
 * - Tail-call optimization (via trampoline)
 * - Variadic functions
 * - Standard library (map, filter, reduce, etc.)
 */

// ==================== Types ====================

const SYM = Symbol('sym');
const LIST = Symbol('list');
const NUM = Symbol('num');
const STR = Symbol('str');
const BOOL = Symbol('bool');
const NIL = Symbol('nil');
const FN = Symbol('fn');
const MACRO = Symbol('macro');
const TAIL = Symbol('tail'); // tail-call marker

const sym = (name) => ({ type: SYM, value: name });
const list = (...items) => ({ type: LIST, value: items });
const num = (n) => ({ type: NUM, value: n });
const str = (s) => ({ type: STR, value: s });
const bool = (b) => ({ type: BOOL, value: b });
const nil = () => ({ type: NIL, value: null });
const fn = (params, body, env, name = null, variadic = false) => ({ type: FN, params, body, env, name, variadic });
const macro = (params, body) => ({ type: MACRO, params, body });
const tail = (fn, args) => ({ type: TAIL, fn, args });

const isSym = (x, name) => x && x.type === SYM && (!name || x.value === name);
const isList = (x) => x && x.type === LIST;
const isNil = (x) => x && x.type === NIL;

// ==================== Reader (Tokenizer + Parser) ====================

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] === ';') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (/\s/.test(src[i])) { i++; continue; }
    if (src[i] === '(' || src[i] === ')') { tokens.push(src[i++]); continue; }
    if (src[i] === "'") { tokens.push("'"); i++; continue; }
    if (src[i] === '`') { tokens.push('`'); i++; continue; }
    if (src[i] === ',') {
      if (src[i + 1] === '@') { tokens.push(',@'); i += 2; }
      else { tokens.push(','); i++; }
      continue;
    }
    if (src[i] === '"') {
      let s = '';
      i++; // skip opening quote
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\') { i++; s += ({ n: '\n', t: '\t', '\\': '\\', '"': '"' }[src[i]] || src[i]); }
        else s += src[i];
        i++;
      }
      i++; // skip closing quote
      tokens.push({ type: 'str', value: s });
      continue;
    }
    // Atom
    let atom = '';
    while (i < src.length && !/[\s();"`,]/.test(src[i])) atom += src[i++];
    tokens.push(atom);
  }
  return tokens;
}

function parse(tokens) {
  const exprs = [];
  let pos = 0;

  function readExpr() {
    if (pos >= tokens.length) throw new Error('Unexpected EOF');
    const tok = tokens[pos++];

    if (tok === '(') {
      const items = [];
      while (tokens[pos] !== ')') {
        if (pos >= tokens.length) throw new Error('Unmatched (');
        items.push(readExpr());
      }
      pos++; // skip )
      return list(...items);
    }
    if (tok === ')') throw new Error('Unexpected )');
    if (tok === "'") return list(sym('quote'), readExpr());
    if (tok === '`') return list(sym('quasiquote'), readExpr());
    if (tok === ',') return list(sym('unquote'), readExpr());
    if (tok === ',@') return list(sym('unquote-splicing'), readExpr());
    if (typeof tok === 'object' && tok.type === 'str') return str(tok.value);
    if (tok === '#t') return bool(true);
    if (tok === '#f') return bool(false);
    if (tok === 'nil') return nil();
    if (/^-?\d+(\.\d+)?$/.test(tok)) return num(parseFloat(tok));
    return sym(tok);
  }

  while (pos < tokens.length) exprs.push(readExpr());
  return exprs;
}

function read(src) {
  return parse(tokenize(src));
}

// ==================== Environment ====================

class Env {
  constructor(parent = null) {
    this.bindings = new Map();
    this.parent = parent;
  }

  get(name) {
    if (this.bindings.has(name)) return this.bindings.get(name);
    if (this.parent) return this.parent.get(name);
    throw new Error(`Undefined: ${name}`);
  }

  set(name, value) {
    this.bindings.set(name, value);
    return value;
  }

  update(name, value) {
    if (this.bindings.has(name)) { this.bindings.set(name, value); return value; }
    if (this.parent) return this.parent.update(name, value);
    throw new Error(`Undefined: ${name}`);
  }
}

// ==================== Evaluator ====================

function evaluate(expr, env) {
  // Trampoline for tail calls
  let result = evalExpr(expr, env, false);
  while (result && result.type === TAIL) {
    const { fn: f, args } = result;
    if (f.type !== FN) throw new Error('Not a function');
    const callEnv = new Env(f.env);
    bindParams(f, args, callEnv);
    // Evaluate body forms; last one is in tail position
    for (let i = 0; i < f.body.length - 1; i++) {
      evalExpr(f.body[i], callEnv, false);
    }
    result = evalExpr(f.body[f.body.length - 1], callEnv, true);
  }
  return result;
}

function evalExpr(expr, env, tailPos) {
  if (!expr) return nil();

  switch (expr.type) {
    case NUM: case STR: case BOOL: case NIL: case FN: case MACRO:
      return expr;

    case SYM:
      return env.get(expr.value);

    case LIST: {
      const items = expr.value;
      if (items.length === 0) return nil();

      const head = items[0];

      // Special forms
      if (isSym(head, 'quote')) return items[1];

      if (isSym(head, 'quasiquote')) return expandQQ(items[1], env);

      if (isSym(head, 'if')) {
        const cond = evaluate(items[1], env);
        if (cond.type !== BOOL || cond.value) {
          return evalExpr(items[2], env, tailPos);
        } else {
          return items[3] ? evalExpr(items[3], env, tailPos) : nil();
        }
      }

      if (isSym(head, 'cond')) {
        for (let i = 1; i < items.length; i++) {
          const clause = items[i].value;
          if (isSym(clause[0], 'else') || (evaluate(clause[0], env).type !== BOOL || evaluate(clause[0], env).value)) {
            let result = nil();
            for (let j = 1; j < clause.length; j++) {
              result = j === clause.length - 1
                ? evalExpr(clause[j], env, tailPos)
                : evaluate(clause[j], env);
            }
            return result;
          }
        }
        return nil();
      }

      if (isSym(head, 'define')) {
        if (isList(items[1])) {
          // (define (f x y) body...)
          const fName = items[1].value[0].value;
          const params = items[1].value.slice(1).map(p => p.value);
          const body = items.slice(2);
          const variadic = params.includes('.');
          let paramNames = params;
          if (variadic) {
            const dotIdx = params.indexOf('.');
            paramNames = [...params.slice(0, dotIdx), params[dotIdx + 1]];
          }
          const f = fn(paramNames, body, env, fName, variadic);
          return env.set(fName, f);
        }
        const val = evaluate(items[2], env);
        return env.set(items[1].value, val);
      }

      if (isSym(head, 'set!')) {
        const val = evaluate(items[2], env);
        return env.update(items[1].value, val);
      }

      if (isSym(head, 'lambda') || isSym(head, 'λ')) {
        const params = items[1].value.map(p => p.value);
        const body = items.slice(2);
        const variadic = params.includes('.');
        let paramNames = params;
        if (variadic) {
          const dotIdx = params.indexOf('.');
          paramNames = [...params.slice(0, dotIdx), params[dotIdx + 1]];
        }
        return fn(paramNames, body, env, null, variadic);
      }

      if (isSym(head, 'let')) {
        const letEnv = new Env(env);
        for (const binding of items[1].value) {
          const [name, valExpr] = binding.value;
          letEnv.set(name.value, evaluate(valExpr, letEnv));
        }
        let result = nil();
        for (let i = 2; i < items.length; i++) {
          result = i === items.length - 1
            ? evalExpr(items[i], letEnv, tailPos)
            : evaluate(items[i], letEnv);
        }
        return result;
      }

      if (isSym(head, 'begin')) {
        let result = nil();
        for (let i = 1; i < items.length; i++) {
          result = i === items.length - 1
            ? evalExpr(items[i], env, tailPos)
            : evaluate(items[i], env);
        }
        return result;
      }

      if (isSym(head, 'and')) {
        let result = bool(true);
        for (let i = 1; i < items.length; i++) {
          result = evaluate(items[i], env);
          if (result.type === BOOL && !result.value) return result;
        }
        return result;
      }

      if (isSym(head, 'or')) {
        for (let i = 1; i < items.length; i++) {
          const result = evaluate(items[i], env);
          if (result.type !== BOOL || result.value) return result;
        }
        return bool(false);
      }

      if (isSym(head, 'defmacro')) {
        const name = items[1].value;
        const params = items[2].value.map(p => p.value);
        const body = items.slice(3);
        return env.set(name, macro(params, body));
      }

      // Function call
      const func = evaluate(head, env);

      // Macro expansion
      if (func && func.type === MACRO) {
        const macroEnv = new Env(env);
        for (let i = 0; i < func.params.length; i++) {
          macroEnv.set(func.params[i], items[i + 1]); // unevaluated!
        }
        let expanded = nil();
        for (const b of func.body) {
          expanded = evaluate(b, macroEnv);
        }
        return evalExpr(expanded, env, tailPos);
      }

      // Built-in function
      if (typeof func === 'function') {
        const args = items.slice(1).map(a => evaluate(a, env));
        return func(...args);
      }

      // User function
      if (func && func.type === FN) {
        const args = items.slice(1).map(a => evaluate(a, env));
        if (tailPos) return tail(func, args);
        const callEnv = new Env(func.env);
        bindParams(func, args, callEnv);
        let result = nil();
        for (let i = 0; i < func.body.length; i++) {
          result = i === func.body.length - 1
            ? evalExpr(func.body[i], callEnv, true)
            : evaluate(func.body[i], callEnv);
        }
        // Trampoline tail calls
        while (result && result.type === TAIL) {
          const { fn: f, args: a } = result;
          const e = new Env(f.env);
          bindParams(f, a, e);
          for (let i = 0; i < f.body.length - 1; i++) evaluate(f.body[i], e);
          result = evalExpr(f.body[f.body.length - 1], e, true);
        }
        return result;
      }

      throw new Error(`Not callable: ${JSON.stringify(func)}`);
    }

    default:
      throw new Error(`Unknown expr type: ${expr.type?.toString()}`);
  }
}

function bindParams(f, args, env) {
  if (f.variadic) {
    const fixed = f.params.length - 1;
    for (let i = 0; i < fixed; i++) env.set(f.params[i], args[i] || nil());
    env.set(f.params[fixed], list(...args.slice(fixed)));
  } else {
    for (let i = 0; i < f.params.length; i++) env.set(f.params[i], args[i] || nil());
  }
  if (f.name) env.set(f.name, f);
}

function expandQQ(expr, env) {
  if (!isList(expr)) return expr;
  if (expr.value.length > 0 && isSym(expr.value[0], 'unquote')) {
    return evaluate(expr.value[1], env);
  }
  const result = [];
  for (const item of expr.value) {
    if (isList(item) && item.value.length > 0 && isSym(item.value[0], 'unquote-splicing')) {
      const val = evaluate(item.value[1], env);
      if (isList(val)) result.push(...val.value);
    } else {
      result.push(expandQQ(item, env));
    }
  }
  return list(...result);
}

// ==================== Printer ====================

function print(expr) {
  if (!expr) return 'nil';
  switch (expr.type) {
    case NUM: return String(expr.value);
    case STR: return `"${expr.value}"`;
    case BOOL: return expr.value ? '#t' : '#f';
    case NIL: return 'nil';
    case SYM: return expr.value;
    case LIST: return `(${expr.value.map(print).join(' ')})`;
    case FN: return `<fn${expr.name ? ':' + expr.name : ''}>`;
    case MACRO: return '<macro>';
    default: return String(expr);
  }
}

// ==================== Standard Environment ====================

function createEnv() {
  const env = new Env();
  const output = [];

  // Arithmetic
  env.set('+', (...args) => num(args.reduce((acc, b) => acc + b.value, 0)));
  env.set('-', (a, b) => b ? num(a.value - b.value) : num(-a.value));
  env.set('*', (...args) => num(args.reduce((acc, b) => acc * b.value, 1)));
  env.set('/', (a, b) => num(a.value / b.value));
  env.set('modulo', (a, b) => num(a.value % b.value));

  // Comparison
  env.set('=', (a, b) => bool(a.value === b.value));
  env.set('<', (a, b) => bool(a.value < b.value));
  env.set('>', (a, b) => bool(a.value > b.value));
  env.set('<=', (a, b) => bool(a.value <= b.value));
  env.set('>=', (a, b) => bool(a.value >= b.value));
  env.set('not', (a) => bool(a.type === BOOL ? !a.value : false));
  env.set('eq?', (a, b) => bool(a.type === b.type && a.value === b.value));

  // List operations
  env.set('cons', (a, b) => isList(b) ? list(a, ...b.value) : list(a, b));
  env.set('car', (a) => a.value[0] || nil());
  env.set('cdr', (a) => list(...a.value.slice(1)));
  env.set('list', (...args) => list(...args));
  env.set('length', (a) => num(isList(a) ? a.value.length : (a.type === STR ? a.value.length : 0)));
  env.set('append', (...lists) => list(...lists.flatMap(l => isList(l) ? l.value : [l])));
  env.set('null?', (a) => bool(isNil(a) || (isList(a) && a.value.length === 0)));
  env.set('pair?', (a) => bool(isList(a) && a.value.length > 0));
  env.set('list?', (a) => bool(isList(a)));

  // Type checks
  env.set('number?', (a) => bool(a.type === NUM));
  env.set('string?', (a) => bool(a.type === STR));
  env.set('symbol?', (a) => bool(a.type === SYM));
  env.set('boolean?', (a) => bool(a.type === BOOL));
  env.set('procedure?', (a) => bool(a.type === FN || typeof a === 'function'));

  // String
  env.set('string-append', (...args) => str(args.map(a => a.value).join('')));
  env.set('number->string', (a) => str(String(a.value)));
  env.set('string->number', (a) => num(parseFloat(a.value)));

  // Higher-order
  env.set('map', (f, lst) => {
    const results = lst.value.map(item => {
      if (typeof f === 'function') return f(item);
      return evaluate(list(f, list(sym('quote'), item)), env);
    });
    return list(...results);
  });

  env.set('filter', (f, lst) => {
    const results = lst.value.filter(item => {
      const result = typeof f === 'function' ? f(item) : evaluate(list(f, list(sym('quote'), item)), env);
      return result.type !== BOOL || result.value;
    });
    return list(...results);
  });

  env.set('reduce', (f, init, lst) => {
    let acc = init;
    for (const item of lst.value) {
      acc = typeof f === 'function' ? f(acc, item) : evaluate(list(f, list(sym('quote'), acc), list(sym('quote'), item)), env);
    }
    return acc;
  });

  env.set('apply', (f, args) => {
    if (typeof f === 'function') return f(...args.value);
    const callExpr = list(f, ...args.value.map(a => list(sym('quote'), a)));
    return evaluate(callExpr, env);
  });

  // I/O
  env.set('display', (a) => { output.push(a.type === STR ? a.value : print(a)); return nil(); });
  env.set('newline', () => { output.push('\n'); return nil(); });

  // Math
  env.set('abs', (a) => num(Math.abs(a.value)));
  env.set('max', (...args) => num(Math.max(...args.map(a => a.value))));
  env.set('min', (...args) => num(Math.min(...args.map(a => a.value))));
  env.set('floor', (a) => num(Math.floor(a.value)));
  env.set('ceil', (a) => num(Math.ceil(a.value)));
  env.set('sqrt', (a) => num(Math.sqrt(a.value)));
  env.set('expt', (a, b) => num(Math.pow(a.value, b.value)));

  return { env, output };
}

// ==================== Run ====================

function run(src) {
  const { env, output } = createEnv();
  const exprs = read(src);
  let result = nil();
  for (const expr of exprs) {
    result = evaluate(expr, env);
  }
  return { result, output, print: print(result) };
}

module.exports = {
  // Types
  sym, list, num, str, bool, nil, fn, macro,
  SYM, LIST, NUM, STR, BOOL, NIL, FN, MACRO,
  // Core
  tokenize, parse, read, Env, evaluate, print,
  createEnv, run,
};
