/**
 * Type checker for Monkey language
 * 
 * Uses Hindley-Milner type inference (Algorithm W) adapted for Monkey's AST.
 * Checks type annotations against inferred types and reports errors.
 */

import * as ast from './ast.js';

// ============================================================
// Type Representations
// ============================================================

class TVar {
  constructor(name) { this.tag = 'TVar'; this.name = name; }
  toString() { return this.name; }
  equals(other) { return other.tag === 'TVar' && other.name === this.name; }
}

class TCon {
  constructor(name) { this.tag = 'TCon'; this.name = name; }
  toString() { return this.name; }
  equals(other) { return other.tag === 'TCon' && other.name === this.name; }
}

class TFun {
  constructor(params, ret) { this.tag = 'TFun'; this.params = params; this.ret = ret; }
  toString() {
    const ps = this.params.map(p => p.toString()).join(', ');
    return `fn(${ps}) -> ${this.ret}`;
  }
  equals(other) {
    return other.tag === 'TFun' && this.params.length === other.params.length &&
      this.params.every((p, i) => p.equals(other.params[i])) && this.ret.equals(other.ret);
  }
}

class TArray {
  constructor(elem) { this.tag = 'TArray'; this.elem = elem; }
  toString() { return `[${this.elem}]`; }
  equals(other) { return other.tag === 'TArray' && this.elem.equals(other.elem); }
}

class THash {
  constructor(key, val) { this.tag = 'THash'; this.key = key; this.val = val; }
  toString() { return `{${this.key}: ${this.val}}`; }
  equals(other) { return other.tag === 'THash' && this.key.equals(other.key) && this.val.equals(other.val); }
}

// Primitive types
const tInt = new TCon('int');
const tFloat = new TCon('float');
const tBool = new TCon('bool');
const tString = new TCon('string');
const tNull = new TCon('null');
const tVoid = new TCon('void');

// ============================================================
// Substitution
// ============================================================

class Subst {
  constructor(map = new Map()) { this.map = new Map(map); }

  apply(type) {
    if (type.tag === 'TVar') {
      const t = this.map.get(type.name);
      if (!t) return type;
      if (t.tag === 'TVar' && t.name === type.name) return type;
      return this.apply(t);
    }
    if (type.tag === 'TFun') {
      return new TFun(type.params.map(p => this.apply(p)), this.apply(type.ret));
    }
    if (type.tag === 'TArray') return new TArray(this.apply(type.elem));
    if (type.tag === 'THash') return new THash(this.apply(type.key), this.apply(type.val));
    return type; // TCon
  }

  compose(other) {
    const result = new Subst();
    for (const [k, v] of other.map) result.map.set(k, this.apply(v));
    for (const [k, v] of this.map) if (!result.map.has(k)) result.map.set(k, v);
    return result;
  }
}

// ============================================================
// Unification
// ============================================================

function occurs(name, type) {
  if (type.tag === 'TVar') return type.name === name;
  if (type.tag === 'TFun') return type.params.some(p => occurs(name, p)) || occurs(name, type.ret);
  if (type.tag === 'TArray') return occurs(name, type.elem);
  if (type.tag === 'THash') return occurs(name, type.key) || occurs(name, type.val);
  return false;
}

function unify(t1, t2) {
  t1 = resolveType(t1);
  t2 = resolveType(t2);

  if (t1.tag === 'TVar') {
    if (t1.equals(t2)) return new Subst();
    if (occurs(t1.name, t2)) throw new TypeError(`Infinite type: ${t1} ~ ${t2}`);
    const s = new Subst();
    s.map.set(t1.name, t2);
    return s;
  }
  if (t2.tag === 'TVar') return unify(t2, t1);

  if (t1.tag === 'TCon' && t2.tag === 'TCon') {
    if (t1.name === t2.name) return new Subst();
    // Allow int <-> float coercion
    if ((t1.name === 'int' && t2.name === 'float') || (t1.name === 'float' && t2.name === 'int')) {
      return new Subst();
    }
    throw new TypeError(`Type mismatch: ${t1} vs ${t2}`);
  }

  if (t1.tag === 'TFun' && t2.tag === 'TFun') {
    if (t1.params.length !== t2.params.length) {
      throw new TypeError(`Function arity mismatch: ${t1.params.length} vs ${t2.params.length}`);
    }
    let s = new Subst();
    for (let i = 0; i < t1.params.length; i++) {
      const s2 = unify(s.apply(t1.params[i]), s.apply(t2.params[i]));
      s = s2.compose(s);
    }
    const s3 = unify(s.apply(t1.ret), s.apply(t2.ret));
    return s3.compose(s);
  }

  if (t1.tag === 'TArray' && t2.tag === 'TArray') return unify(t1.elem, t2.elem);
  if (t1.tag === 'THash' && t2.tag === 'THash') {
    const s1 = unify(t1.key, t2.key);
    const s2 = unify(s1.apply(t1.val), s1.apply(t2.val));
    return s2.compose(s1);
  }

  throw new TypeError(`Cannot unify ${t1} with ${t2}`);
}

// Apply substitution through chain
function resolveType(t) {
  return t; // Subst.apply handles this
}

// ============================================================
// Type Environment
// ============================================================

class TypeEnv {
  constructor(parent = null) {
    this.bindings = new Map();
    this.parent = parent;
  }

  extend() { return new TypeEnv(this); }

  set(name, type) { this.bindings.set(name, type); }

  get(name) {
    if (this.bindings.has(name)) return this.bindings.get(name);
    if (this.parent) return this.parent.get(name);
    return null;
  }
}

// ============================================================
// Fresh Variable Generator
// ============================================================

let freshCounter = 0;

function freshVar() {
  return new TVar('_t' + (freshCounter++));
}

function resetFresh() { freshCounter = 0; }

// ============================================================
// Annotation Parsing
// ============================================================

function parseAnnotation(ann) {
  if (!ann) return null;
  switch (ann) {
    case 'int': return tInt;
    case 'float': return tFloat;
    case 'bool': return tBool;
    case 'string': return tString;
    case 'null': return tNull;
    case 'void': return tVoid;
    default:
      if (ann.startsWith('[') && ann.endsWith(']')) {
        const inner = parseAnnotation(ann.slice(1, -1));
        return inner ? new TArray(inner) : null;
      }
      return null; // Unknown type annotation
  }
}

// ============================================================
// Type Checker (Algorithm W for Monkey AST)
// ============================================================

class TypeChecker {
  constructor() {
    this.errors = [];
    this.subst = new Subst();
  }

  check(program) {
    resetFresh();
    this.errors = [];
    this.subst = new Subst();
    const env = this._defaultEnv();

    for (const stmt of program.statements) {
      this._checkStatement(stmt, env);
    }

    return { errors: this.errors, env };
  }

  _defaultEnv() {
    const env = new TypeEnv();
    // Built-in functions
    env.set('len', new TFun([freshVar()], tInt));
    env.set('puts', new TFun([freshVar()], tNull));
    env.set('push', new TFun([new TArray(freshVar()), freshVar()], new TArray(freshVar())));
    env.set('first', new TFun([new TArray(freshVar())], freshVar()));
    env.set('last', new TFun([new TArray(freshVar())], freshVar()));
    env.set('rest', new TFun([new TArray(freshVar())], new TArray(freshVar())));
    env.set('type', new TFun([freshVar()], tString));
    env.set('int', new TFun([freshVar()], tInt));
    env.set('string', new TFun([freshVar()], tString));
    return env;
  }

  _error(msg, node) {
    const loc = node?.token ? ` at line ${node.token.line || '?'}` : '';
    this.errors.push({ message: msg + loc, node });
  }

  _checkStatement(stmt, env) {
    if (stmt instanceof ast.LetStatement) return this._checkLet(stmt, env);
    if (stmt instanceof ast.ReturnStatement) return this._checkReturn(stmt, env);
    if (stmt instanceof ast.ExpressionStatement) return this._inferExpr(stmt.expression, env);
    if (stmt instanceof ast.BlockStatement) return this._checkBlock(stmt, env);
    if (stmt instanceof ast.SetStatement) return this._checkSet(stmt, env);
    // Other statements — skip for now
    return freshVar();
  }

  _checkLet(stmt, env) {
    // For recursive functions: add a fresh type var for the name first
    const placeholder = freshVar();
    env.set(stmt.name.value, placeholder);
    
    const valueType = this._inferExpr(stmt.value, env);
    try {
      this._unify(placeholder, valueType, stmt);
    } catch { /* ignore — placeholder may not match */ }
    env.set(stmt.name.value, this.subst.apply(valueType));
    return tVoid;
  }

  _checkSet(stmt, env) {
    const valueType = this._inferExpr(stmt.value, env);
    const varType = env.get(stmt.name.value);
    if (varType) {
      try {
        this._unify(varType, valueType, stmt);
      } catch {
        this._error(
          `Cannot assign ${this.subst.apply(valueType)} to ${stmt.name.value}: expected ${this.subst.apply(varType)}`,
          stmt
        );
      }
    }
    return this.subst.apply(valueType);
  }

  _checkReturn(stmt, env) {
    if (stmt.returnValue) {
      return this._inferExpr(stmt.returnValue, env);
    }
    return tNull;
  }

  _checkBlock(block, env) {
    let lastType = tVoid;
    for (const stmt of block.statements) {
      lastType = this._checkStatement(stmt, env);
    }
    return lastType;
  }

  _inferExpr(expr, env) {
    if (!expr) return tNull;

    if (expr instanceof ast.IntegerLiteral) return tInt;
    if (expr instanceof ast.FloatLiteral) return tFloat;
    if (expr instanceof ast.StringLiteral) return tString;
    if (expr instanceof ast.BooleanLiteral) return tBool;

    if (expr instanceof ast.Identifier) return this._inferIdent(expr, env);
    if (expr instanceof ast.PrefixExpression) return this._inferPrefix(expr, env);
    if (expr instanceof ast.InfixExpression) return this._inferInfix(expr, env);
    if (expr instanceof ast.IfExpression) return this._inferIf(expr, env);
    if (expr instanceof ast.FunctionLiteral) return this._inferFunction(expr, env);
    if (expr instanceof ast.CallExpression) return this._inferCall(expr, env);
    if (expr instanceof ast.ArrayLiteral) return this._inferArray(expr, env);
    if (expr instanceof ast.IndexExpression) return this._inferIndex(expr, env);
    if (expr instanceof ast.HashLiteral) return this._inferHash(expr, env);
    if (expr instanceof ast.AssignExpression) return this._inferAssign(expr, env);
    if (expr instanceof ast.TemplateLiteral || expr instanceof ast.FStringExpression) return tString;

    // For other expression types, return fresh variable
    return freshVar();
  }

  _inferIdent(expr, env) {
    const t = env.get(expr.value);
    if (!t) {
      this._error(`Undefined variable: ${expr.value}`, expr);
      return freshVar();
    }
    return this.subst.apply(t);
  }

  _inferPrefix(expr, env) {
    const operandType = this._inferExpr(expr.right, env);
    switch (expr.operator) {
      case '!': return tBool;
      case '-': {
        try { this._unify(operandType, tInt, expr); } catch { /* allow float too */ }
        return this.subst.apply(operandType);
      }
      default: return freshVar();
    }
  }

  _inferInfix(expr, env) {
    const leftType = this._inferExpr(expr.left, env);
    const rightType = this._inferExpr(expr.right, env);

    switch (expr.operator) {
      case '+': {
        // + works on int+int, float+float, string+string
        try {
          this._unify(leftType, rightType, expr);
        } catch (e) {
          this._error(`Cannot use + on ${this.subst.apply(leftType)} and ${this.subst.apply(rightType)}`, expr);
        }
        return this.subst.apply(leftType);
      }
      case '-': case '*': case '/': case '%': {
        try {
          this._unify(leftType, rightType, expr);
          // Numeric check — try unifying with int
          try { this._unify(leftType, tInt, expr); } catch { /* could be float */ }
        } catch (e) {
          this._error(`Cannot use ${expr.operator} on ${this.subst.apply(leftType)} and ${this.subst.apply(rightType)}`, expr);
        }
        return this.subst.apply(leftType);
      }
      case '==': case '!=': return tBool;
      case '<': case '>': case '<=': case '>=': {
        try { this._unify(leftType, rightType, expr); } catch {
          this._error(`Cannot compare ${this.subst.apply(leftType)} and ${this.subst.apply(rightType)}`, expr);
        }
        return tBool;
      }
      case '&&': case '||':
        return tBool;
      case '|>': {
        // Pipe: left |> right, right must be a function
        const resultType = freshVar();
        try {
          this._unify(rightType, new TFun([leftType], resultType), expr);
        } catch {
          this._error(`Right side of |> must be a function`, expr);
        }
        return this.subst.apply(resultType);
      }
      default: return freshVar();
    }
  }

  _inferIf(expr, env) {
    const condType = this._inferExpr(expr.condition, env);
    try {
      this._unify(condType, tBool, expr);
    } catch {
      // Allow truthy values — don't report as error
    }

    const thenType = this._checkBlock(expr.consequence, env.extend());
    if (expr.alternative) {
      const elseType = this._checkBlock(expr.alternative, env.extend());
      try {
        this._unify(thenType, elseType, expr);
      } catch {
        this._error(`if/else branches have different types: ${this.subst.apply(thenType)} vs ${this.subst.apply(elseType)}`, expr);
      }
    }
    return this.subst.apply(thenType);
  }

  _inferFunction(expr, env) {
    const fnEnv = env.extend();
    const paramTypes = [];

    for (let i = 0; i < expr.parameters.length; i++) {
      const param = expr.parameters[i];
      let paramType;

      if (expr.paramTypes && expr.paramTypes[i]) {
        const annotated = parseAnnotation(expr.paramTypes[i]);
        paramType = annotated || freshVar();
      } else {
        paramType = freshVar();
      }

      fnEnv.set(param.value, paramType);
      paramTypes.push(paramType);
    }

    const bodyType = this._checkBlock(expr.body, fnEnv);

    // Check return type annotation
    if (expr.returnType) {
      const annotatedRet = parseAnnotation(expr.returnType);
      if (annotatedRet) {
        try {
          this._unify(bodyType, annotatedRet, expr);
        } catch {
          this._error(
            `Function return type mismatch: annotated ${annotatedRet} but body returns ${this.subst.apply(bodyType)}`,
            expr
          );
        }
      }
    }

    return new TFun(paramTypes.map(t => this.subst.apply(t)), this.subst.apply(bodyType));
  }

  _inferCall(expr, env) {
    const fnType = this._inferExpr(expr.function, env);
    const argTypes = expr.arguments.map(a => this._inferExpr(a, env));
    const resultType = freshVar();

    try {
      this._unify(fnType, new TFun(argTypes, resultType), expr);
    } catch {
      this._error(
        `Cannot call ${this.subst.apply(fnType)} with (${argTypes.map(t => this.subst.apply(t)).join(', ')})`,
        expr
      );
    }

    return this.subst.apply(resultType);
  }

  _inferArray(expr, env) {
    if (expr.elements.length === 0) return new TArray(freshVar());
    
    const elemTypes = expr.elements.map(e => this._inferExpr(e, env));
    let elemType = elemTypes[0];
    for (let i = 1; i < elemTypes.length; i++) {
      try {
        const s = unify(this.subst.apply(elemType), this.subst.apply(elemTypes[i]));
        this.subst = s.compose(this.subst);
      } catch {
        // Mixed array — use first element type
      }
    }
    return new TArray(this.subst.apply(elemType));
  }

  _inferIndex(expr, env) {
    const leftType = this._inferExpr(expr.left, env);
    this._inferExpr(expr.index, env);
    
    const resolved = this.subst.apply(leftType);
    if (resolved.tag === 'TArray') return resolved.elem;
    if (resolved.tag === 'THash') return resolved.val;
    return freshVar();
  }

  _inferHash(expr, env) {
    if (expr.pairs.length === 0) return new THash(freshVar(), freshVar());

    let keyType = null, valType = null;
    for (const [k, v] of expr.pairs) {
      const kt = this._inferExpr(k, env);
      const vt = this._inferExpr(v, env);
      if (!keyType) { keyType = kt; valType = vt; }
      else {
        try { this._unify(keyType, kt, expr); } catch {}
        try { this._unify(valType, vt, expr); } catch {}
      }
    }
    return new THash(this.subst.apply(keyType), this.subst.apply(valType));
  }

  _inferAssign(expr, env) {
    const valueType = this._inferExpr(expr.value, env);
    const varType = env.get(expr.name.value);
    if (varType) {
      try {
        this._unify(varType, valueType, expr);
      } catch {
        this._error(
          `Cannot assign ${this.subst.apply(valueType)} to ${expr.name.value}: ${this.subst.apply(varType)}`,
          expr
        );
      }
    }
    return this.subst.apply(valueType);
  }

  _unify(t1, t2, node) {
    try {
      const s = unify(this.subst.apply(t1), this.subst.apply(t2));
      this.subst = s.compose(this.subst);
    } catch (e) {
      throw e;
    }
  }
}

// ============================================================
// Public API
// ============================================================

function typecheck(program) {
  const checker = new TypeChecker();
  return checker.check(program);
}

export {
  typecheck, TypeChecker,
  TVar, TCon, TFun, TArray, THash,
  tInt, tFloat, tBool, tString, tNull, tVoid,
  Subst, unify, TypeEnv, freshVar, resetFresh, parseAnnotation
};
