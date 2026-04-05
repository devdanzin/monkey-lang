// Linear Type System
//
// Substructural type system where linear variables must be used exactly once.
// - Linear arrow (⊸): consumes its argument
// - Unrestricted (!τ): can be used any number of times
// - Context splitting: for applications, context is split between fn and arg
// - Pairs: tensor product (A ⊗ B) — both components are linear

// ============================================================
// Types
// ============================================================

class TInt { constructor() { this.tag = 'int'; } toString() { return 'Int'; } }
class TBool { constructor() { this.tag = 'bool'; } toString() { return 'Bool'; } }
class TLinArrow {
  constructor(param, ret) { this.tag = 'linarrow'; this.param = param; this.ret = ret; }
  toString() { return `${this.param.tag === 'linarrow' ? `(${this.param})` : this.param} ⊸ ${this.ret}`; }
}
class TBang {
  constructor(inner) { this.tag = 'bang'; this.inner = inner; }
  toString() { return `!${this.inner.tag === 'linarrow' ? `(${this.inner})` : this.inner}`; }
}
class TTensor {
  constructor(fst, snd) { this.tag = 'tensor'; this.fst = fst; this.snd = snd; }
  toString() { return `${this.fst} ⊗ ${this.snd}`; }
}

const Int = new TInt();
const Bool = new TBool();
const LinArrow = (p, r) => new TLinArrow(p, r);
const Bang = t => new TBang(t);
const Tensor = (a, b) => new TTensor(a, b);

function typesEqual(a, b) {
  if (a.tag !== b.tag) return false;
  switch (a.tag) {
    case 'int': case 'bool': return true;
    case 'linarrow': return typesEqual(a.param, b.param) && typesEqual(a.ret, b.ret);
    case 'bang': return typesEqual(a.inner, b.inner);
    case 'tensor': return typesEqual(a.fst, b.fst) && typesEqual(a.snd, b.snd);
  }
}

function isUnrestricted(type) {
  return type.tag === 'bang';
}

// ============================================================
// Terms
// ============================================================

class EVar { constructor(name) { this.kind = 'var'; this.name = name; } }
class ELit { constructor(value, type) { this.kind = 'lit'; this.value = value; this.type = type; } }
class ELam { constructor(param, paramType, body) { this.kind = 'lam'; this.param = param; this.paramType = paramType; this.body = body; } }
class EApp { constructor(fn, arg) { this.kind = 'app'; this.fn = fn; this.arg = arg; } }
class EPair { constructor(fst, snd) { this.kind = 'pair'; this.fst = fst; this.snd = snd; } }
class ELetPair { constructor(x, y, pair, body) { this.kind = 'letpair'; this.x = x; this.y = y; this.pair = pair; this.body = body; } }
class EBang_ { constructor(expr) { this.kind = 'bang'; this.expr = expr; } }
class ELetBang { constructor(x, expr, body) { this.kind = 'letbang'; this.x = x; this.expr = expr; this.body = body; } }

// ============================================================
// Linear Context
// ============================================================

class LinearTypeError extends Error {
  constructor(msg) { super(msg); this.name = 'LinearTypeError'; }
}

class LinCtx {
  constructor(bindings = new Map()) { this.bindings = new Map(bindings); }
  
  extend(name, type) {
    if (this.bindings.has(name)) throw new LinearTypeError(`Variable ${name} already in context`);
    const ctx = new LinCtx(this.bindings);
    ctx.bindings.set(name, { type, used: false });
    return ctx;
  }
  
  use(name) {
    const entry = this.bindings.get(name);
    if (!entry) throw new LinearTypeError(`Unbound variable: ${name}`);
    if (entry.used && !isUnrestricted(entry.type)) {
      throw new LinearTypeError(`Linear variable ${name} used more than once`);
    }
    const ctx = new LinCtx(this.bindings);
    ctx.bindings.set(name, { ...entry, used: true });
    return { type: entry.type, ctx };
  }
  
  checkAllUsed() {
    for (const [name, entry] of this.bindings) {
      if (!entry.used && !isUnrestricted(entry.type)) {
        throw new LinearTypeError(`Linear variable ${name} not used (type: ${entry.type})`);
      }
    }
  }
  
  clone() { return new LinCtx(this.bindings); }
  
  merge(other) {
    // Merge usage info: a variable is used if used in either branch
    const ctx = new LinCtx();
    for (const [name, entry] of this.bindings) {
      const otherEntry = other.bindings.get(name);
      ctx.bindings.set(name, {
        type: entry.type,
        used: entry.used || (otherEntry && otherEntry.used),
      });
    }
    return ctx;
  }
}

// ============================================================
// Type Checker
// ============================================================

// Returns { type, ctx } where ctx is the updated context (tracking usage)
function typeCheck(expr, ctx = new LinCtx()) {
  switch (expr.kind) {
    case 'lit':
      return { type: expr.type, ctx };
    
    case 'var': {
      const { type, ctx: newCtx } = ctx.use(expr.name);
      return { type, ctx: newCtx };
    }
    
    case 'lam': {
      const bodyCtx = ctx.extend(expr.param, expr.paramType);
      const { type: bodyType, ctx: afterBody } = typeCheck(expr.body, bodyCtx);
      // Check param was used (if linear)
      const paramEntry = afterBody.bindings.get(expr.param);
      if (!paramEntry.used && !isUnrestricted(expr.paramType)) {
        throw new LinearTypeError(`Linear parameter ${expr.param} not used in body`);
      }
      // Remove param from context, propagate outer usage
      const resultCtx = new LinCtx(afterBody.bindings);
      resultCtx.bindings.delete(expr.param);
      return { type: LinArrow(expr.paramType, bodyType), ctx: resultCtx };
    }
    
    case 'app': {
      const { type: fnType, ctx: afterFn } = typeCheck(expr.fn, ctx);
      if (fnType.tag !== 'linarrow') throw new LinearTypeError(`Expected linear arrow, got ${fnType}`);
      const { type: argType, ctx: afterArg } = typeCheck(expr.arg, afterFn);
      if (!typesEqual(fnType.param, argType)) {
        throw new LinearTypeError(`Type mismatch: expected ${fnType.param}, got ${argType}`);
      }
      return { type: fnType.ret, ctx: afterArg };
    }
    
    case 'pair': {
      const { type: fstType, ctx: afterFst } = typeCheck(expr.fst, ctx);
      const { type: sndType, ctx: afterSnd } = typeCheck(expr.snd, afterFst);
      return { type: Tensor(fstType, sndType), ctx: afterSnd };
    }
    
    case 'letpair': {
      const { type: pairType, ctx: afterPair } = typeCheck(expr.pair, ctx);
      if (pairType.tag !== 'tensor') throw new LinearTypeError(`Expected tensor, got ${pairType}`);
      const bodyCtx = afterPair.extend(expr.x, pairType.fst).extend(expr.y, pairType.snd);
      const { type: bodyType, ctx: afterBody } = typeCheck(expr.body, bodyCtx);
      // Check both components used
      const xEntry = afterBody.bindings.get(expr.x);
      const yEntry = afterBody.bindings.get(expr.y);
      if (!xEntry.used && !isUnrestricted(pairType.fst))
        throw new LinearTypeError(`Linear variable ${expr.x} from pair not used`);
      if (!yEntry.used && !isUnrestricted(pairType.snd))
        throw new LinearTypeError(`Linear variable ${expr.y} from pair not used`);
      const resultCtx = new LinCtx(afterBody.bindings);
      resultCtx.bindings.delete(expr.x);
      resultCtx.bindings.delete(expr.y);
      return { type: bodyType, ctx: resultCtx };
    }
    
    case 'bang': {
      const { type: innerType, ctx: afterInner } = typeCheck(expr.expr, ctx);
      return { type: Bang(innerType), ctx: afterInner };
    }
    
    case 'letbang': {
      const { type: exprType, ctx: afterExpr } = typeCheck(expr.expr, ctx);
      if (exprType.tag !== 'bang') throw new LinearTypeError(`Expected !τ, got ${exprType}`);
      // x is unrestricted in body
      const bodyCtx = afterExpr.extend(expr.x, exprType); // Keep the bang type so isUnrestricted works
      const { type: bodyType, ctx: afterBody } = typeCheck(expr.body, bodyCtx);
      const resultCtx = new LinCtx(afterBody.bindings);
      resultCtx.bindings.delete(expr.x);
      return { type: bodyType, ctx: resultCtx };
    }
  }
}

// Convenience: check a closed term
function check(expr) {
  const { type, ctx } = typeCheck(expr);
  // Verify all variables in scope were used
  ctx.checkAllUsed();
  return type;
}

// ============================================================
// Convenience constructors
// ============================================================

const lit = { int: n => new ELit(n, Int), bool: b => new ELit(b, Bool) };
const v = name => new EVar(name);
const lam = (p, t, body) => new ELam(p, t, body);
const app = (fn, arg) => new EApp(fn, arg);
const pair = (a, b) => new EPair(a, b);
const letpair = (x, y, p, body) => new ELetPair(x, y, p, body);
const bang = e => new EBang_(e);
const letbang = (x, e, body) => new ELetBang(x, e, body);

module.exports = {
  Int, Bool, LinArrow, Bang, Tensor, typesEqual, isUnrestricted,
  EVar, ELit, ELam, EApp, EPair, ELetPair, EBang_, ELetBang,
  LinCtx, LinearTypeError,
  typeCheck, check,
  lit, v, lam, app, pair, letpair, bang, letbang,
};
