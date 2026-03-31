/**
 * Tiny Hindley-Milner Type Inference
 *
 * Implements Algorithm W for type inference:
 * - Type variables, function types, basic types (int, bool, string)
 * - Unification with occurs check
 * - Let-polymorphism (generalization + instantiation)
 * - Type schemes (∀ quantified types)
 * - Constraint-based inference
 *
 * Expression language:
 *   e ::= x | n | b | s | λx.e | e e | let x = e in e | if e then e else e
 *         | (e, e) | fst e | snd e | fix f
 */

// ==================== Types ====================

let _nextTypeVar = 0;

function resetTypeVars() { _nextTypeVar = 0; }

// Type constructors
const TVar = (name) => ({ tag: 'TVar', name });
const TFun = (from, to) => ({ tag: 'TFun', from, to });
const TCon = (name) => ({ tag: 'TCon', name });
const TPair = (fst, snd) => ({ tag: 'TPair', fst, snd });
const TList = (elem) => ({ tag: 'TList', elem });

// Convenience
const tInt = TCon('Int');
const tBool = TCon('Bool');
const tString = TCon('String');
const tUnit = TCon('Unit');

function freshTVar() {
  const name = 't' + (_nextTypeVar++);
  return TVar(name);
}

// ==================== Expression AST ====================

const Var = (name) => ({ tag: 'Var', name });
const Lit = (value, type) => ({ tag: 'Lit', value, type });
const Lam = (param, body) => ({ tag: 'Lam', param, body });
const App = (fn, arg) => ({ tag: 'App', fn, arg });
const Let = (name, value, body) => ({ tag: 'Let', name, value, body });
const If = (cond, then, else_) => ({ tag: 'If', cond, then, else_ });
const Pair = (fst, snd) => ({ tag: 'Pair', fst, snd });
const Fst = (expr) => ({ tag: 'Fst', expr });
const Snd = (expr) => ({ tag: 'Snd', expr });
const Fix = (expr) => ({ tag: 'Fix', expr });
const Ann = (expr, type) => ({ tag: 'Ann', expr, type }); // type annotation

// Literals
const IntLit = (n) => Lit(n, tInt);
const BoolLit = (b) => Lit(b, tBool);
const StrLit = (s) => Lit(s, tString);

// ==================== Substitution ====================

class Subst {
  constructor(map = new Map()) {
    this.map = map;
  }

  apply(type) {
    switch (type.tag) {
      case 'TVar':
        if (this.map.has(type.name)) return this.apply(this.map.get(type.name));
        return type;
      case 'TFun':
        return TFun(this.apply(type.from), this.apply(type.to));
      case 'TCon':
        return type;
      case 'TPair':
        return TPair(this.apply(type.fst), this.apply(type.snd));
      case 'TList':
        return TList(this.apply(type.elem));
      default:
        return type;
    }
  }

  compose(other) {
    const result = new Map();
    for (const [k, v] of other.map) {
      result.set(k, this.apply(v));
    }
    for (const [k, v] of this.map) {
      if (!result.has(k)) result.set(k, v);
    }
    return new Subst(result);
  }

  static empty() {
    return new Subst();
  }

  static single(name, type) {
    return new Subst(new Map([[name, type]]));
  }
}

// ==================== Free Type Variables ====================

function ftv(type) {
  switch (type.tag) {
    case 'TVar': return new Set([type.name]);
    case 'TFun': return new Set([...ftv(type.from), ...ftv(type.to)]);
    case 'TCon': return new Set();
    case 'TPair': return new Set([...ftv(type.fst), ...ftv(type.snd)]);
    case 'TList': return ftv(type.elem);
    default: return new Set();
  }
}

// ==================== Type Scheme ====================

// Scheme = ∀ [vars]. type
class Scheme {
  constructor(vars, type) {
    this.vars = vars; // string[]
    this.type = type;
  }

  /** Instantiate: replace bound vars with fresh type variables */
  instantiate() {
    const subst = new Map();
    for (const v of this.vars) {
      subst.set(v, freshTVar());
    }
    return new Subst(subst).apply(this.type);
  }

  /** Free type variables (not bound by ∀) */
  ftv() {
    const free = ftv(this.type);
    for (const v of this.vars) free.delete(v);
    return free;
  }

  apply(subst) {
    // Don't substitute bound variables
    const filteredMap = new Map();
    for (const [k, v] of subst.map) {
      if (!this.vars.includes(k)) filteredMap.set(k, v);
    }
    return new Scheme(this.vars, new Subst(filteredMap).apply(this.type));
  }
}

// ==================== Type Environment ====================

class TypeEnv {
  constructor(bindings = new Map()) {
    this.bindings = bindings;
  }

  extend(name, scheme) {
    const b = new Map(this.bindings);
    b.set(name, scheme);
    return new TypeEnv(b);
  }

  lookup(name) {
    return this.bindings.get(name) || null;
  }

  ftv() {
    const result = new Set();
    for (const scheme of this.bindings.values()) {
      for (const v of scheme.ftv()) result.add(v);
    }
    return result;
  }

  apply(subst) {
    const b = new Map();
    for (const [k, v] of this.bindings) {
      b.set(k, v.apply(subst));
    }
    return new TypeEnv(b);
  }

  /** Generalize: ∀ over free vars in type that are not free in env */
  generalize(type) {
    const envFtv = this.ftv();
    const typeFtv = ftv(type);
    const vars = [...typeFtv].filter(v => !envFtv.has(v));
    return new Scheme(vars, type);
  }
}

// ==================== Unification ====================

function occursCheck(name, type) {
  switch (type.tag) {
    case 'TVar': return type.name === name;
    case 'TFun': return occursCheck(name, type.from) || occursCheck(name, type.to);
    case 'TCon': return false;
    case 'TPair': return occursCheck(name, type.fst) || occursCheck(name, type.snd);
    case 'TList': return occursCheck(name, type.elem);
    default: return false;
  }
}

function unify(t1, t2) {
  // Apply any known substitutions first
  if (t1.tag === 'TVar' && t2.tag === 'TVar' && t1.name === t2.name) {
    return Subst.empty();
  }
  if (t1.tag === 'TVar') {
    if (occursCheck(t1.name, t2)) throw new Error(`Infinite type: ${t1.name} ~ ${typeToString(t2)}`);
    return Subst.single(t1.name, t2);
  }
  if (t2.tag === 'TVar') {
    return unify(t2, t1);
  }
  if (t1.tag === 'TCon' && t2.tag === 'TCon') {
    if (t1.name !== t2.name) throw new Error(`Type mismatch: ${t1.name} vs ${t2.name}`);
    return Subst.empty();
  }
  if (t1.tag === 'TFun' && t2.tag === 'TFun') {
    const s1 = unify(t1.from, t2.from);
    const s2 = unify(s1.apply(t1.to), s1.apply(t2.to));
    return s2.compose(s1);
  }
  if (t1.tag === 'TPair' && t2.tag === 'TPair') {
    const s1 = unify(t1.fst, t2.fst);
    const s2 = unify(s1.apply(t1.snd), s1.apply(t2.snd));
    return s2.compose(s1);
  }
  if (t1.tag === 'TList' && t2.tag === 'TList') {
    return unify(t1.elem, t2.elem);
  }
  throw new Error(`Cannot unify ${typeToString(t1)} with ${typeToString(t2)}`);
}

// ==================== Algorithm W ====================

function infer(env, expr) {
  switch (expr.tag) {
    case 'Lit':
      return [Subst.empty(), expr.type];

    case 'Var': {
      const scheme = env.lookup(expr.name);
      if (!scheme) throw new Error(`Unbound variable: ${expr.name}`);
      return [Subst.empty(), scheme.instantiate()];
    }

    case 'Lam': {
      const tv = freshTVar();
      const newEnv = env.extend(expr.param, new Scheme([], tv));
      const [s, bodyType] = infer(newEnv, expr.body);
      return [s, TFun(s.apply(tv), bodyType)];
    }

    case 'App': {
      const tv = freshTVar();
      const [s1, fnType] = infer(env, expr.fn);
      const [s2, argType] = infer(env.apply(s1), expr.arg);
      const s3 = unify(s2.apply(fnType), TFun(argType, tv));
      return [s3.compose(s2).compose(s1), s3.apply(tv)];
    }

    case 'Let': {
      const [s1, valType] = infer(env, expr.value);
      const newEnv = env.apply(s1);
      const scheme = newEnv.generalize(valType);
      const [s2, bodyType] = infer(newEnv.extend(expr.name, scheme), expr.body);
      return [s2.compose(s1), bodyType];
    }

    case 'If': {
      const [s1, condType] = infer(env, expr.cond);
      const s2 = unify(condType, tBool);
      const s12 = s2.compose(s1);
      const [s3, thenType] = infer(env.apply(s12), expr.then);
      const [s4, elseType] = infer(env.apply(s3.compose(s12)), expr.else_);
      const s5 = unify(s4.apply(thenType), elseType);
      return [s5.compose(s4).compose(s3).compose(s12), s5.apply(elseType)];
    }

    case 'Pair': {
      const [s1, fstType] = infer(env, expr.fst);
      const [s2, sndType] = infer(env.apply(s1), expr.snd);
      return [s2.compose(s1), TPair(s2.apply(fstType), sndType)];
    }

    case 'Fst': {
      const tv1 = freshTVar();
      const tv2 = freshTVar();
      const [s1, exprType] = infer(env, expr.expr);
      const s2 = unify(exprType, TPair(tv1, tv2));
      return [s2.compose(s1), s2.apply(tv1)];
    }

    case 'Snd': {
      const tv1 = freshTVar();
      const tv2 = freshTVar();
      const [s1, exprType] = infer(env, expr.expr);
      const s2 = unify(exprType, TPair(tv1, tv2));
      return [s2.compose(s1), s2.apply(tv2)];
    }

    case 'Fix': {
      const [s1, exprType] = infer(env, expr.expr);
      const tv = freshTVar();
      const s2 = unify(exprType, TFun(tv, tv));
      return [s2.compose(s1), s2.apply(tv)];
    }

    case 'Ann': {
      const [s1, inferredType] = infer(env, expr.expr);
      const s2 = unify(inferredType, expr.type);
      return [s2.compose(s1), s2.apply(expr.type)];
    }

    default:
      throw new Error(`Unknown expression: ${expr.tag}`);
  }
}

// ==================== Pretty Printing ====================

function typeToString(type) {
  switch (type.tag) {
    case 'TVar': return type.name;
    case 'TCon': return type.name;
    case 'TFun': {
      const from = type.from.tag === 'TFun' ? `(${typeToString(type.from)})` : typeToString(type.from);
      return `${from} -> ${typeToString(type.to)}`;
    }
    case 'TPair': return `(${typeToString(type.fst)}, ${typeToString(type.snd)})`;
    case 'TList': return `[${typeToString(type.elem)}]`;
    default: return '?';
  }
}

function schemeToString(scheme) {
  if (scheme.vars.length === 0) return typeToString(scheme.type);
  return `∀ ${scheme.vars.join(' ')}. ${typeToString(scheme.type)}`;
}

// ==================== Convenience ====================

/** Infer the type of an expression and return a string */
function inferType(expr, extraBindings = {}) {
  resetTypeVars();
  const env = defaultEnv();
  for (const [name, type] of Object.entries(extraBindings)) {
    env.bindings.set(name, new Scheme([], type));
  }
  const [subst, type] = infer(env, expr);
  return typeToString(subst.apply(type));
}

/** Create a default type environment with common operations */
function defaultEnv() {
  const env = new TypeEnv();

  // Polymorphic identity: ∀a. a -> a
  const a = TVar('a');
  env.bindings.set('id', new Scheme(['a'], TFun(a, a)));

  // Arithmetic: Int -> Int -> Int
  for (const op of ['+', '-', '*', '/']) {
    env.bindings.set(op, new Scheme([], TFun(tInt, TFun(tInt, tInt))));
  }

  // Comparisons: Int -> Int -> Bool
  for (const op of ['==', '!=', '<', '>', '<=', '>=']) {
    env.bindings.set(op, new Scheme([], TFun(tInt, TFun(tInt, tBool))));
  }

  // Boolean ops
  env.bindings.set('&&', new Scheme([], TFun(tBool, TFun(tBool, tBool))));
  env.bindings.set('||', new Scheme([], TFun(tBool, TFun(tBool, tBool))));
  env.bindings.set('not', new Scheme([], TFun(tBool, tBool)));

  return env;
}

module.exports = {
  // Types
  TVar, TFun, TCon, TPair, TList, tInt, tBool, tString, tUnit, freshTVar, resetTypeVars,
  // AST
  Var, Lit, Lam, App, Let, If, Pair, Fst, Snd, Fix, Ann, IntLit, BoolLit, StrLit,
  // Inference
  Subst, Scheme, TypeEnv, unify, infer, inferType, defaultEnv,
  // Printing
  typeToString, schemeToString,
  // Helpers
  ftv, occursCheck,
};
