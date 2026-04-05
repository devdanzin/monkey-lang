// Dependent Type Checker
//
// A minimal dependently-typed language (like a tiny Agda/Idris core):
// - Π(x:A).B — dependent function type (Pi type)
// - Σ(x:A).B — dependent pair type (Sigma type)
// - Type — the universe of types (Type : Type, inconsistent but simple)
// - λx.e — lambda abstraction
// - (e₁ e₂) — application
// - (e₁, e₂) — dependent pair
// - fst/snd — pair projections
//
// Type checking uses NbE for type equality (terms must normalize to compare).

// ============================================================
// Terms (unified — terms and types are the same)
// ============================================================

class Var { constructor(name) { this.kind = 'var'; this.name = name; } }
class Lam { constructor(param, body) { this.kind = 'lam'; this.param = param; this.body = body; } }
class App { constructor(fn, arg) { this.kind = 'app'; this.fn = fn; this.arg = arg; } }
class Pi { constructor(param, domain, codomain) { this.kind = 'pi'; this.param = param; this.domain = domain; this.codomain = codomain; } }
class Sigma { constructor(param, fstType, sndType) { this.kind = 'sigma'; this.param = param; this.fstType = fstType; this.sndType = sndType; } }
class Pair_ { constructor(fst, snd) { this.kind = 'pair'; this.fst = fst; this.snd = snd; } }
class Fst { constructor(expr) { this.kind = 'fst'; this.expr = expr; } }
class Snd { constructor(expr) { this.kind = 'snd'; this.expr = expr; } }
class Type_ { constructor() { this.kind = 'type'; } }
class Ann { constructor(expr, type) { this.kind = 'ann'; this.expr = expr; this.type = type; } }
class Nat_ { constructor() { this.kind = 'nat'; } }
class Zero_ { constructor() { this.kind = 'zero'; } }
class Succ_ { constructor(n) { this.kind = 'succ'; this.n = n; } }

const Type = new Type_();
const Nat = new Nat_();
const Zero = new Zero_();
const Succ = n => new Succ_(n);

// ============================================================
// Values (Semantic Domain for NbE)
// ============================================================

class VType { constructor() { this.tag = 'vtype'; } }
class VNat { constructor() { this.tag = 'vnat'; } }
class VZero { constructor() { this.tag = 'vzero'; } }
class VSucc { constructor(n) { this.tag = 'vsucc'; this.n = n; } }
class VPi { constructor(domain, codomain) { this.tag = 'vpi'; this.domain = domain; this.codomain = codomain; } }
class VSigma { constructor(fstType, sndType) { this.tag = 'vsigma'; this.fstType = fstType; this.sndType = sndType; } }
class VLam { constructor(fn) { this.tag = 'vlam'; this.fn = fn; } }
class VPair { constructor(fst, snd) { this.tag = 'vpair'; this.fst = fst; this.snd = snd; } }
class VNeutral { constructor(type, neutral) { this.tag = 'vneutral'; this.type = type; this.neutral = neutral; } }

// Neutral terms
class NVar { constructor(name) { this.tag = 'nvar'; this.name = name; } }
class NApp { constructor(fn, arg) { this.tag = 'napp'; this.fn = fn; this.arg = arg; } }
class NFst { constructor(pair) { this.tag = 'nfst'; this.pair = pair; } }
class NSnd { constructor(pair) { this.tag = 'nsnd'; this.pair = pair; } }

// ============================================================
// Evaluation
// ============================================================

function evaluate(expr, env = new Map()) {
  switch (expr.kind) {
    case 'var': return env.has(expr.name) ? env.get(expr.name) : new VNeutral(null, new NVar(expr.name));
    case 'type': return new VType();
    case 'nat': return new VNat();
    case 'zero': return new VZero();
    case 'succ': return new VSucc(evaluate(expr.n, env));
    case 'lam': return new VLam(arg => { const e = new Map(env); e.set(expr.param, arg); return evaluate(expr.body, e); });
    case 'pi': {
      const dom = evaluate(expr.domain, env);
      const cod = arg => { const e = new Map(env); e.set(expr.param, arg); return evaluate(expr.codomain, e); };
      return new VPi(dom, cod);
    }
    case 'sigma': {
      const fst = evaluate(expr.fstType, env);
      const snd = arg => { const e = new Map(env); e.set(expr.param, arg); return evaluate(expr.sndType, e); };
      return new VSigma(fst, snd);
    }
    case 'app': {
      const fn = evaluate(expr.fn, env);
      const arg = evaluate(expr.arg, env);
      return doApp(fn, arg);
    }
    case 'pair': return new VPair(evaluate(expr.fst, env), evaluate(expr.snd, env));
    case 'fst': return doFst(evaluate(expr.expr, env));
    case 'snd': return doSnd(evaluate(expr.expr, env));
    case 'ann': return evaluate(expr.expr, env);
  }
}

function doApp(fn, arg) {
  if (fn.tag === 'vlam') return fn.fn(arg);
  if (fn.tag === 'vneutral') return new VNeutral(null, new NApp(fn.neutral, arg));
  throw new Error('Cannot apply');
}

function doFst(pair) {
  if (pair.tag === 'vpair') return pair.fst;
  if (pair.tag === 'vneutral') return new VNeutral(null, new NFst(pair.neutral));
  throw new Error('Cannot fst');
}

function doSnd(pair) {
  if (pair.tag === 'vpair') return pair.snd;
  if (pair.tag === 'vneutral') return new VNeutral(null, new NSnd(pair.neutral));
  throw new Error('Cannot snd');
}

// ============================================================
// Readback
// ============================================================

let freshCount = 0;
function fresh(base = 'x') { return `$${base}${++freshCount}`; }
function resetFresh() { freshCount = 0; }

function readback(val) {
  switch (val.tag) {
    case 'vtype': return Type;
    case 'vnat': return Nat;
    case 'vzero': return Zero;
    case 'vsucc': return Succ(readback(val.n));
    case 'vlam': {
      const name = fresh();
      const arg = new VNeutral(null, new NVar(name));
      return new Lam(name, readback(val.fn(arg)));
    }
    case 'vpi': {
      const name = fresh();
      const arg = new VNeutral(null, new NVar(name));
      return new Pi(name, readback(val.domain), readback(val.codomain(arg)));
    }
    case 'vsigma': {
      const name = fresh();
      const arg = new VNeutral(null, new NVar(name));
      return new Sigma(name, readback(val.fstType), readback(val.sndType(arg)));
    }
    case 'vpair': return new Pair_(readback(val.fst), readback(val.snd));
    case 'vneutral': return readbackNeutral(val.neutral);
  }
}

function readbackNeutral(n) {
  switch (n.tag) {
    case 'nvar': return new Var(n.name);
    case 'napp': return new App(readbackNeutral(n.fn), readback(n.arg));
    case 'nfst': return new Fst(readbackNeutral(n.pair));
    case 'nsnd': return new Snd(readbackNeutral(n.pair));
  }
}

// ============================================================
// Conversion checking (are two values equal?)
// ============================================================

function convert(a, b) {
  // Readback both with same fresh counter start
  resetFresh();
  const ta = readback(a);
  resetFresh();
  const tb = readback(b);
  return termsEqual(ta, tb);
}

function termsEqual(a, b) {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'var': return a.name === b.name;
    case 'type': case 'nat': case 'zero': return true;
    case 'succ': return termsEqual(a.n, b.n);
    case 'lam': return a.param === b.param && termsEqual(a.body, b.body);
    case 'pi': return a.param === b.param && termsEqual(a.domain, b.domain) && termsEqual(a.codomain, b.codomain);
    case 'sigma': return a.param === b.param && termsEqual(a.fstType, b.fstType) && termsEqual(a.sndType, b.sndType);
    case 'app': return termsEqual(a.fn, b.fn) && termsEqual(a.arg, b.arg);
    case 'pair': return termsEqual(a.fst, b.fst) && termsEqual(a.snd, b.snd);
    case 'fst': return termsEqual(a.expr, b.expr);
    case 'snd': return termsEqual(a.expr, b.expr);
  }
  return false;
}

// ============================================================
// Type Checking Context
// ============================================================

class Ctx {
  constructor(types = new Map(), values = new Map()) {
    this.types = types; this.values = values;
  }
  extend(name, type, value = undefined) {
    const t = new Map(this.types);
    const v = new Map(this.values);
    t.set(name, type);
    if (value !== undefined) v.set(name, value);
    else v.set(name, new VNeutral(type, new NVar(name)));
    return new Ctx(t, v);
  }
  lookupType(name) { return this.types.get(name); }
  getEnv() { return this.values; }
}

class DepTypeError extends Error {
  constructor(msg) { super(msg); this.name = 'DepTypeError'; }
}

// ============================================================
// Type Checker (bidirectional)
// ============================================================

function infer(ctx, expr) {
  switch (expr.kind) {
    case 'type': return new VType();
    case 'nat': return new VType();
    case 'zero': return new VNat();
    case 'succ': {
      check(ctx, expr.n, new VNat());
      return new VNat();
    }
    case 'var': {
      const t = ctx.lookupType(expr.name);
      if (!t) throw new DepTypeError(`Unbound: ${expr.name}`);
      return t;
    }
    case 'ann': {
      check(ctx, expr.type, new VType());
      const type = evaluate(expr.type, ctx.getEnv());
      check(ctx, expr.expr, type);
      return type;
    }
    case 'pi': {
      check(ctx, expr.domain, new VType());
      const domVal = evaluate(expr.domain, ctx.getEnv());
      const extCtx = ctx.extend(expr.param, domVal);
      check(extCtx, expr.codomain, new VType());
      return new VType();
    }
    case 'sigma': {
      check(ctx, expr.fstType, new VType());
      const fstVal = evaluate(expr.fstType, ctx.getEnv());
      const extCtx = ctx.extend(expr.param, fstVal);
      check(extCtx, expr.sndType, new VType());
      return new VType();
    }
    case 'app': {
      const fnType = infer(ctx, expr.fn);
      if (fnType.tag !== 'vpi') throw new DepTypeError(`Expected Π type, got ${fnType.tag}`);
      check(ctx, expr.arg, fnType.domain);
      const argVal = evaluate(expr.arg, ctx.getEnv());
      return fnType.codomain(argVal);
    }
    case 'fst': {
      const pairType = infer(ctx, expr.expr);
      if (pairType.tag !== 'vsigma') throw new DepTypeError(`Expected Σ type`);
      return pairType.fstType;
    }
    case 'snd': {
      const pairType = infer(ctx, expr.expr);
      if (pairType.tag !== 'vsigma') throw new DepTypeError(`Expected Σ type`);
      const fstVal = doFst(evaluate(expr.expr, ctx.getEnv()));
      return pairType.sndType(fstVal);
    }
    case 'lam':
      throw new DepTypeError(`Cannot infer type of lambda`);
    case 'pair':
      throw new DepTypeError(`Cannot infer type of pair`);
  }
}

function check(ctx, expr, type) {
  if (expr.kind === 'lam' && type.tag === 'vpi') {
    const extCtx = ctx.extend(expr.param, type.domain);
    const argVal = evaluate(new Var(expr.param), extCtx.getEnv());
    check(extCtx, expr.body, type.codomain(argVal));
    return;
  }
  if (expr.kind === 'pair' && type.tag === 'vsigma') {
    check(ctx, expr.fst, type.fstType);
    const fstVal = evaluate(expr.fst, ctx.getEnv());
    check(ctx, expr.snd, type.sndType(fstVal));
    return;
  }
  // Fall through to infer
  const inferred = infer(ctx, expr);
  if (!convert(inferred, type)) {
    throw new DepTypeError(`Type mismatch: inferred ${readback(inferred).kind}, expected ${readback(type).kind}`);
  }
}

// ============================================================
// Convenience
// ============================================================

const pi = (p, dom, cod) => new Pi(p, dom, cod);
const sigma = (p, fst, snd) => new Sigma(p, fst, snd);
const lam = (p, body) => new Lam(p, body);
const app = (fn, arg) => new App(fn, arg);
const pair = (a, b) => new Pair_(a, b);
const fst = e => new Fst(e);
const snd = e => new Snd(e);
const ann = (e, t) => new Ann(e, t);
const v_ = name => new Var(name);

// Non-dependent function type: A → B  =  Π(_:A).B
const arrow = (a, b) => new Pi('_', a, b);

module.exports = {
  Var, Lam, App, Pi, Sigma, Pair_, Fst, Snd, Type, Nat, Zero, Succ, Ann,
  evaluate, readback, convert,
  Ctx, DepTypeError, infer, check,
  pi, sigma, lam, app, pair, fst, snd, ann, v_, arrow,
};
