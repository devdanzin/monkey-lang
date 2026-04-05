// Denotational Semantics — Domain-theoretic interpretation of lambda calculus
//
// Models a simple language with:
// - A flat domain for integers and booleans (with ⊥ bottom element)
// - Function spaces as continuous functions
// - Fixed-point operator (Y/fix) via Kleene ascending chain
// - Environments as maps from names to domain values

// ============================================================
// Domain Values
// ============================================================

const BOTTOM = Symbol('⊥'); // undefined/divergent computation

class DInt {
  constructor(value) { this.tag = 'int'; this.value = value; }
  toString() { return String(this.value); }
}

class DBool {
  constructor(value) { this.tag = 'bool'; this.value = value; }
  toString() { return String(this.value); }
}

class DFun {
  constructor(fn) { this.tag = 'fun'; this.fn = fn; }
  toString() { return '<function>'; }
}

class DPair {
  constructor(fst, snd) { this.tag = 'pair'; this.fst = fst; this.snd = snd; }
  toString() { return `(${valToString(this.fst)}, ${valToString(this.snd)})`; }
}

function valToString(v) {
  if (v === BOTTOM) return '⊥';
  return v.toString();
}

function valEqual(a, b) {
  if (a === BOTTOM && b === BOTTOM) return true;
  if (a === BOTTOM || b === BOTTOM) return false;
  if (a.tag !== b.tag) return false;
  switch (a.tag) {
    case 'int': return a.value === b.value;
    case 'bool': return a.value === b.value;
    case 'pair': return valEqual(a.fst, b.fst) && valEqual(a.snd, b.snd);
    case 'fun': return false; // functions can't be compared extensionally in finite time
  }
}

// ============================================================
// Abstract Syntax
// ============================================================

class Lit { constructor(value) { this.kind = 'lit'; this.value = value; } }
class Var { constructor(name) { this.kind = 'var'; this.name = name; } }
class Lam { constructor(param, body) { this.kind = 'lam'; this.param = param; this.body = body; } }
class App { constructor(fn, arg) { this.kind = 'app'; this.fn = fn; this.arg = arg; } }
class If { constructor(cond, then, else_) { this.kind = 'if'; this.cond = cond; this.then = then; this.else_ = else_; } }
class Let { constructor(name, value, body) { this.kind = 'let'; this.name = name; this.value = value; this.body = body; } }
class Fix { constructor(body) { this.kind = 'fix'; this.body = body; } }
class BinOp { constructor(op, left, right) { this.kind = 'binop'; this.op = op; this.left = left; this.right = right; } }
class Pair_ { constructor(fst, snd) { this.kind = 'pair'; this.fst = fst; this.snd = snd; } }
class Fst { constructor(expr) { this.kind = 'fst'; this.expr = expr; } }
class Snd { constructor(expr) { this.kind = 'snd'; this.expr = expr; } }

// ============================================================
// Environment
// ============================================================

class Env {
  constructor(bindings = new Map()) { this.bindings = bindings; }
  extend(name, value) {
    const m = new Map(this.bindings);
    m.set(name, value);
    return new Env(m);
  }
  lookup(name) {
    if (!this.bindings.has(name)) return BOTTOM;
    return this.bindings.get(name);
  }
}

// ============================================================
// Denotation Function ⟦·⟧
// ============================================================

function denote(expr, env = new Env()) {
  switch (expr.kind) {
    case 'lit':
      if (typeof expr.value === 'number') return new DInt(expr.value);
      if (typeof expr.value === 'boolean') return new DBool(expr.value);
      return BOTTOM;
    
    case 'var':
      return env.lookup(expr.name);
    
    case 'lam':
      // ⟦λx.e⟧ρ = d ↦ ⟦e⟧ρ[x↦d]
      return new DFun(d => denote(expr.body, env.extend(expr.param, d)));
    
    case 'app': {
      // ⟦e₁ e₂⟧ρ = ⟦e₁⟧ρ(⟦e₂⟧ρ)
      const fn = denote(expr.fn, env);
      if (fn === BOTTOM) return BOTTOM;
      if (fn.tag !== 'fun') return BOTTOM;
      const arg = denote(expr.arg, env);
      return fn.fn(arg);
    }
    
    case 'if': {
      const cond = denote(expr.cond, env);
      if (cond === BOTTOM) return BOTTOM;
      if (cond.tag !== 'bool') return BOTTOM;
      return cond.value ? denote(expr.then, env) : denote(expr.else_, env);
    }
    
    case 'let': {
      const val = denote(expr.value, env);
      return denote(expr.body, env.extend(expr.name, val));
    }
    
    case 'fix': {
      // Fixed-point: iterate from ⊥ until stable (Kleene chain)
      // fix f = f (f (f (... ⊥)))
      // In practice, we return a lazy wrapper
      const f = denote(expr.body, env);
      if (f === BOTTOM || f.tag !== 'fun') return BOTTOM;
      // For functions, we build a recursive function
      // fix f where f expects a function: we create a DFun that applies itself
      let result = BOTTOM;
      const MAX_ITER = 1000;
      for (let i = 0; i < MAX_ITER; i++) {
        const next = f.fn(result);
        if (valEqual(next, result)) return result;
        result = next;
      }
      return result;
    }
    
    case 'binop': {
      const l = denote(expr.left, env);
      const r = denote(expr.right, env);
      if (l === BOTTOM || r === BOTTOM) return BOTTOM;
      switch (expr.op) {
        case '+': return new DInt(l.value + r.value);
        case '-': return new DInt(l.value - r.value);
        case '*': return new DInt(l.value * r.value);
        case '/': return r.value === 0 ? BOTTOM : new DInt(Math.trunc(l.value / r.value));
        case '==': return new DBool(l.value === r.value);
        case '!=': return new DBool(l.value !== r.value);
        case '<': return new DBool(l.value < r.value);
        case '>': return new DBool(l.value > r.value);
        case '<=': return new DBool(l.value <= r.value);
        case '>=': return new DBool(l.value >= r.value);
        case '&&': return new DBool(l.value && r.value);
        case '||': return new DBool(l.value || r.value);
      }
      return BOTTOM;
    }
    
    case 'pair':
      return new DPair(denote(expr.fst, env), denote(expr.snd, env));
    
    case 'fst': {
      const p = denote(expr.expr, env);
      if (p === BOTTOM || p.tag !== 'pair') return BOTTOM;
      return p.fst;
    }
    
    case 'snd': {
      const p = denote(expr.expr, env);
      if (p === BOTTOM || p.tag !== 'pair') return BOTTOM;
      return p.snd;
    }
  }
  return BOTTOM;
}

// Better fix for recursive functions: use a self-application trick
function fixFn(bodyFn, env) {
  // fix f = let rec x = f x in x
  // For DFun: create a function that passes itself
  const f = denote(bodyFn, env);
  if (f === BOTTOM || f.tag !== 'fun') return BOTTOM;
  
  // Create a recursive DFun
  const rec = new DFun(function self(arg) {
    // f(rec)(arg) where rec is the fixed point
    const inner = f.fn(rec);
    if (inner === BOTTOM || inner.tag !== 'fun') return BOTTOM;
    return inner.fn(arg);
  });
  return rec;
}

// Override fix handling for function-valued fixed points
const originalDenote = denote;
function denoteFix(expr, env = new Env()) {
  if (expr.kind === 'fix') {
    return fixFn(expr.body, env);
  }
  return originalDenote(expr, env);
}

// ============================================================
// Convenience constructors
// ============================================================

const lit = { int: n => new Lit(n), bool: b => new Lit(b) };
const v = name => new Var(name);
const lam = (param, body) => new Lam(param, body);
const app = (fn, arg) => new App(fn, arg);
const if_ = (c, t, e) => new If(c, t, e);
const let_ = (name, val, body) => new Let(name, val, body);
const fix = body => new Fix(body);
const binop = (op, l, r) => new BinOp(op, l, r);
const pair = (a, b) => new Pair_(a, b);
const fst = e => new Fst(e);
const snd = e => new Snd(e);

module.exports = {
  BOTTOM, DInt, DBool, DFun, DPair,
  valToString, valEqual,
  Lit, Var, Lam, App, If, Let, Fix, BinOp, Pair_, Fst, Snd,
  Env, denote, denoteFix,
  lit, v, lam, app, if_, let_, fix, binop, pair, fst, snd,
};
