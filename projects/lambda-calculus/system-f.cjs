// System F — Polymorphic Lambda Calculus
// Extends STLC with universal quantification (∀α.τ), type abstraction (Λα.e), type application (e [τ])

// ============================================================
// Types
// ============================================================

class TVar { constructor(name) { this.tag = 'tvar'; this.name = name; } toString() { return this.name; } }
class TInt { constructor() { this.tag = 'int'; } toString() { return 'Int'; } }
class TBool { constructor() { this.tag = 'bool'; } toString() { return 'Bool'; } }
class TArrow {
  constructor(param, ret) { this.tag = 'arrow'; this.param = param; this.ret = ret; }
  toString() {
    const p = this.param.tag === 'arrow' || this.param.tag === 'forall' ? `(${this.param})` : `${this.param}`;
    return `${p} → ${this.ret}`;
  }
}
class TForall {
  constructor(tvar, body) { this.tag = 'forall'; this.tvar = tvar; this.body = body; }
  toString() { return `∀${this.tvar}.${this.body}`; }
}

const Int = new TInt();
const Bool = new TBool();
function TypeVar(name) { return new TVar(name); }
function Arrow(p, r) { return new TArrow(p, r); }
function Forall(tv, body) { return new TForall(tv, body); }

// Type substitution: τ[α := σ]
function typeSubst(type, tvar, replacement) {
  switch (type.tag) {
    case 'tvar': return type.name === tvar ? replacement : type;
    case 'int': case 'bool': return type;
    case 'arrow': return new TArrow(typeSubst(type.param, tvar, replacement), typeSubst(type.ret, tvar, replacement));
    case 'forall':
      if (type.tvar === tvar) return type; // shadowed
      return new TForall(type.tvar, typeSubst(type.body, tvar, replacement));
  }
}

function typesEqual(a, b) {
  if (a.tag !== b.tag) return false;
  switch (a.tag) {
    case 'tvar': return a.name === b.name;
    case 'int': case 'bool': return true;
    case 'arrow': return typesEqual(a.param, b.param) && typesEqual(a.ret, b.ret);
    case 'forall': return a.tvar === b.tvar && typesEqual(a.body, b.body);
  }
}

// ============================================================
// Terms
// ============================================================

class EVar { constructor(name) { this.kind = 'var'; this.name = name; } }
class ELit { constructor(value, type) { this.kind = 'lit'; this.value = value; this.type = type; } }
class EAbs { constructor(param, paramType, body) { this.kind = 'abs'; this.param = param; this.paramType = paramType; this.body = body; } }
class EApp { constructor(fn, arg) { this.kind = 'app'; this.fn = fn; this.arg = arg; } }
class ETAbs { constructor(tvar, body) { this.kind = 'tabs'; this.tvar = tvar; this.body = body; } }
class ETApp { constructor(expr, type) { this.kind = 'tapp'; this.expr = expr; this.type = type; } }
class EIf { constructor(cond, then, else_) { this.kind = 'if'; this.cond = cond; this.then = then; this.else_ = else_; } }
class ELet { constructor(name, value, body) { this.kind = 'let'; this.name = name; this.value = value; this.body = body; } }
class EBinOp { constructor(op, left, right) { this.kind = 'binop'; this.op = op; this.left = left; this.right = right; } }

// ============================================================
// Type Environment
// ============================================================

class TypeEnv {
  constructor(termBindings = new Map(), typeVars = new Set()) {
    this.termBindings = termBindings;
    this.typeVars = typeVars;
  }
  
  extendTerm(name, type) {
    const newTerms = new Map(this.termBindings);
    newTerms.set(name, type);
    return new TypeEnv(newTerms, this.typeVars);
  }
  
  extendType(tvar) {
    const newTypeVars = new Set(this.typeVars);
    newTypeVars.add(tvar);
    return new TypeEnv(this.termBindings, newTypeVars);
  }
  
  lookupTerm(name) {
    if (!this.termBindings.has(name)) throw new FTypeError(`Unbound variable: ${name}`);
    return this.termBindings.get(name);
  }
  
  hasTypeVar(tvar) { return this.typeVars.has(tvar); }
}

class FTypeError extends Error {
  constructor(msg) { super(msg); this.name = 'FTypeError'; }
}

// ============================================================
// Type Checker
// ============================================================

function typeCheck(node, env = new TypeEnv()) {
  switch (node.kind) {
    case 'lit': return node.type;
    case 'var': return env.lookupTerm(node.name);
    
    case 'abs': {
      wellFormedType(node.paramType, env);
      const bodyEnv = env.extendTerm(node.param, node.paramType);
      const bodyType = typeCheck(node.body, bodyEnv);
      return Arrow(node.paramType, bodyType);
    }
    
    case 'app': {
      const fnType = typeCheck(node.fn, env);
      if (fnType.tag !== 'arrow') throw new FTypeError(`Expected function type, got ${fnType}`);
      const argType = typeCheck(node.arg, env);
      if (!typesEqual(fnType.param, argType)) throw new FTypeError(`Type mismatch: expected ${fnType.param}, got ${argType}`);
      return fnType.ret;
    }
    
    case 'tabs': {
      // Type abstraction: Λα.e
      const bodyEnv = env.extendType(node.tvar);
      const bodyType = typeCheck(node.body, bodyEnv);
      return Forall(node.tvar, bodyType);
    }
    
    case 'tapp': {
      // Type application: e [τ]
      const exprType = typeCheck(node.expr, env);
      if (exprType.tag !== 'forall') throw new FTypeError(`Expected ∀ type, got ${exprType}`);
      wellFormedType(node.type, env);
      return typeSubst(exprType.body, exprType.tvar, node.type);
    }
    
    case 'if': {
      const condType = typeCheck(node.cond, env);
      if (!typesEqual(condType, Bool)) throw new FTypeError(`If condition must be Bool, got ${condType}`);
      const thenType = typeCheck(node.then, env);
      const elseType = typeCheck(node.else_, env);
      if (!typesEqual(thenType, elseType)) throw new FTypeError(`If branches must match: ${thenType} vs ${elseType}`);
      return thenType;
    }
    
    case 'let': {
      const valType = typeCheck(node.value, env);
      return typeCheck(node.body, env.extendTerm(node.name, valType));
    }
    
    case 'binop': {
      const leftType = typeCheck(node.left, env);
      const rightType = typeCheck(node.right, env);
      if (['+', '-', '*', '/'].includes(node.op)) {
        if (!typesEqual(leftType, Int) || !typesEqual(rightType, Int))
          throw new FTypeError(`Arithmetic requires Int`);
        return Int;
      }
      if (['==', '!=', '<', '>'].includes(node.op)) {
        if (!typesEqual(leftType, rightType)) throw new FTypeError(`Comparison requires matching types`);
        return Bool;
      }
      if (['&&', '||'].includes(node.op)) {
        if (!typesEqual(leftType, Bool) || !typesEqual(rightType, Bool))
          throw new FTypeError(`Logic requires Bool`);
        return Bool;
      }
      throw new FTypeError(`Unknown operator: ${node.op}`);
    }
    
    default: throw new FTypeError(`Unknown node kind: ${node.kind}`);
  }
}

function wellFormedType(type, env) {
  switch (type.tag) {
    case 'tvar':
      if (!env.hasTypeVar(type.name)) throw new FTypeError(`Unbound type variable: ${type.name}`);
      return;
    case 'int': case 'bool': return;
    case 'arrow':
      wellFormedType(type.param, env);
      wellFormedType(type.ret, env);
      return;
    case 'forall':
      wellFormedType(type.body, env.extendType(type.tvar));
      return;
  }
}

// ============================================================
// Evaluator
// ============================================================

class Closure {
  constructor(param, body, env) { this.kind = 'closure'; this.param = param; this.body = body; this.env = env; }
}

class TypeClosure {
  constructor(tvar, body, env) { this.kind = 'tclosure'; this.tvar = tvar; this.body = body; this.env = env; }
}

function evaluate(node, env = new Map()) {
  switch (node.kind) {
    case 'lit': return node;
    case 'var': {
      if (!env.has(node.name)) throw new Error(`Unbound: ${node.name}`);
      return env.get(node.name);
    }
    case 'abs': return new Closure(node.param, node.body, new Map(env));
    case 'app': {
      const fn = evaluate(node.fn, env);
      const arg = evaluate(node.arg, env);
      if (fn.kind !== 'closure') throw new Error('Application of non-function');
      const newEnv = new Map(fn.env);
      newEnv.set(fn.param, arg);
      return evaluate(fn.body, newEnv);
    }
    case 'tabs': return new TypeClosure(node.tvar, node.body, new Map(env));
    case 'tapp': {
      const val = evaluate(node.expr, env);
      if (val.kind !== 'tclosure') throw new Error('Type application of non-type-abstraction');
      return evaluate(val.body, val.env);
    }
    case 'if': {
      const cond = evaluate(node.cond, env);
      return cond.value ? evaluate(node.then, env) : evaluate(node.else_, env);
    }
    case 'let': {
      const val = evaluate(node.value, env);
      const newEnv = new Map(env);
      newEnv.set(node.name, val);
      return evaluate(node.body, newEnv);
    }
    case 'binop': {
      const l = evaluate(node.left, env).value;
      const r = evaluate(node.right, env).value;
      switch (node.op) {
        case '+': return new ELit(l + r, Int);
        case '-': return new ELit(l - r, Int);
        case '*': return new ELit(l * r, Int);
        case '/': return new ELit(Math.trunc(l / r), Int);
        case '<': return new ELit(l < r, Bool);
        case '>': return new ELit(l > r, Bool);
        case '==': return new ELit(l === r, Bool);
        case '&&': return new ELit(l && r, Bool);
        case '||': return new ELit(l || r, Bool);
      }
    }
  }
}

// ============================================================
// Convenience
// ============================================================

const lit = { int: n => new ELit(n, Int), bool: b => new ELit(b, Bool) };
const v = name => new EVar(name);
const abs = (param, type, body) => new EAbs(param, type, body);
const app = (fn, arg) => new EApp(fn, arg);
const tabs = (tvar, body) => new ETAbs(tvar, body);
const tapp = (expr, type) => new ETApp(expr, type);
const if_ = (c, t, e) => new EIf(c, t, e);
const let_ = (name, val, body) => new ELet(name, val, body);
const binop = (op, l, r) => new EBinOp(op, l, r);

module.exports = {
  Int, Bool, TypeVar, Arrow, Forall, typesEqual, typeSubst,
  EVar, ELit, EAbs, EApp, ETAbs, ETApp, EIf, ELet, EBinOp,
  TypeEnv, FTypeError, typeCheck, evaluate,
  lit, v, abs, app, tabs, tapp, if_, let_, binop,
};
