// Simply-Typed Lambda Calculus (STLC)
// Extends the untyped lambda calculus with a type system

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
function Arrow(p, r) { return new TArrow(p, r); }

function typesEqual(a, b) {
  if (a.tag !== b.tag) return false;
  if (a.tag === 'arrow') return typesEqual(a.param, b.param) && typesEqual(a.ret, b.ret);
  return true;
}

// ============================================================
// Typed AST
// ============================================================

class TVar {
  constructor(name) { this.kind = 'var'; this.name = name; }
}

class TLit {
  constructor(value, type) { this.kind = 'lit'; this.value = value; this.type = type; }
}

class TAbs {
  constructor(param, paramType, body) {
    this.kind = 'abs'; this.param = param; this.paramType = paramType; this.body = body;
  }
}

class TApp {
  constructor(fn, arg) { this.kind = 'app'; this.fn = fn; this.arg = arg; }
}

class TIf {
  constructor(cond, then, else_) { this.kind = 'if'; this.cond = cond; this.then = then; this.else_ = else_; }
}

class TLet {
  constructor(name, value, body) { this.kind = 'let'; this.name = name; this.value = value; this.body = body; }
}

class TBinOp {
  constructor(op, left, right) { this.kind = 'binop'; this.op = op; this.left = left; this.right = right; }
}

// ============================================================
// Type Environment
// ============================================================

class TypeEnv {
  constructor(bindings = new Map()) { this.bindings = bindings; }
  
  extend(name, type) {
    const newBindings = new Map(this.bindings);
    newBindings.set(name, type);
    return new TypeEnv(newBindings);
  }
  
  lookup(name) {
    if (!this.bindings.has(name)) throw new TypeError(`Unbound variable: ${name}`);
    return this.bindings.get(name);
  }
}

// ============================================================
// Type Checker
// ============================================================

class TypeError extends Error {
  constructor(msg) { super(msg); this.name = 'TypeError'; }
}

function typeCheck(node, env = new TypeEnv()) {
  switch (node.kind) {
    case 'lit':
      return node.type;
    
    case 'var':
      return env.lookup(node.name);
    
    case 'abs': {
      const bodyEnv = env.extend(node.param, node.paramType);
      const bodyType = typeCheck(node.body, bodyEnv);
      return Arrow(node.paramType, bodyType);
    }
    
    case 'app': {
      const fnType = typeCheck(node.fn, env);
      if (fnType.tag !== 'arrow') {
        throw new TypeError(`Expected function type, got ${fnType}`);
      }
      const argType = typeCheck(node.arg, env);
      if (!typesEqual(fnType.param, argType)) {
        throw new TypeError(`Type mismatch: expected ${fnType.param}, got ${argType}`);
      }
      return fnType.ret;
    }
    
    case 'if': {
      const condType = typeCheck(node.cond, env);
      if (!typesEqual(condType, Bool)) {
        throw new TypeError(`If condition must be Bool, got ${condType}`);
      }
      const thenType = typeCheck(node.then, env);
      const elseType = typeCheck(node.else_, env);
      if (!typesEqual(thenType, elseType)) {
        throw new TypeError(`If branches must have same type: ${thenType} vs ${elseType}`);
      }
      return thenType;
    }
    
    case 'let': {
      const valType = typeCheck(node.value, env);
      const bodyEnv = env.extend(node.name, valType);
      return typeCheck(node.body, bodyEnv);
    }
    
    case 'binop': {
      const leftType = typeCheck(node.left, env);
      const rightType = typeCheck(node.right, env);
      
      if (['+', '-', '*', '/'].includes(node.op)) {
        if (!typesEqual(leftType, Int) || !typesEqual(rightType, Int)) {
          throw new TypeError(`Arithmetic requires Int operands, got ${leftType} and ${rightType}`);
        }
        return Int;
      }
      if (['==', '!=', '<', '>', '<=', '>='].includes(node.op)) {
        if (!typesEqual(leftType, rightType)) {
          throw new TypeError(`Comparison requires matching types: ${leftType} vs ${rightType}`);
        }
        return Bool;
      }
      if (['&&', '||'].includes(node.op)) {
        if (!typesEqual(leftType, Bool) || !typesEqual(rightType, Bool)) {
          throw new TypeError(`Logic requires Bool operands, got ${leftType} and ${rightType}`);
        }
        return Bool;
      }
      throw new TypeError(`Unknown operator: ${node.op}`);
    }
    
    default:
      throw new TypeError(`Unknown node kind: ${node.kind}`);
  }
}

// ============================================================
// Evaluator (small-step, call-by-value)
// ============================================================

function isValue(node) {
  return node.kind === 'lit' || node.kind === 'abs';
}

class Closure {
  constructor(param, paramType, body, env) {
    this.kind = 'abs'; this.param = param; this.paramType = paramType;
    this.body = body; this.env = env;
  }
}

function evaluate(node, env = new Map()) {
  switch (node.kind) {
    case 'lit': return node;
    case 'var': {
      if (!env.has(node.name)) throw new Error(`Unbound variable at runtime: ${node.name}`);
      return env.get(node.name);
    }
    case 'abs': return new Closure(node.param, node.paramType, node.body, new Map(env));
    case 'app': {
      const fn = evaluate(node.fn, env);
      const arg = evaluate(node.arg, env);
      if (fn.kind !== 'abs') throw new Error('Application of non-function');
      const newEnv = new Map(fn.env);
      newEnv.set(fn.param, arg);
      return evaluate(fn.body, newEnv);
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
      const left = evaluate(node.left, env);
      const right = evaluate(node.right, env);
      const l = left.value, r = right.value;
      switch (node.op) {
        case '+': return new TLit(l + r, Int);
        case '-': return new TLit(l - r, Int);
        case '*': return new TLit(l * r, Int);
        case '/': return new TLit(Math.trunc(l / r), Int);
        case '==': return new TLit(l === r, Bool);
        case '!=': return new TLit(l !== r, Bool);
        case '<': return new TLit(l < r, Bool);
        case '>': return new TLit(l > r, Bool);
        case '<=': return new TLit(l <= r, Bool);
        case '>=': return new TLit(l >= r, Bool);
        case '&&': return new TLit(l && r, Bool);
        case '||': return new TLit(l || r, Bool);
        default: throw new Error(`Unknown op: ${node.op}`);
      }
    }
    default: throw new Error(`Cannot evaluate: ${node.kind}`);
  }
}

// ============================================================
// Convenience constructors
// ============================================================

const lit = {
  int: (n) => new TLit(n, Int),
  bool: (b) => new TLit(b, Bool),
  unit: () => new TLit(null, Unit),
};

const v = (name) => new TVar(name);
const abs = (param, type, body) => new TAbs(param, type, body);
const app = (fn, arg) => new TApp(fn, arg);
const if_ = (c, t, e) => new TIf(c, t, e);
const let_ = (name, val, body) => new TLet(name, val, body);
const binop = (op, l, r) => new TBinOp(op, l, r);

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Types
  Int, Bool, Unit, Arrow, TInt, TBool, TUnit, TArrow, typesEqual,
  // AST
  TVar, TLit, TAbs, TApp, TIf, TLet, TBinOp,
  // Type environment
  TypeEnv, TypeError,
  // Type checker
  typeCheck,
  // Evaluator
  evaluate, isValue,
  // Convenience
  lit, v, abs, app, if_, let_, binop,
};
