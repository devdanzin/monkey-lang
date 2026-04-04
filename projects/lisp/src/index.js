// ===== Lisp Interpreter =====
//
// A simple Scheme-like Lisp with:
// - Reader (tokenizer + parser)
// - Evaluator with environments
// - Special forms: define, lambda, if, cond, quote, let, begin, set!
// - First-class closures
// - Tail call optimization (trampoline)
// - Standard library: arithmetic, list ops, predicates

// ===== Types =====

export class LispSymbol {
  constructor(name) { this.name = name; }
  toString() { return this.name; }
}

export class LispList {
  constructor(items) { this.items = items; }
  toString() { return `(${this.items.map(lispToString).join(' ')})`; }
  get length() { return this.items.length; }
  get(i) { return this.items[i]; }
}

export class LispLambda {
  constructor(params, body, env, name) {
    this.params = params;
    this.body = body;
    this.env = env;
    this.name = name || 'lambda';
  }
  toString() { return `#<lambda:${this.name}>`; }
}

export class LispMacro {
  constructor(params, body, env) { this.params = params; this.body = body; this.env = env; }
  toString() { return '#<macro>'; }
}

const NIL = Symbol.for('nil');
export { NIL };

export function lispToString(val) {
  if (val === NIL) return 'nil';
  if (val === true) return '#t';
  if (val === false) return '#f';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return `"${val}"`;
  if (val instanceof LispSymbol) return val.name;
  if (val instanceof LispList) return val.toString();
  if (val instanceof LispLambda) return val.toString();
  if (typeof val === 'function') return '#<builtin>';
  return String(val);
}

// ===== Reader =====

export function read(input) {
  const tokens = tokenize(input);
  let pos = 0;
  
  function peek() { return tokens[pos]; }
  function advance() { return tokens[pos++]; }
  
  function parseExpr() {
    const tok = peek();
    if (tok === undefined) throw new Error('Unexpected end of input');
    
    if (tok === '(') {
      advance();
      const items = [];
      while (peek() !== ')') {
        if (peek() === undefined) throw new Error('Unmatched (');
        items.push(parseExpr());
      }
      advance(); // )
      return new LispList(items);
    }
    
    if (tok === "'") {
      advance();
      return new LispList([new LispSymbol('quote'), parseExpr()]);
    }
    
    advance();
    
    // Number
    if (/^-?\d+(\.\d+)?$/.test(tok)) return Number(tok);
    
    // String
    if (tok.startsWith('"') && tok.endsWith('"')) return tok.slice(1, -1);
    
    // Boolean
    if (tok === '#t') return true;
    if (tok === '#f') return false;
    if (tok === 'nil') return NIL;
    
    // Symbol
    return new LispSymbol(tok);
  }
  
  const result = parseExpr();
  return result;
}

function tokenize(input) {
  const tokens = [];
  let i = 0;
  
  while (i < input.length) {
    // Whitespace
    if (/\s/.test(input[i])) { i++; continue; }
    
    // Comment
    if (input[i] === ';') {
      while (i < input.length && input[i] !== '\n') i++;
      continue;
    }
    
    // Parens and quote
    if ('()\''.includes(input[i])) {
      tokens.push(input[i]);
      i++;
      continue;
    }
    
    // String
    if (input[i] === '"') {
      let str = '"';
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\') { str += input[i++]; }
        str += input[i++];
      }
      str += '"';
      i++;
      tokens.push(str);
      continue;
    }
    
    // Atom (symbol, number)
    let atom = '';
    while (i < input.length && !/[\s()'";]/.test(input[i])) {
      atom += input[i++];
    }
    if (atom) tokens.push(atom);
  }
  
  return tokens;
}

// Read multiple expressions
export function readAll(input) {
  const tokens = tokenize(input);
  const exprs = [];
  let pos = 0;
  
  function peek() { return tokens[pos]; }
  function advance() { return tokens[pos++]; }
  
  function parseExpr() {
    const tok = peek();
    if (tok === '(') {
      advance();
      const items = [];
      while (peek() !== ')') items.push(parseExpr());
      advance();
      return new LispList(items);
    }
    if (tok === "'") { advance(); return new LispList([new LispSymbol('quote'), parseExpr()]); }
    advance();
    if (/^-?\d+(\.\d+)?$/.test(tok)) return Number(tok);
    if (tok.startsWith('"') && tok.endsWith('"')) return tok.slice(1, -1);
    if (tok === '#t') return true;
    if (tok === '#f') return false;
    if (tok === 'nil') return NIL;
    return new LispSymbol(tok);
  }
  
  while (pos < tokens.length) exprs.push(parseExpr());
  return exprs;
}

// ===== Environment =====

export class Env {
  constructor(bindings = new Map(), parent = null) {
    this.bindings = bindings;
    this.parent = parent;
  }
  
  get(name) {
    if (this.bindings.has(name)) return this.bindings.get(name);
    if (this.parent) return this.parent.get(name);
    throw new Error(`Undefined: ${name}`);
  }
  
  set(name, value) {
    this.bindings.set(name, value);
  }
  
  // set! — find and update in the defining scope
  update(name, value) {
    if (this.bindings.has(name)) { this.bindings.set(name, value); return; }
    if (this.parent) { this.parent.update(name, value); return; }
    throw new Error(`Undefined: ${name}`);
  }
  
  extend(names, values) {
    const bindings = new Map();
    for (let i = 0; i < names.length; i++) {
      bindings.set(names[i], values[i]);
    }
    return new Env(bindings, this);
  }
}

// ===== Evaluator =====

// Trampoline for tail call optimization
class Thunk {
  constructor(fn) { this.fn = fn; }
}

function trampoline(result) {
  while (result instanceof Thunk) result = result.fn();
  return result;
}

export function evaluate(expr, env) {
  return trampoline(eval_(expr, env));
}

function eval_(expr, env) {
  // Number, string, boolean, nil
  if (typeof expr === 'number' || typeof expr === 'string' || typeof expr === 'boolean') {
    return expr;
  }
  if (expr === NIL) return NIL;
  
  // Symbol → lookup
  if (expr instanceof LispSymbol) {
    return env.get(expr.name);
  }
  
  // List → special form or function call
  if (expr instanceof LispList) {
    if (expr.length === 0) return NIL;
    
    const head = expr.get(0);
    
    // Special forms
    if (head instanceof LispSymbol) {
      switch (head.name) {
        case 'quote':
          return expr.get(1);
        
        case 'if': {
          const cond = evaluate(expr.get(1), env);
          if (cond !== false && cond !== NIL) {
            return new Thunk(() => eval_(expr.get(2), env));
          }
          return expr.length > 3 ? new Thunk(() => eval_(expr.get(3), env)) : NIL;
        }
        
        case 'cond': {
          for (let i = 1; i < expr.length; i++) {
            const clause = expr.get(i);
            if (clause.get(0) instanceof LispSymbol && clause.get(0).name === 'else') {
              return new Thunk(() => eval_(clause.get(1), env));
            }
            const test = evaluate(clause.get(0), env);
            if (test !== false && test !== NIL) {
              return new Thunk(() => eval_(clause.get(1), env));
            }
          }
          return NIL;
        }
        
        case 'define': {
          if (expr.get(1) instanceof LispSymbol) {
            // (define x expr)
            env.set(expr.get(1).name, evaluate(expr.get(2), env));
          } else if (expr.get(1) instanceof LispList) {
            // (define (f x y) body) → sugar for (define f (lambda (x y) body))
            const name = expr.get(1).get(0).name;
            const params = expr.get(1).items.slice(1).map(s => s.name);
            const body = expr.items.slice(2);
            const lambda = new LispLambda(params, body.length === 1 ? body[0] : new LispList([new LispSymbol('begin'), ...body]), env, name);
            env.set(name, lambda);
          }
          return NIL;
        }
        
        case 'set!': {
          env.update(expr.get(1).name, evaluate(expr.get(2), env));
          return NIL;
        }
        
        case 'lambda': {
          const params = expr.get(1).items.map(s => s.name);
          const body = expr.items.slice(2);
          return new LispLambda(
            params,
            body.length === 1 ? body[0] : new LispList([new LispSymbol('begin'), ...body]),
            env,
          );
        }
        
        case 'let': {
          const bindings = expr.get(1);
          const body = expr.items.slice(2);
          const names = [];
          const values = [];
          for (const b of bindings.items) {
            names.push(b.get(0).name);
            values.push(evaluate(b.get(1), env));
          }
          const newEnv = env.extend(names, values);
          const bodyExpr = body.length === 1 ? body[0] : new LispList([new LispSymbol('begin'), ...body]);
          return new Thunk(() => eval_(bodyExpr, newEnv));
        }
        
        case 'begin': {
          for (let i = 1; i < expr.length - 1; i++) {
            evaluate(expr.get(i), env);
          }
          return new Thunk(() => eval_(expr.get(expr.length - 1), env));
        }
        
        case 'and': {
          let result = true;
          for (let i = 1; i < expr.length; i++) {
            result = evaluate(expr.get(i), env);
            if (result === false || result === NIL) return false;
          }
          return result;
        }
        
        case 'or': {
          for (let i = 1; i < expr.length; i++) {
            const result = evaluate(expr.get(i), env);
            if (result !== false && result !== NIL) return result;
          }
          return false;
        }
      }
    }
    
    // Function call
    const fn = evaluate(head, env);
    const args = expr.items.slice(1).map(a => evaluate(a, env));
    
    if (fn instanceof LispLambda) {
      const newEnv = fn.env.extend(fn.params, args);
      return new Thunk(() => eval_(fn.body, newEnv));
    }
    
    if (typeof fn === 'function') {
      return fn(...args);
    }
    
    throw new Error(`Not a function: ${lispToString(fn)}`);
  }
  
  throw new Error(`Cannot evaluate: ${lispToString(expr)}`);
}

// ===== Standard Library =====

export function standardEnv() {
  const env = new Env();
  
  // Arithmetic
  env.set('+', (...args) => args.reduce((a, b) => a + b, 0));
  env.set('-', (...args) => args.length === 1 ? -args[0] : args.reduce((a, b) => a - b));
  env.set('*', (...args) => args.reduce((a, b) => a * b, 1));
  env.set('/', (a, b) => Math.trunc(a / b));
  env.set('%', (a, b) => a % b);
  
  // Comparison
  env.set('=', (a, b) => a === b);
  env.set('<', (a, b) => a < b);
  env.set('>', (a, b) => a > b);
  env.set('<=', (a, b) => a <= b);
  env.set('>=', (a, b) => a >= b);
  
  // Predicates
  env.set('null?', (x) => x === NIL || (x instanceof LispList && x.length === 0));
  env.set('number?', (x) => typeof x === 'number');
  env.set('string?', (x) => typeof x === 'string');
  env.set('symbol?', (x) => x instanceof LispSymbol);
  env.set('list?', (x) => x instanceof LispList);
  env.set('boolean?', (x) => typeof x === 'boolean');
  env.set('zero?', (x) => x === 0);
  env.set('positive?', (x) => x > 0);
  env.set('negative?', (x) => x < 0);
  env.set('even?', (x) => x % 2 === 0);
  env.set('odd?', (x) => x % 2 !== 0);
  env.set('not', (x) => x === false || x === NIL);
  
  // List operations
  env.set('cons', (a, b) => {
    if (b instanceof LispList) return new LispList([a, ...b.items]);
    return new LispList([a, b]);
  });
  env.set('car', (lst) => lst.get(0));
  env.set('cdr', (lst) => new LispList(lst.items.slice(1)));
  env.set('list', (...args) => new LispList(args));
  env.set('length', (lst) => lst.length);
  env.set('append', (a, b) => new LispList([...a.items, ...b.items]));
  env.set('map', (fn, lst) => new LispList(lst.items.map(x => {
    if (fn instanceof LispLambda) {
      const callEnv = fn.env.extend(fn.params, [x]);
      return evaluate(fn.body, callEnv);
    }
    return fn(x);
  })));
  env.set('filter', (fn, lst) => new LispList(lst.items.filter(x => {
    let result;
    if (fn instanceof LispLambda) {
      const callEnv = fn.env.extend(fn.params, [x]);
      result = evaluate(fn.body, callEnv);
    } else {
      result = fn(x);
    }
    return result !== false && result !== NIL;
  })));
  env.set('reduce', (fn, init, lst) => {
    let acc = init;
    for (const x of lst.items) {
      if (fn instanceof LispLambda) {
        const callEnv = fn.env.extend(fn.params, [acc, x]);
        acc = evaluate(fn.body, callEnv);
      } else {
        acc = fn(acc, x);
      }
    }
    return acc;
  });
  
  // String operations
  env.set('string-length', (s) => s.length);
  env.set('string-append', (...args) => args.join(''));
  env.set('number->string', (n) => String(n));
  env.set('string->number', (s) => Number(s));
  
  // I/O
  env.set('display', (x) => { process.stdout.write(lispToString(x)); return NIL; });
  env.set('newline', () => { process.stdout.write('\n'); return NIL; });
  
  // Math
  env.set('abs', Math.abs);
  env.set('max', Math.max);
  env.set('min', Math.min);
  
  return env;
}

// ===== REPL Helper =====

export function run(code, env) {
  if (!env) env = standardEnv();
  const exprs = readAll(code);
  let result = NIL;
  for (const expr of exprs) {
    result = evaluate(expr, env);
  }
  return result;
}
