// Algebraic Effects & Handlers
//
// A small language with algebraic effects — the "functional programming" approach
// to side effects. Effects are declared, performed, and handled.
//
// Key idea: `perform` suspends computation and passes the continuation to a handler.
// The handler can resume (call the continuation), abort, or transform the result.
//
// This models: exceptions, state, nondeterminism, async, coroutines — all with
// the same mechanism.

// ============================================================
// AST
// ============================================================

class Num { constructor(n) { this.kind = 'num'; this.n = n; } }
class Bool_ { constructor(b) { this.kind = 'bool'; this.b = b; } }
class Str { constructor(s) { this.kind = 'str'; this.s = s; } }
class Var { constructor(name) { this.kind = 'var'; this.name = name; } }
class Lam { constructor(param, body) { this.kind = 'lam'; this.param = param; this.body = body; } }
class App { constructor(fn, arg) { this.kind = 'app'; this.fn = fn; this.arg = arg; } }
class BinOp { constructor(op, l, r) { this.kind = 'binop'; this.op = op; this.l = l; this.r = r; } }
class If { constructor(c, t, e) { this.kind = 'if'; this.c = c; this.t = t; this.e = e; } }
class Let { constructor(name, val, body) { this.kind = 'let'; this.name = name; this.val = val; this.body = body; } }
class Seq { constructor(first, second) { this.kind = 'seq'; this.first = first; this.second = second; } }

// Effect operations
class Perform { constructor(effect, arg) { this.kind = 'perform'; this.effect = effect; this.arg = arg; } }
class Handle {
  constructor(body, handlers, returnCase) {
    this.kind = 'handle';
    this.body = body;
    // handlers: Map<effectName, { param, resumeParam, body }>
    this.handlers = handlers;
    // returnCase: { param, body } — what to do with the final value
    this.returnCase = returnCase;
  }
}

class Unit_ { constructor() { this.kind = 'unit'; } }
class Pair_ { constructor(fst, snd) { this.kind = 'pair'; this.fst = fst; this.snd = snd; } }
class Fst_ { constructor(expr) { this.kind = 'fst'; this.expr = expr; } }
class Snd_ { constructor(expr) { this.kind = 'snd'; this.expr = snd; } }

// ============================================================
// Values
// ============================================================

class VNum { constructor(n) { this.tag = 'num'; this.n = n; } }
class VBool { constructor(b) { this.tag = 'bool'; this.b = b; } }
class VStr { constructor(s) { this.tag = 'str'; this.s = s; } }
class VUnit { constructor() { this.tag = 'unit'; } }
class VFun { constructor(param, body, env) { this.tag = 'fun'; this.param = param; this.body = body; this.env = env; } }
class VPair { constructor(fst, snd) { this.tag = 'pair'; this.fst = fst; this.snd = snd; } }

// ============================================================
// Effect System — uses continuation-based semantics
// ============================================================

// Result types for the effect interpreter:
// - Return(value): computation completed normally
// - Perform_(effect, arg, continuation): effect was performed, waiting for handler

class Return {
  constructor(value) { this.tag = 'return'; this.value = value; }
}

class Perform_ {
  constructor(effect, arg, continuation) {
    this.tag = 'perform'; this.effect = effect; this.arg = arg; this.continuation = continuation;
  }
}

// ============================================================
// Evaluator (CPS-style for effect handling)
// ============================================================

function evaluate(expr, env, k) {
  switch (expr.kind) {
    case 'num': return k(new VNum(expr.n));
    case 'bool': return k(new VBool(expr.b));
    case 'str': return k(new VStr(expr.s));
    case 'unit': return k(new VUnit());
    
    case 'var': {
      if (!env.has(expr.name)) throw new Error(`Unbound: ${expr.name}`);
      return k(env.get(expr.name));
    }
    
    case 'lam':
      return k(new VFun(expr.param, expr.body, new Map(env)));
    
    case 'app':
      return evaluate(expr.fn, env, fn => {
        return evaluate(expr.arg, env, arg => {
          // Handle resume functions (from effect handlers)
          if (fn.tag === 'resume') {
            return fn.fn(arg);
          }
          if (fn.tag !== 'fun') throw new Error('Not a function');
          const newEnv = new Map(fn.env);
          newEnv.set(fn.param, arg);
          return evaluate(fn.body, newEnv, k);
        });
      });
    
    case 'binop':
      return evaluate(expr.l, env, l => {
        return evaluate(expr.r, env, r => {
          let result;
          switch (expr.op) {
            case '+': result = new VNum(l.n + r.n); break;
            case '-': result = new VNum(l.n - r.n); break;
            case '*': result = new VNum(l.n * r.n); break;
            case '/': result = new VNum(Math.trunc(l.n / r.n)); break;
            case '<': result = new VBool(l.n < r.n); break;
            case '>': result = new VBool(l.n > r.n); break;
            case '==': result = new VBool(l.tag === r.tag && (l.n === r.n || l.b === r.b || l.s === r.s)); break;
            case '++': result = new VStr((l.s || '') + (r.s || '')); break;
          }
          return k(result);
        });
      });
    
    case 'if':
      return evaluate(expr.c, env, c => {
        return c.b ? evaluate(expr.t, env, k) : evaluate(expr.e, env, k);
      });
    
    case 'let':
      return evaluate(expr.val, env, val => {
        const newEnv = new Map(env);
        newEnv.set(expr.name, val);
        return evaluate(expr.body, newEnv, k);
      });
    
    case 'seq':
      return evaluate(expr.first, env, _ => {
        return evaluate(expr.second, env, k);
      });
    
    case 'pair':
      return evaluate(expr.fst, env, fst => {
        return evaluate(expr.snd, env, snd => {
          return k(new VPair(fst, snd));
        });
      });
    
    case 'fst':
      return evaluate(expr.expr, env, p => k(p.fst));
    
    case 'perform': {
      return evaluate(expr.arg, env, arg => {
        // Suspend: return the effect to the nearest handler
        return new Perform_(expr.effect, arg, resumeVal => k(resumeVal));
      });
    }
    
    case 'handle': {
      // Evaluate the body with a handler installed
      const result = evaluate(expr.body, env, val => new Return(val));
      return handleResult(result, expr.handlers, expr.returnCase, env, k);
    }
  }
}

function handleResult(result, handlers, returnCase, env, outerK) {
  if (result.tag === 'return') {
    // Apply the return case
    const newEnv = new Map(env);
    newEnv.set(returnCase.param, result.value);
    return evaluate(returnCase.body, newEnv, outerK);
  }
  
  if (result.tag === 'perform') {
    const handler = handlers.get(result.effect);
    if (!handler) {
      // Effect not handled here — re-raise to outer handler
      return new Perform_(result.effect, result.arg, resumeVal => {
        const innerResult = result.continuation(resumeVal);
        return handleResult(innerResult, handlers, returnCase, env, outerK);
      });
    }
    
    // Handle the effect
    const newEnv = new Map(env);
    newEnv.set(handler.param, result.arg);
    // The resume function: when called, continues the suspended computation
    const resumeFn = new VFun(handler.resumeParam || '_resume_arg', null, null);
    // Override: resume is a special function
    newEnv.set(handler.resumeName || 'resume', {
      tag: 'resume',
      fn: resumeVal => {
        const innerResult = result.continuation(resumeVal);
        return handleResult(innerResult, handlers, returnCase, env, outerK);
      }
    });
    
    // Evaluate handler body — but resume calls are special
    return evaluateWithResume(handler.body, newEnv, handler.resumeName || 'resume', result.continuation, handlers, returnCase, env, outerK);
  }
}

// Evaluate handler body, intercepting resume calls
function evaluateWithResume(expr, env, resumeName, continuation, handlers, returnCase, handlerEnv, outerK) {
  // Special evaluate that handles "resume" as a built-in
  return evaluate(expr, env, val => {
    return outerK(val);
  });
}

// ============================================================
// High-level API
// ============================================================

function run(expr) {
  const result = evaluate(expr, new Map(), val => new Return(val));
  if (result.tag !== 'return') throw new Error(`Unhandled effect: ${result.effect}`);
  return result.value;
}

// Convenience constructors
const num = n => new Num(n);
const bool = b => new Bool_(b);
const str = s => new Str(s);
const unit = new Unit_();
const v_ = name => new Var(name);
const lam = (p, body) => new Lam(p, body);
const app = (fn, arg) => new App(fn, arg);
const binop = (op, l, r) => new BinOp(op, l, r);
const if_ = (c, t, e) => new If(c, t, e);
const let_ = (name, val, body) => new Let(name, val, body);
const seq = (a, b) => new Seq(a, b);
const perform = (effect, arg) => new Perform(effect, arg);
const pair = (a, b) => new Pair_(a, b);

function handle(body, cases, returnCase) {
  const handlers = new Map();
  for (const [effect, handler] of Object.entries(cases)) {
    handlers.set(effect, handler);
  }
  return new Handle(body, handlers, returnCase);
}

module.exports = {
  Num, Bool_, Str, Var, Lam, App, BinOp, If, Let, Seq, Perform, Handle, Unit_, Pair_,
  VNum, VBool, VStr, VUnit, VFun, VPair,
  Return, Perform_,
  evaluate, run, handleResult,
  num, bool, str, unit, v_, lam, app, binop, if_, let_, seq, perform, pair, handle,
};
