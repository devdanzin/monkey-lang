// Bidirectional Type Checking
//
// Two modes:
// - Infer (synthesize): given term, produce type  (Γ ⊢ e ⇒ τ)
// - Check: given term AND type, verify match      (Γ ⊢ e ⇐ τ)
//
// Key insight: lambdas CHECK against arrow types (no annotation needed on params),
// applications INFER by synthesizing the function type.
// Annotations switch from check to infer mode.

// ============================================================
// Types
// ============================================================

class TInt { constructor() { this.tag = 'int'; } toString() { return 'Int'; } }
class TBool { constructor() { this.tag = 'bool'; } toString() { return 'Bool'; } }
class TUnit { constructor() { this.tag = 'unit'; } toString() { return 'Unit'; } }
class TArrow {
  constructor(param, ret) { this.tag = 'arrow'; this.param = param; this.ret = ret; }
  toString() {
    const p = this.param.tag === 'arrow' ? `(${this.param})` : `${this.param}`;
    return `${p} → ${this.ret}`;
  }
}

const Int = new TInt();
const Bool = new TBool();
const Unit = new TUnit();
const Arrow = (p, r) => new TArrow(p, r);

function typesEqual(a, b) {
  if (a.tag !== b.tag) return false;
  if (a.tag === 'arrow') return typesEqual(a.param, b.param) && typesEqual(a.ret, b.ret);
  return true;
}

// ============================================================
// Terms
// ============================================================

// Synthesizing (inferrable) terms
class EVar { constructor(name) { this.kind = 'var'; this.name = name; this.mode = 'synth'; } }
class ELit { constructor(value, type) { this.kind = 'lit'; this.value = value; this.type = type; this.mode = 'synth'; } }
class EApp { constructor(fn, arg) { this.kind = 'app'; this.fn = fn; this.arg = arg; this.mode = 'synth'; } }
class EAnn { constructor(expr, type) { this.kind = 'ann'; this.expr = expr; this.type = type; this.mode = 'synth'; } }
class EBinOp { constructor(op, l, r) { this.kind = 'binop'; this.op = op; this.l = l; this.r = r; this.mode = 'synth'; } }

// Checking terms (need a type pushed in)
class ELam { constructor(param, body) { this.kind = 'lam'; this.param = param; this.body = body; this.mode = 'check'; } }
class EIf { constructor(cond, then, else_) { this.kind = 'if'; this.cond = cond; this.then = then; this.else_ = else_; this.mode = 'check'; } }
class ELet { constructor(name, ann, value, body) { this.kind = 'let'; this.name = name; this.ann = ann; this.value = value; this.body = body; } }

// ============================================================
// Context
// ============================================================

class Context {
  constructor(bindings = new Map()) { this.bindings = bindings; }
  extend(name, type) {
    const m = new Map(this.bindings);
    m.set(name, type);
    return new Context(m);
  }
  lookup(name) { return this.bindings.get(name) || null; }
}

class BiTypeError extends Error {
  constructor(msg) { super(msg); this.name = 'BiTypeError'; }
}

// ============================================================
// Bidirectional Type Checker
// ============================================================

// Infer mode: Γ ⊢ e ⇒ τ
function infer(ctx, expr) {
  switch (expr.kind) {
    case 'lit': return expr.type;
    
    case 'var': {
      const t = ctx.lookup(expr.name);
      if (!t) throw new BiTypeError(`Unbound variable: ${expr.name}`);
      return t;
    }
    
    case 'ann': {
      // Type annotation: switch to check mode
      check(ctx, expr.expr, expr.type);
      return expr.type;
    }
    
    case 'app': {
      const fnType = infer(ctx, expr.fn);
      if (fnType.tag !== 'arrow') throw new BiTypeError(`Expected function type, got ${fnType}`);
      check(ctx, expr.arg, fnType.param);
      return fnType.ret;
    }
    
    case 'binop': {
      const lt = infer(ctx, expr.l);
      const rt = infer(ctx, expr.r);
      if (['+', '-', '*', '/'].includes(expr.op)) {
        if (!typesEqual(lt, Int)) throw new BiTypeError(`Left operand must be Int, got ${lt}`);
        if (!typesEqual(rt, Int)) throw new BiTypeError(`Right operand must be Int, got ${rt}`);
        return Int;
      }
      if (['<', '>', '==', '!='].includes(expr.op)) {
        if (!typesEqual(lt, rt)) throw new BiTypeError(`Comparison operands must match: ${lt} vs ${rt}`);
        return Bool;
      }
      if (['&&', '||'].includes(expr.op)) {
        if (!typesEqual(lt, Bool) || !typesEqual(rt, Bool)) throw new BiTypeError(`Logic requires Bool`);
        return Bool;
      }
      throw new BiTypeError(`Unknown op: ${expr.op}`);
    }
    
    case 'let': {
      let valType;
      if (expr.ann) {
        check(ctx, expr.value, expr.ann);
        valType = expr.ann;
      } else {
        valType = infer(ctx, expr.value);
      }
      return infer(ctx.extend(expr.name, valType), expr.body);
    }
    
    case 'lam':
      throw new BiTypeError(`Cannot infer type of lambda without annotation. Use (e : τ) to annotate.`);
    
    case 'if': {
      // In infer mode, we infer the condition and branches
      check(ctx, expr.cond, Bool);
      const thenType = infer(ctx, expr.then);
      check(ctx, expr.else_, thenType);
      return thenType;
    }
    
    default:
      throw new BiTypeError(`Cannot infer: ${expr.kind}`);
  }
}

// Check mode: Γ ⊢ e ⇐ τ
function check(ctx, expr, type) {
  switch (expr.kind) {
    case 'lam': {
      if (type.tag !== 'arrow') throw new BiTypeError(`Cannot check lambda against ${type}`);
      const bodyCtx = ctx.extend(expr.param, type.param);
      check(bodyCtx, expr.body, type.ret);
      return;
    }
    
    case 'if': {
      check(ctx, expr.cond, Bool);
      check(ctx, expr.then, type);
      check(ctx, expr.else_, type);
      return;
    }
    
    default: {
      // Fall through to infer mode, then compare
      const inferred = infer(ctx, expr);
      if (!typesEqual(inferred, type)) {
        throw new BiTypeError(`Type mismatch: inferred ${inferred}, expected ${type}`);
      }
    }
  }
}

// ============================================================
// Convenience
// ============================================================

const lit = { int: n => new ELit(n, Int), bool: b => new ELit(b, Bool), unit: () => new ELit(null, Unit) };
const v = name => new EVar(name);
const lam = (p, body) => new ELam(p, body);
const app = (fn, arg) => new EApp(fn, arg);
const ann = (expr, type) => new EAnn(expr, type);
const binop = (op, l, r) => new EBinOp(op, l, r);
const if_ = (c, t, e) => new EIf(c, t, e);
const let_ = (name, ann, val, body) => new ELet(name, ann, val, body);

module.exports = {
  Int, Bool, Unit, Arrow, typesEqual,
  EVar, ELit, EApp, EAnn, ELam, EIf, ELet, EBinOp,
  Context, BiTypeError,
  infer, check,
  lit, v, lam, app, ann, binop, if_, let_,
};
