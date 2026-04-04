// ===== Hindley-Milner Type Inference Engine =====
//
// Implements Algorithm W for type inference:
// 1. Type representation (TVar, TConst, TFun, TForall)
// 2. Substitution and unification
// 3. Type environments
// 4. Algorithm W (constraint generation + solving)

// ===== Type Representation =====

let _typeVarCounter = 0;
export function freshTypeVar(prefix = 't') {
  return new TVar(`${prefix}${_typeVarCounter++}`);
}

export function resetTypeVarCounter() { _typeVarCounter = 0; }

export class TVar {
  constructor(name) { this.name = name; }
  toString() { return this.name; }
  equals(other) { return other instanceof TVar && this.name === other.name; }
  freeVars() { return new Set([this.name]); }
  apply(subst) { return subst.has(this.name) ? subst.get(this.name) : this; }
}

export class TConst {
  constructor(name) { this.name = name; }
  toString() { return this.name; }
  equals(other) { return other instanceof TConst && this.name === other.name; }
  freeVars() { return new Set(); }
  apply(subst) { return this; }
}

export class TFun {
  constructor(from, to) { this.from = from; this.to = to; }
  toString() {
    const fromStr = this.from instanceof TFun ? `(${this.from})` : `${this.from}`;
    return `${fromStr} -> ${this.to}`;
  }
  equals(other) {
    return other instanceof TFun && this.from.equals(other.from) && this.to.equals(other.to);
  }
  freeVars() {
    const s = this.from.freeVars();
    for (const v of this.to.freeVars()) s.add(v);
    return s;
  }
  apply(subst) { return new TFun(this.from.apply(subst), this.to.apply(subst)); }
}

export class TList {
  constructor(elem) { this.elem = elem; }
  toString() { return `[${this.elem}]`; }
  equals(other) { return other instanceof TList && this.elem.equals(other.elem); }
  freeVars() { return this.elem.freeVars(); }
  apply(subst) { return new TList(this.elem.apply(subst)); }
}

export class TTuple {
  constructor(types) { this.types = types; }
  toString() { return `(${this.types.join(', ')})`; }
  equals(other) {
    return other instanceof TTuple && this.types.length === other.types.length
      && this.types.every((t, i) => t.equals(other.types[i]));
  }
  freeVars() {
    const s = new Set();
    for (const t of this.types) for (const v of t.freeVars()) s.add(v);
    return s;
  }
  apply(subst) { return new TTuple(this.types.map(t => t.apply(subst))); }
}

// Type scheme: ∀ a1 a2 ... . type
export class TForall {
  constructor(vars, type) { this.vars = vars; this.type = type; }
  toString() {
    if (this.vars.length === 0) return `${this.type}`;
    return `∀ ${this.vars.join(' ')} . ${this.type}`;
  }
  freeVars() {
    const s = this.type.freeVars();
    for (const v of this.vars) s.delete(v);
    return s;
  }
  // Instantiate with fresh variables
  instantiate() {
    const subst = new Map();
    for (const v of this.vars) {
      subst.set(v, freshTypeVar());
    }
    return this.type.apply(subst);
  }
}

// Common types
export const tInt = new TConst('Int');
export const tBool = new TConst('Bool');
export const tString = new TConst('String');
export const tUnit = new TConst('Unit');

// ===== Substitution =====

export function composeSubst(s1, s2) {
  // Apply s1 to all types in s2, then add s1 entries
  const result = new Map();
  for (const [k, v] of s2) {
    result.set(k, v.apply(s1));
  }
  for (const [k, v] of s1) {
    if (!result.has(k)) result.set(k, v);
  }
  return result;
}

// ===== Unification =====

export class UnificationError extends Error {
  constructor(msg, t1, t2) {
    super(msg);
    this.t1 = t1;
    this.t2 = t2;
  }
}

function occursCheck(varName, type) {
  return type.freeVars().has(varName);
}

export function unify(t1, t2) {
  // Apply current knowledge before unifying
  if (t1 instanceof TVar) {
    if (t1.equals(t2)) return new Map();
    if (occursCheck(t1.name, t2)) {
      throw new UnificationError(`Occurs check: ${t1} appears in ${t2}`, t1, t2);
    }
    return new Map([[t1.name, t2]]);
  }
  
  if (t2 instanceof TVar) {
    return unify(t2, t1);
  }
  
  if (t1 instanceof TConst && t2 instanceof TConst) {
    if (t1.name === t2.name) return new Map();
    throw new UnificationError(`Cannot unify ${t1} with ${t2}`, t1, t2);
  }
  
  if (t1 instanceof TFun && t2 instanceof TFun) {
    const s1 = unify(t1.from, t2.from);
    const s2 = unify(t1.to.apply(s1), t2.to.apply(s1));
    return composeSubst(s2, s1);
  }
  
  if (t1 instanceof TList && t2 instanceof TList) {
    return unify(t1.elem, t2.elem);
  }
  
  if (t1 instanceof TTuple && t2 instanceof TTuple) {
    if (t1.types.length !== t2.types.length) {
      throw new UnificationError(`Tuple size mismatch: ${t1} vs ${t2}`, t1, t2);
    }
    let subst = new Map();
    for (let i = 0; i < t1.types.length; i++) {
      const s = unify(t1.types[i].apply(subst), t2.types[i].apply(subst));
      subst = composeSubst(s, subst);
    }
    return subst;
  }
  
  if (t1 instanceof TApp && t2 instanceof TApp) {
    if (t1.name !== t2.name || t1.args.length !== t2.args.length) {
      throw new UnificationError(`Cannot unify ${t1} with ${t2}`, t1, t2);
    }
    let subst = new Map();
    for (let i = 0; i < t1.args.length; i++) {
      const s = unify(t1.args[i].apply(subst), t2.args[i].apply(subst));
      subst = composeSubst(s, subst);
    }
    return subst;
  }
  
  throw new UnificationError(`Cannot unify ${t1} with ${t2}`, t1, t2);
}

// ===== Type Environment =====

export class TypeEnv {
  constructor(bindings = new Map()) {
    this.bindings = bindings;
  }
  
  extend(name, scheme) {
    const newBindings = new Map(this.bindings);
    newBindings.set(name, scheme);
    return new TypeEnv(newBindings);
  }
  
  lookup(name) {
    return this.bindings.get(name) ?? null;
  }
  
  freeVars() {
    const s = new Set();
    for (const scheme of this.bindings.values()) {
      for (const v of scheme.freeVars()) s.add(v);
    }
    return s;
  }
  
  apply(subst) {
    const newBindings = new Map();
    for (const [k, v] of this.bindings) {
      if (v instanceof TForall) {
        newBindings.set(k, new TForall(v.vars, v.type.apply(subst)));
      } else {
        newBindings.set(k, v.apply(subst));
      }
    }
    return new TypeEnv(newBindings);
  }
}

// Generalize a type into a type scheme (∀ free vars not in env)
export function generalize(env, type) {
  const envFree = env.freeVars();
  const typeFree = type.freeVars();
  const quantified = [];
  for (const v of typeFree) {
    if (!envFree.has(v)) quantified.push(v);
  }
  return new TForall(quantified, type);
}

// ===== Expression AST =====

// Literals
export const lit = (value, type) => ({ tag: 'lit', value, type });
export const intLit = (n) => lit(n, 'int');
export const boolLit = (b) => lit(b, 'bool');
export const strLit = (s) => lit(s, 'string');

// Variable reference
export const varRef = (name) => ({ tag: 'var', name });

// Lambda: fn x => body
export const lam = (param, body) => ({ tag: 'lam', param, body });

// Application: f(x)
export const app = (fn, arg) => ({ tag: 'app', fn, arg });

// Let: let x = e1 in e2
export const letExpr = (name, value, body) => ({ tag: 'let', name, value, body });

// If-then-else
export const ifExpr = (cond, then, else_) => ({ tag: 'if', cond, then, else: else_ });

// Binary operators
export const binOp = (op, left, right) => ({ tag: 'binop', op, left, right });

// Let-rec: let rec f = e1 in e2
export const letRec = (name, value, body) => ({ tag: 'letrec', name, value, body });

// Match expression: match expr { patterns }
export const matchExpr = (expr, cases) => ({ tag: 'match', expr, cases });
// Case: pattern => body
export const matchCase = (pattern, body) => ({ pattern, body });

// Patterns
export const pVar = (name) => ({ tag: 'pvar', name });
export const pLit = (value, type) => ({ tag: 'plit', value, type });
export const pCon = (name, args) => ({ tag: 'pcon', name, args });
export const pWild = () => ({ tag: 'pwild' });

// Type constructor application: Maybe Int, List Bool, etc.
export class TApp {
  constructor(name, args) { this.name = name; this.args = args; }
  toString() {
    if (this.args.length === 0) return this.name;
    return `${this.name} ${this.args.map(a => a instanceof TFun || a instanceof TApp ? `(${a})` : `${a}`).join(' ')}`;
  }
  equals(other) {
    return other instanceof TApp && this.name === other.name
      && this.args.length === other.args.length
      && this.args.every((a, i) => a.equals(other.args[i]));
  }
  freeVars() {
    const s = new Set();
    for (const a of this.args) for (const v of a.freeVars()) s.add(v);
    return s;
  }
  apply(subst) { return new TApp(this.name, this.args.map(a => a.apply(subst))); }
}

// Data type definition
export class DataType {
  constructor(name, typeParams, constructors) {
    this.name = name;           // e.g., "Maybe"
    this.typeParams = typeParams; // e.g., ["a"]
    this.constructors = constructors; // e.g., [{ name: "Nothing", fields: [] }, { name: "Just", fields: [TVar("a")] }]
  }
  
  // Get the type of a constructor as a function type
  constructorType(conName) {
    const con = this.constructors.find(c => c.name === conName);
    if (!con) return null;
    
    // Instantiate type params with fresh vars
    const subst = new Map();
    for (const p of this.typeParams) {
      subst.set(p, freshTypeVar());
    }
    
    const resultType = new TApp(this.name, this.typeParams.map(p => subst.get(p)));
    
    if (con.fields.length === 0) return resultType;
    
    // Build function type: field1 -> field2 -> ... -> ResultType
    let t = resultType;
    for (let i = con.fields.length - 1; i >= 0; i--) {
      t = new TFun(con.fields[i].apply(subst), t);
    }
    return t;
  }
}

// ===== Algorithm W =====

export function infer(expr, env = defaultEnv()) {
  resetTypeVarCounter();
  const [subst, type] = algorithmW(env, expr);
  return type.apply(subst);
}

function algorithmW(env, expr) {
  switch (expr.tag) {
    case 'lit': {
      if (expr.type === 'int') return [new Map(), tInt];
      if (expr.type === 'bool') return [new Map(), tBool];
      if (expr.type === 'string') return [new Map(), tString];
      return [new Map(), tUnit];
    }
    
    case 'var': {
      const scheme = env.lookup(expr.name);
      if (!scheme) throw new Error(`Unbound variable: ${expr.name}`);
      if (scheme instanceof TForall) {
        return [new Map(), scheme.instantiate()];
      }
      return [new Map(), scheme];
    }
    
    case 'lam': {
      const paramType = freshTypeVar();
      const newEnv = env.extend(expr.param, paramType);
      const [s1, bodyType] = algorithmW(newEnv, expr.body);
      return [s1, new TFun(paramType.apply(s1), bodyType)];
    }
    
    case 'app': {
      const resultType = freshTypeVar();
      const [s1, fnType] = algorithmW(env, expr.fn);
      const [s2, argType] = algorithmW(env.apply(s1), expr.arg);
      const s3 = unify(fnType.apply(s2), new TFun(argType, resultType));
      return [composeSubst(s3, composeSubst(s2, s1)), resultType.apply(s3)];
    }
    
    case 'let': {
      const [s1, valueType] = algorithmW(env, expr.value);
      const generalizedType = generalize(env.apply(s1), valueType);
      const newEnv = env.apply(s1).extend(expr.name, generalizedType);
      const [s2, bodyType] = algorithmW(newEnv, expr.body);
      return [composeSubst(s2, s1), bodyType];
    }
    
    case 'letrec': {
      const recType = freshTypeVar();
      const newEnv = env.extend(expr.name, recType);
      const [s1, valueType] = algorithmW(newEnv, expr.value);
      const s2 = unify(recType.apply(s1), valueType);
      const finalSubst = composeSubst(s2, s1);
      const generalizedType = generalize(env.apply(finalSubst), valueType.apply(s2));
      const bodyEnv = env.apply(finalSubst).extend(expr.name, generalizedType);
      const [s3, bodyType] = algorithmW(bodyEnv, expr.body);
      return [composeSubst(s3, finalSubst), bodyType];
    }
    
    case 'if': {
      const [s1, condType] = algorithmW(env, expr.cond);
      const s2 = unify(condType, tBool);
      const env1 = env.apply(composeSubst(s2, s1));
      const [s3, thenType] = algorithmW(env1, expr.then);
      const env2 = env1.apply(s3);
      const [s4, elseType] = algorithmW(env2, expr.else);
      const s5 = unify(thenType.apply(s4), elseType);
      return [composeSubst(s5, composeSubst(s4, composeSubst(s3, composeSubst(s2, s1)))), elseType.apply(s5)];
    }
    
    case 'binop': {
      const opTypes = {
        '+': [tInt, tInt, tInt],
        '-': [tInt, tInt, tInt],
        '*': [tInt, tInt, tInt],
        '/': [tInt, tInt, tInt],
        '%': [tInt, tInt, tInt],
        '==': null, // polymorphic
        '!=': null,
        '<': [tInt, tInt, tBool],
        '>': [tInt, tInt, tBool],
        '<=': [tInt, tInt, tBool],
        '>=': [tInt, tInt, tBool],
        '&&': [tBool, tBool, tBool],
        '||': [tBool, tBool, tBool],
      };
      
      const [s1, leftType] = algorithmW(env, expr.left);
      const [s2, rightType] = algorithmW(env.apply(s1), expr.right);
      
      if (expr.op === '==' || expr.op === '!=') {
        // Polymorphic equality: both sides must be same type, returns Bool
        const s3 = unify(leftType.apply(s2), rightType);
        return [composeSubst(s3, composeSubst(s2, s1)), tBool];
      }
      
      const [expectedLeft, expectedRight, resultType] = opTypes[expr.op];
      const s3 = unify(leftType.apply(s2), expectedLeft);
      const s4 = unify(rightType.apply(s3), expectedRight);
      return [composeSubst(s4, composeSubst(s3, composeSubst(s2, s1))), resultType];
    }
    
    case 'match': {
      const [s1, exprType] = algorithmW(env, expr.expr);
      let subst = s1;
      let resultType = freshTypeVar();
      
      for (const { pattern, body } of expr.cases) {
        // Infer pattern type and get bindings
        const [patSubst, patType, bindings] = inferPattern(pattern, env.apply(subst));
        const s2 = unify(exprType.apply(subst).apply(patSubst), patType);
        subst = composeSubst(s2, composeSubst(patSubst, subst));
        
        // Extend env with pattern bindings
        let bodyEnv = env.apply(subst);
        for (const [name, type] of bindings) {
          bodyEnv = bodyEnv.extend(name, type.apply(subst));
        }
        
        const [s3, bodyType] = algorithmW(bodyEnv, body);
        const s4 = unify(resultType.apply(s3).apply(subst), bodyType);
        subst = composeSubst(s4, composeSubst(s3, subst));
        resultType = resultType.apply(subst);
      }
      
      return [subst, resultType.apply(subst)];
    }
    
    default:
      throw new Error(`Unknown expression tag: ${expr.tag}`);
  }
}

// Infer type of a pattern, return [substitution, type, bindings]
function inferPattern(pattern, env) {
  switch (pattern.tag) {
    case 'pvar': {
      const t = freshTypeVar();
      return [new Map(), t, [[pattern.name, t]]];
    }
    case 'plit': {
      if (pattern.type === 'int') return [new Map(), tInt, []];
      if (pattern.type === 'bool') return [new Map(), tBool, []];
      if (pattern.type === 'string') return [new Map(), tString, []];
      return [new Map(), tUnit, []];
    }
    case 'pwild': {
      return [new Map(), freshTypeVar(), []];
    }
    case 'pcon': {
      // Look up constructor type in environment
      const conScheme = env.lookup(pattern.name);
      if (!conScheme) throw new Error(`Unknown constructor: ${pattern.name}`);
      
      const conType = conScheme instanceof TForall ? conScheme.instantiate() : conScheme;
      
      // For each arg pattern, infer its type
      const bindings = [];
      let currentType = conType;
      let subst = new Map();
      
      for (const argPat of pattern.args) {
        if (!(currentType instanceof TFun)) {
          throw new Error(`Constructor ${pattern.name} applied to too many arguments`);
        }
        const [patSubst, patType, patBindings] = inferPattern(argPat, env.apply(subst));
        const s = unify(currentType.from.apply(subst).apply(patSubst), patType);
        subst = composeSubst(s, composeSubst(patSubst, subst));
        bindings.push(...patBindings);
        currentType = currentType.to.apply(subst);
      }
      
      return [subst, currentType.apply(subst), bindings];
    }
    default:
      throw new Error(`Unknown pattern tag: ${pattern.tag}`);
  }
}

// Default environment with built-in functions
export function defaultEnv() {
  const a = new TVar('_a');
  return new TypeEnv(new Map([
    // Identity function
    ['id', new TForall(['_a'], new TFun(a, a))],
    // Constant function
    ['const', new TForall(['_a', '_b'], new TFun(a, new TFun(new TVar('_b'), a)))],
    // Negate
    ['negate', new TFun(tInt, tInt)],
    ['not', new TFun(tBool, tBool)],
  ]));
}
