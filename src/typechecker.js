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

// Type scheme for let-polymorphism: ∀ a b . type
class Scheme {
  constructor(vars, type) { this.vars = vars; this.type = type; }
  toString() { return this.vars.length ? `∀${this.vars.join(' ')}.${this.type}` : this.type.toString(); }
}

// Primitive types
const tInt = new TCon('int');
const tFloat = new TCon('float');
const tBool = new TCon('bool');
const tString = new TCon('string');
const tNull = new TCon('null');
const tVoid = new TCon('void');

// ============================================================
// Free Type Variables & Generalization
// ============================================================

function freeTypeVars(type) {
  const vars = new Set();
  function collect(t) {
    if (t.tag === 'TVar') vars.add(t.name);
    else if (t.tag === 'TFun') { t.params.forEach(collect); collect(t.ret); }
    else if (t.tag === 'TArray') collect(t.elem);
    else if (t.tag === 'THash') { collect(t.key); collect(t.val); }
  }
  collect(type);
  return vars;
}

function freeTypeVarsScheme(scheme) {
  const ftv = freeTypeVars(scheme.type);
  for (const v of scheme.vars) ftv.delete(v);
  return ftv;
}

function freeTypeVarsEnv(env) {
  const vars = new Set();
  let current = env;
  while (current) {
    for (const [, scheme] of current.bindings) {
      const ftv = scheme instanceof Scheme ? freeTypeVarsScheme(scheme) : freeTypeVars(scheme);
      for (const v of ftv) vars.add(v);
    }
    current = current.parent;
  }
  return vars;
}

function generalize(env, subst, type) {
  const resolvedType = subst.apply(type);
  const envVars = freeTypeVarsEnv(env);
  // Apply subst to env vars too
  const resolvedEnvVars = new Set();
  for (const v of envVars) {
    const resolved = subst.apply(new TVar(v));
    for (const fv of freeTypeVars(resolved)) resolvedEnvVars.add(fv);
  }
  const typeVars = freeTypeVars(resolvedType);
  const quantified = [...typeVars].filter(v => !resolvedEnvVars.has(v));
  return new Scheme(quantified, resolvedType);
}

function instantiateScheme(scheme) {
  if (!(scheme instanceof Scheme)) return scheme;
  const subst = new Subst();
  for (const v of scheme.vars) {
    subst.map.set(v, freshVar());
  }
  return subst.apply(scheme.type);
}

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
    if (stmt instanceof ast.EnumStatement) return this._checkEnum(stmt, env);
    if (stmt instanceof ast.ImportStatement) return tVoid; // TODO: module type checking
    if (stmt instanceof ast.BreakStatement || stmt instanceof ast.ContinueStatement) return tVoid;
    if (stmt instanceof ast.DestructuringLet || stmt instanceof ast.HashDestructuringLet) return this._checkDestructure(stmt, env);
    if (stmt instanceof ast.DestructureLetStatement || stmt instanceof ast.DestructureHashLetStatement) return this._checkDestructure(stmt, env);
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
    
    // Remove placeholder before generalizing (it would pollute free vars)
    env.bindings.delete(stmt.name.value);
    
    // Generalize: let-polymorphism
    const scheme = generalize(env, this.subst, valueType);
    env.set(stmt.name.value, scheme);
    return tVoid;
  }

  _checkSet(stmt, env) {
    const valueType = this._inferExpr(stmt.value, env);
    const existing = env.get(stmt.name.value);
    if (existing) {
      const varType = instantiateScheme(existing);
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
    if (expr instanceof ast.NullLiteral) return tNull;
    if (expr instanceof ast.WhileExpression) return this._inferWhile(expr, env);
    if (expr instanceof ast.DoWhileExpression) return this._inferDoWhile(expr, env);
    if (expr instanceof ast.ForExpression) return this._inferFor(expr, env);
    if (expr instanceof ast.ForInExpression) return this._inferForIn(expr, env);
    if (expr instanceof ast.MatchExpression) return this._inferMatch(expr, env);
    if (expr instanceof ast.TernaryExpression) return this._inferTernary(expr, env);
    if (expr instanceof ast.SliceExpression) return this._inferSlice(expr, env);
    if (expr instanceof ast.RangeExpression) return this._inferRange(expr, env);
    if (expr instanceof ast.TryCatchExpression) return this._inferTryCatch(expr, env);
    if (expr instanceof ast.ThrowExpression) return this._inferThrow(expr, env);
    if (expr instanceof ast.IndexAssignExpression) return this._inferIndexAssign(expr, env);
    if (expr instanceof ast.ArrayComprehension) return this._inferArrayComp(expr, env);
    if (expr instanceof ast.OptionalChainExpression) return this._inferOptionalChain(expr, env);
    if (expr instanceof ast.SpreadExpression || expr instanceof ast.SpreadElement) return freshVar();

    // For other expression types, return fresh variable
    return freshVar();
  }

  _inferIdent(expr, env) {
    const t = env.get(expr.value);
    if (!t) {
      this._error(`Undefined variable: ${expr.value}`, expr);
      return freshVar();
    }
    // Instantiate scheme for let-polymorphism
    const instantiated = instantiateScheme(t);
    return this.subst.apply(instantiated);
  }

  _inferPrefix(expr, env) {
    const operandType = this._inferExpr(expr.right, env);
    switch (expr.operator) {
      case '!': return tBool;
      case '-': {
        // Negation requires numeric type
        const resolved = this.subst.apply(operandType);
        if (resolved.tag === 'TCon' && resolved.name !== 'int' && resolved.name !== 'float') {
          this._error(`Cannot negate ${resolved}`, expr);
        }
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

  // ============================================================
  // Loops
  // ============================================================

  _inferWhile(expr, env) {
    this._inferExpr(expr.condition, env);
    this._checkBlock(expr.body, env.extend());
    return tNull; // while doesn't produce a value
  }

  _inferDoWhile(expr, env) {
    this._checkBlock(expr.body, env.extend());
    this._inferExpr(expr.condition, env);
    return tNull;
  }

  _inferFor(expr, env) {
    const forEnv = env.extend();
    if (expr.init) this._checkStatement(expr.init, forEnv);
    if (expr.condition) this._inferExpr(expr.condition, forEnv);
    if (expr.update) this._inferExpr(expr.update, forEnv);
    this._checkBlock(expr.body, forEnv);
    return tNull;
  }

  _inferForIn(expr, env) {
    const forEnv = env.extend();
    const iterableType = this._inferExpr(expr.iterable, env);
    const resolved = this.subst.apply(iterableType);
    
    // Determine element type
    let elemType;
    if (resolved.tag === 'TArray') elemType = resolved.elem;
    else if (resolved.tag === 'THash') elemType = tString; // for-in over hash gives keys
    else elemType = freshVar();
    
    forEnv.set(expr.variable.value || expr.variable, elemType);
    this._checkBlock(expr.body, forEnv);
    return tNull;
  }

  // ============================================================
  // Match expression
  // ============================================================

  _inferMatch(expr, env) {
    const scrutineeType = this._inferExpr(expr.subject || expr.value, env);
    let resultType = null;

    for (const arm of (expr.arms || expr.cases || [])) {
      const caseEnv = env.extend();
      const pattern = arm.pattern;
      const body = arm.body;
      const guard = arm.guard;
      
      // Pattern matching: bind pattern variables and check patterns
      if (pattern) {
        if (pattern instanceof ast.Identifier && pattern.value !== '_') {
          // Variable pattern: bind to scrutinee type
          caseEnv.set(pattern.value, scrutineeType);
        } else if (pattern instanceof ast.IntegerLiteral) {
          // Integer literal pattern: unify scrutinee with int
          try { this._unify(scrutineeType, tInt, expr); } catch {}
        } else if (pattern instanceof ast.StringLiteral) {
          // String literal pattern: unify scrutinee with string
          try { this._unify(scrutineeType, tString, expr); } catch {}
        } else if (pattern instanceof ast.BooleanLiteral) {
          // Boolean literal pattern: unify scrutinee with bool
          try { this._unify(scrutineeType, tBool, expr); } catch {}
        } else if (pattern instanceof ast.ArrayLiteral) {
          // Array pattern: bind element variables
          const elemType = freshVar();
          try { this._unify(scrutineeType, new TArray(elemType), expr); } catch {}
          if (pattern.elements) {
            for (const elem of pattern.elements) {
              if (elem instanceof ast.Identifier) {
                caseEnv.set(elem.value, this.subst.apply(elemType));
              }
            }
          }
        } else if (pattern instanceof ast.NullLiteral) {
          try { this._unify(scrutineeType, tNull, expr); } catch {}
        }
        // Wildcard (_) and other patterns: no binding
      }
      
      if (guard) this._inferExpr(guard, caseEnv);
      
      // Body might be a block or a single expression
      let bodyType;
      if (body instanceof ast.BlockStatement) {
        bodyType = this._checkBlock(body, caseEnv);
      } else {
        bodyType = this._inferExpr(body, caseEnv);
      }
      
      if (!resultType) {
        resultType = bodyType;
      } else {
        try {
          this._unify(resultType, bodyType, expr);
        } catch {
          this._error(`Match arms have different types: ${this.subst.apply(resultType)} vs ${this.subst.apply(bodyType)}`, expr);
        }
      }
    }
    
    return resultType || freshVar();
  }

  // ============================================================
  // Ternary, Range, Slice, Try/Catch
  // ============================================================

  _inferTernary(expr, env) {
    this._inferExpr(expr.condition, env);
    const thenType = this._inferExpr(expr.consequence, env);
    const elseType = this._inferExpr(expr.alternative, env);
    try { this._unify(thenType, elseType, expr); } catch {
      this._error(`Ternary branches have different types`, expr);
    }
    return this.subst.apply(thenType);
  }

  _inferRange(expr, env) {
    const startType = this._inferExpr(expr.left, env);
    const endType = this._inferExpr(expr.right, env);
    try { this._unify(startType, tInt, expr); } catch {}
    try { this._unify(endType, tInt, expr); } catch {}
    return new TArray(tInt);
  }

  _inferSlice(expr, env) {
    const leftType = this._inferExpr(expr.left, env);
    if (expr.start) this._inferExpr(expr.start, env);
    if (expr.end) this._inferExpr(expr.end, env);
    return this.subst.apply(leftType); // slice returns same type
  }

  _inferTryCatch(expr, env) {
    const tryType = this._checkBlock(expr.tryBody, env.extend());
    if (expr.catchBody) {
      const catchEnv = env.extend();
      if (expr.errorIdent) {
        const ident = expr.errorIdent.value || expr.errorIdent;
        catchEnv.set(ident, freshVar());
      }
      const catchType = this._checkBlock(expr.catchBody, catchEnv);
      try { this._unify(tryType, catchType, expr); } catch {}
    }
    return this.subst.apply(tryType);
  }

  _inferThrow(expr, env) {
    if (expr.value) this._inferExpr(expr.value, env);
    return freshVar(); // throw never returns
  }

  _inferIndexAssign(expr, env) {
    const leftType = this._inferExpr(expr.left, env);
    this._inferExpr(expr.index, env);
    const valueType = this._inferExpr(expr.value, env);
    return this.subst.apply(valueType);
  }

  _inferArrayComp(expr, env) {
    const compEnv = env.extend();
    const iterableType = this._inferExpr(expr.iterable, compEnv);
    const resolved = this.subst.apply(iterableType);
    
    let elemType = freshVar();
    if (resolved.tag === 'TArray') elemType = resolved.elem;
    compEnv.set(expr.variable.value || expr.variable, elemType);
    
    if (expr.condition) this._inferExpr(expr.condition, compEnv);
    const bodyType = this._inferExpr(expr.body, compEnv);
    return new TArray(this.subst.apply(bodyType));
  }

  _inferOptionalChain(expr, env) {
    this._inferExpr(expr.left, env);
    return freshVar(); // optional chain may return null
  }

  // ============================================================
  // Enum statement
  // ============================================================

  _checkEnum(stmt, env) {
    // Enums create a namespace of constructors
    const enumName = stmt.name;
    for (const variant of (stmt.variants || [])) {
      // Each variant is a constructor function or constant
      if (variant.params && variant.params.length > 0) {
        // Constructor with params → function type
        const paramTypes = variant.params.map(() => freshVar());
        env.set(`${enumName}.${variant.name}`, new TFun(paramTypes, freshVar()));
      } else {
        // Constant variant
        env.set(`${enumName}.${variant.name}`, freshVar());
      }
    }
    return tVoid;
  }

  // ============================================================
  // Destructuring
  // ============================================================

  _checkDestructure(stmt, env) {
    const valueType = this._inferExpr(stmt.value, env);
    // For array destructuring, each name gets the element type
    // For hash destructuring, each name gets the value type
    const resolved = this.subst.apply(valueType);
    
    if (stmt.names) {
      for (const name of stmt.names) {
        if (name && name.value) {
          if (resolved.tag === 'TArray') {
            env.set(name.value, resolved.elem || freshVar());
          } else {
            env.set(name.value, freshVar());
          }
        }
      }
    }
    if (stmt.keys) {
      for (const key of stmt.keys) {
        if (key && key.value) {
          if (resolved.tag === 'THash') {
            env.set(key.value, resolved.val || freshVar());
          } else {
            env.set(key.value, freshVar());
          }
        }
      }
    }
    return tVoid;
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
  TVar, TCon, TFun, TArray, THash, Scheme,
  tInt, tFloat, tBool, tString, tNull, tVoid,
  Subst, unify, TypeEnv, freshVar, resetFresh, parseAnnotation,
  generalize, instantiateScheme, freeTypeVars
};
