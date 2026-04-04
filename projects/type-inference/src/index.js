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

// ===== Row Polymorphism =====

// Row type: a collection of label:type pairs with an optional tail
// TRowEmpty: {} (empty row)
// TRowExtend: {label: type | rest} where rest is another row
export class TRowEmpty {
  toString() { return '{}'; }
  equals(other) { return other instanceof TRowEmpty; }
  freeVars() { return new Set(); }
  apply(_subst) { return this; }
}

export class TRowExtend {
  constructor(label, fieldType, rest) {
    this.label = label;
    this.fieldType = fieldType;
    this.rest = rest; // another row (TRowEmpty, TRowExtend, or TVar)
  }
  toString() {
    const fields = [];
    let current = this;
    while (current instanceof TRowExtend) {
      fields.push(`${current.label}: ${current.fieldType}`);
      current = current.rest;
    }
    if (current instanceof TRowEmpty) {
      return `{${fields.join(', ')}}`;
    }
    return `{${fields.join(', ')} | ${current}}`;
  }
  equals(other) {
    return other instanceof TRowExtend && this.label === other.label
      && this.fieldType.equals(other.fieldType) && this.rest.equals(other.rest);
  }
  freeVars() {
    const s = this.fieldType.freeVars();
    for (const v of this.rest.freeVars()) s.add(v);
    return s;
  }
  apply(subst) {
    return new TRowExtend(this.label, this.fieldType.apply(subst), this.rest.apply(subst));
  }
}

// TRecord wraps a row type
export class TRecord {
  constructor(row) { this.row = row; }
  toString() { return this.row.toString(); }
  equals(other) { return other instanceof TRecord && this.row.equals(other.row); }
  freeVars() { return this.row.freeVars(); }
  apply(subst) { return new TRecord(this.row.apply(subst)); }
}

// Helper to build record types
export function record(fields, rest = null) {
  let row = rest || new TRowEmpty();
  // Build from right to left
  const entries = Object.entries(fields).reverse();
  for (const [label, type] of entries) {
    row = new TRowExtend(label, type, row);
  }
  return new TRecord(row);
}

// Rewrite a row to extract a specific label (for unification)
// Returns { fieldType, rest } where rest is the row without the label
function rewriteRow(row, label) {
  if (row instanceof TRowEmpty) {
    throw new UnificationError(`Label "${label}" not found in row`, row, row);
  }
  if (row instanceof TVar) {
    // Open row: create fresh vars for field type and rest
    const fieldType = freshTypeVar();
    const restRow = freshTypeVar();
    return { fieldType, rest: restRow, subst: new Map([[row.name, new TRowExtend(label, fieldType, restRow)]]) };
  }
  if (row instanceof TRowExtend) {
    if (row.label === label) {
      return { fieldType: row.fieldType, rest: row.rest, subst: new Map() };
    }
    // Search deeper
    const result = rewriteRow(row.rest, label);
    return {
      fieldType: result.fieldType,
      rest: new TRowExtend(row.label, row.fieldType, result.rest),
      subst: result.subst,
    };
  }
  throw new UnificationError(`Invalid row type: ${row}`, row, row);
}

// AST nodes for records
export const recordLit = (fields) => ({ tag: 'record', fields }); // { name: expr, ... }
export const recordAccess = (record, label) => ({ tag: 'recordAccess', record, label });
export const recordExtend = (record, label, value) => ({ tag: 'recordExtend', record, label, value });
export const recordRestrict = (record, label) => ({ tag: 'recordRestrict', record, label });

// ===== Type Classes =====

// A constraint like "Eq a" or "Num a"
export class TConstraint {
  constructor(className, typeArg) {
    this.className = className;
    this.typeArg = typeArg;
  }
  toString() { return `${this.className} ${this.typeArg}`; }
  freeVars() { return this.typeArg.freeVars(); }
  apply(subst) { return new TConstraint(this.className, this.typeArg.apply(subst)); }
  equals(other) {
    return other instanceof TConstraint && this.className === other.className
      && this.typeArg.equals(other.typeArg);
  }
}

// A qualified type: constraints => type (e.g., "Eq a => a -> a -> Bool")
export class TQualified {
  constructor(constraints, type) {
    this.constraints = constraints; // TConstraint[]
    this.type = type;
  }
  toString() {
    if (this.constraints.length === 0) return `${this.type}`;
    const cs = this.constraints.map(c => c.toString()).join(', ');
    return `(${cs}) => ${this.type}`;
  }
  freeVars() {
    const s = this.type.freeVars();
    for (const c of this.constraints) for (const v of c.freeVars()) s.add(v);
    return s;
  }
  apply(subst) {
    return new TQualified(
      this.constraints.map(c => c.apply(subst)),
      this.type.apply(subst)
    );
  }
}

// Type class declaration: class Eq a where eq :: a -> a -> Bool
export class TypeClass {
  constructor(name, typeParam, methods, superclasses = []) {
    this.name = name;
    this.typeParam = typeParam;      // e.g., "a"
    this.methods = methods;          // Map<string, type> (using typeParam)
    this.superclasses = superclasses; // string[] - superclass names
  }
}

// Type class instance: instance Eq Int where eq = ...
export class TypeClassInstance {
  constructor(className, type, constraints = []) {
    this.className = className;
    this.type = type;          // concrete type or parameterized (e.g., TApp("List", [TVar("a")]))
    this.constraints = constraints; // required constraints (e.g., [TConstraint("Eq", TVar("a"))] for Eq [a])
  }
}

// Class environment: stores class declarations and instances
export class ClassEnv {
  constructor() {
    this.classes = new Map();    // className -> TypeClass
    this.instances = new Map();  // className -> TypeClassInstance[]
  }

  addClass(cls) {
    this.classes.set(cls.name, cls);
    if (!this.instances.has(cls.name)) {
      this.instances.set(cls.name, []);
    }
  }

  addInstance(inst) {
    const insts = this.instances.get(inst.className) || [];
    insts.push(inst);
    this.instances.set(inst.className, insts);
  }

  getClass(name) { return this.classes.get(name) || null; }

  getInstances(className) { return this.instances.get(className) || []; }

  // Check if a constraint is satisfiable (instance exists for the type)
  entails(constraint) {
    const cls = this.classes.get(constraint.className);
    if (!cls) return false;

    const instances = this.getInstances(constraint.className);
    for (const inst of instances) {
      try {
        // Try to unify the instance type with the constraint's type arg
        const subst = unify(inst.type, constraint.typeArg);
        // Check that any required instance constraints are also satisfiable
        const allSatisfied = inst.constraints.every(c => this.entails(c.apply(subst)));
        if (allSatisfied) return true;
      } catch (e) {
        // Unification failed - this instance doesn't match
        continue;
      }
    }
    return false;
  }

  // Resolve: find the matching instance and return required sub-constraints
  resolve(constraint) {
    const instances = this.getInstances(constraint.className);
    for (const inst of instances) {
      try {
        const subst = unify(inst.type, constraint.typeArg);
        return inst.constraints.map(c => c.apply(subst));
      } catch (e) {
        continue;
      }
    }
    return null; // Not resolvable yet (may have free type vars)
  }
}

// Build a default class environment with Eq, Ord, Num, Show
export function defaultClassEnv() {
  const a = new TVar('_a');
  const env = new ClassEnv();

  // class Eq a where eq :: a -> a -> Bool
  env.addClass(new TypeClass('Eq', '_a', new Map([
    ['eq', new TFun(a, new TFun(a, tBool))],
    ['neq', new TFun(a, new TFun(a, tBool))],
  ])));

  // class Eq a => Ord a where compare :: a -> a -> Int
  env.addClass(new TypeClass('Ord', '_a', new Map([
    ['compare', new TFun(a, new TFun(a, tInt))],
    ['lt', new TFun(a, new TFun(a, tBool))],
    ['gt', new TFun(a, new TFun(a, tBool))],
  ]), ['Eq']));

  // class Num a where add :: a -> a -> a, mul :: a -> a -> a, fromInt :: Int -> a
  env.addClass(new TypeClass('Num', '_a', new Map([
    ['add', new TFun(a, new TFun(a, a))],
    ['sub', new TFun(a, new TFun(a, a))],
    ['mul', new TFun(a, new TFun(a, a))],
    ['fromInt', new TFun(tInt, a)],
  ])));

  // class Show a where show :: a -> String
  env.addClass(new TypeClass('Show', '_a', new Map([
    ['show', new TFun(a, tString)],
  ])));

  // Instances for Int
  env.addInstance(new TypeClassInstance('Eq', tInt));
  env.addInstance(new TypeClassInstance('Ord', tInt));
  env.addInstance(new TypeClassInstance('Num', tInt));
  env.addInstance(new TypeClassInstance('Show', tInt));

  // Instances for Bool
  env.addInstance(new TypeClassInstance('Eq', tBool));
  env.addInstance(new TypeClassInstance('Show', tBool));

  // Instances for String
  env.addInstance(new TypeClassInstance('Eq', tString));
  env.addInstance(new TypeClassInstance('Ord', tString));
  env.addInstance(new TypeClassInstance('Show', tString));

  // Instance for List: Eq [a] requires Eq a
  env.addInstance(new TypeClassInstance('Eq', new TList(new TVar('_a')),
    [new TConstraint('Eq', new TVar('_a'))]));
  env.addInstance(new TypeClassInstance('Show', new TList(new TVar('_a')),
    [new TConstraint('Show', new TVar('_a'))]));

  return env;
}

// AST nodes for type class features
export const classMethodRef = (className, methodName) => ({ tag: 'classmethod', className, methodName });
export const constrainedExpr = (constraints, expr) => ({ tag: 'constrained', constraints, expr });

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

  // Row types
  if (t1 instanceof TRecord && t2 instanceof TRecord) {
    return unifyRows(t1.row, t2.row);
  }

  if (t1 instanceof TRowEmpty && t2 instanceof TRowEmpty) {
    return new Map();
  }

  if (t1 instanceof TRowExtend && t2 instanceof TRowExtend) {
    return unifyRows(t1, t2);
  }

  throw new UnificationError(`Cannot unify ${t1} with ${t2}`, t1, t2);
}

// Unify two rows
function unifyRows(r1, r2) {
  // Both empty
  if (r1 instanceof TRowEmpty && r2 instanceof TRowEmpty) {
    return new Map();
  }

  // One is a type variable (open row)
  if (r1 instanceof TVar) {
    if (occursCheck(r1.name, r2)) {
      throw new UnificationError(`Occurs check in row: ${r1} in ${r2}`, r1, r2);
    }
    return new Map([[r1.name, r2]]);
  }
  if (r2 instanceof TVar) {
    return unifyRows(r2, r1);
  }

  // Both are row extensions
  if (r1 instanceof TRowExtend && r2 instanceof TRowExtend) {
    // Find the same label in r2
    try {
      const { fieldType, rest, subst: rewriteSubst } = rewriteRow(r2, r1.label);
      const s1 = composeSubst(unify(r1.fieldType, fieldType.apply(rewriteSubst)), rewriteSubst);
      const s2 = unifyRows(r1.rest.apply(s1), rest.apply(s1));
      return composeSubst(s2, s1);
    } catch (e) {
      throw new UnificationError(`Cannot unify rows: ${r1} vs ${r2}`, r1, r2);
    }
  }

  // Empty vs extend: fail
  if ((r1 instanceof TRowEmpty && r2 instanceof TRowExtend) ||
      (r1 instanceof TRowExtend && r2 instanceof TRowEmpty)) {
    throw new UnificationError(`Row mismatch: ${r1} vs ${r2}`, r1, r2);
  }

  throw new UnificationError(`Cannot unify rows: ${r1} vs ${r2}`, r1, r2);
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

export function infer(expr, env = defaultEnv(), classEnv = null) {
  resetTypeVarCounter();
  if (classEnv) {
    const [subst, type, constraints] = algorithmWConstrained(env, expr, classEnv);
    const finalType = type.apply(subst);
    // Reduce constraints: remove those satisfied by known instances
    const unreduced = constraints.map(c => c.apply(subst));
    const remaining = reduceConstraints(unreduced, classEnv);
    if (remaining.length > 0) {
      return new TQualified(remaining, finalType);
    }
    return finalType;
  }
  const [subst, type] = algorithmW(env, expr);
  return type.apply(subst);
}

// Reduce constraints by removing those entailed by the class environment
function reduceConstraints(constraints, classEnv) {
  const remaining = [];
  for (const c of constraints) {
    // If the type is fully concrete, check if an instance exists
    if (c.typeArg.freeVars().size === 0) {
      if (!classEnv.entails(c)) {
        throw new Error(`No instance for ${c}`);
      }
      // Constraint is satisfied - drop it
    } else {
      // Type still has free vars - constraint remains
      // Deduplicate
      if (!remaining.some(r => r.equals(c))) {
        remaining.push(c);
      }
    }
  }
  return remaining;
}

// Constrained Algorithm W - returns [subst, type, constraints[]]
function algorithmWConstrained(env, expr, classEnv) {
  switch (expr.tag) {
    case 'classmethod': {
      const cls = classEnv.getClass(expr.className);
      if (!cls) throw new Error(`Unknown class: ${expr.className}`);
      const methodType = cls.methods.get(expr.methodName);
      if (!methodType) throw new Error(`Unknown method ${expr.methodName} in class ${expr.className}`);
      // Instantiate with a fresh type variable and add constraint
      const tv = freshTypeVar();
      const subst = new Map([[cls.typeParam, tv]]);
      const instantiatedType = methodType.apply(subst);
      return [new Map(), instantiatedType, [new TConstraint(expr.className, tv)]];
    }

    case 'constrained': {
      // User-annotated constrained expression
      const [s, t, cs] = algorithmWConstrained(env, expr.expr, classEnv);
      return [s, t, [...cs, ...expr.constraints]];
    }

    case 'lit':
    case 'var':
    case 'lam':
    case 'app':
    case 'let':
    case 'letrec':
    case 'if':
    case 'binop':
    case 'match': {
      // Delegate to standard Algorithm W, collecting constraints from sub-expressions
      return algorithmWConstrainedDispatch(env, expr, classEnv);
    }

    default:
      throw new Error(`Unknown expression tag: ${expr.tag}`);
  }
}

function algorithmWConstrainedDispatch(env, expr, classEnv) {
  switch (expr.tag) {
    case 'lit': {
      if (expr.type === 'int') return [new Map(), tInt, []];
      if (expr.type === 'bool') return [new Map(), tBool, []];
      if (expr.type === 'string') return [new Map(), tString, []];
      return [new Map(), tUnit, []];
    }

    case 'var': {
      const scheme = env.lookup(expr.name);
      if (!scheme) throw new Error(`Unbound variable: ${expr.name}`);
      if (scheme instanceof TForall) {
        const instantiated = scheme.instantiate();
        // If the forall body was a TQualified, split into type + constraints
        if (instantiated instanceof TQualified) {
          return [new Map(), instantiated.type, [...instantiated.constraints]];
        }
        return [new Map(), instantiated, []];
      }
      if (scheme instanceof TQualified) {
        const freshSubst = new Map();
        const fvs = scheme.freeVars();
        for (const v of fvs) freshSubst.set(v, freshTypeVar());
        return [new Map(), scheme.type.apply(freshSubst), scheme.constraints.map(c => c.apply(freshSubst))];
      }
      return [new Map(), scheme, []];
    }

    case 'lam': {
      const paramType = freshTypeVar();
      const newEnv = env.extend(expr.param, paramType);
      const [s1, bodyType, cs] = algorithmWConstrained(newEnv, expr.body, classEnv);
      return [s1, new TFun(paramType.apply(s1), bodyType), cs];
    }

    case 'app': {
      const resultType = freshTypeVar();
      const [s1, fnType, cs1] = algorithmWConstrained(env, expr.fn, classEnv);
      const [s2, argType, cs2] = algorithmWConstrained(env.apply(s1), expr.arg, classEnv);
      const s3 = unify(fnType.apply(s2), new TFun(argType, resultType));
      const allCs = [...cs1.map(c => c.apply(composeSubst(s3, s2))), ...cs2.map(c => c.apply(s3))];
      return [composeSubst(s3, composeSubst(s2, s1)), resultType.apply(s3), allCs];
    }

    case 'let': {
      const [s1, valueType, cs1] = algorithmWConstrained(env, expr.value, classEnv);
      // Reduce constraints for generalization
      const reduced = reduceConstraints(cs1.map(c => c.apply(s1)), classEnv);
      let generalizedType;
      if (reduced.length > 0) {
        // Create a qualified type scheme
        generalizedType = generalize(env.apply(s1), new TQualified(reduced, valueType));
      } else {
        generalizedType = generalize(env.apply(s1), valueType);
      }
      const newEnv = env.apply(s1).extend(expr.name, generalizedType);
      const [s2, bodyType, cs2] = algorithmWConstrained(newEnv, expr.body, classEnv);
      return [composeSubst(s2, s1), bodyType, cs2];
    }

    case 'letrec': {
      const recType = freshTypeVar();
      const newEnv = env.extend(expr.name, recType);
      const [s1, valueType, cs1] = algorithmWConstrained(newEnv, expr.value, classEnv);
      const s2 = unify(recType.apply(s1), valueType);
      const finalSubst = composeSubst(s2, s1);
      const reduced = reduceConstraints(cs1.map(c => c.apply(finalSubst)), classEnv);
      let generalizedType;
      if (reduced.length > 0) {
        generalizedType = generalize(env.apply(finalSubst), new TQualified(reduced, valueType.apply(s2)));
      } else {
        generalizedType = generalize(env.apply(finalSubst), valueType.apply(s2));
      }
      const bodyEnv = env.apply(finalSubst).extend(expr.name, generalizedType);
      const [s3, bodyType, cs2] = algorithmWConstrained(bodyEnv, expr.body, classEnv);
      return [composeSubst(s3, finalSubst), bodyType, cs2];
    }

    case 'if': {
      const [s1, condType, cs1] = algorithmWConstrained(env, expr.cond, classEnv);
      const s2 = unify(condType, tBool);
      const env1 = env.apply(composeSubst(s2, s1));
      const [s3, thenType, cs2] = algorithmWConstrained(env1, expr.then, classEnv);
      const env2 = env1.apply(s3);
      const [s4, elseType, cs3] = algorithmWConstrained(env2, expr.else, classEnv);
      const s5 = unify(thenType.apply(s4), elseType);
      const allSubst = composeSubst(s5, composeSubst(s4, composeSubst(s3, composeSubst(s2, s1))));
      return [allSubst, elseType.apply(s5), [...cs1, ...cs2, ...cs3].map(c => c.apply(allSubst))];
    }

    case 'binop': {
      const [s1, leftType, cs1] = algorithmWConstrained(env, expr.left, classEnv);
      const [s2, rightType, cs2] = algorithmWConstrained(env.apply(s1), expr.right, classEnv);

      if (expr.op === '==' || expr.op === '!=') {
        const s3 = unify(leftType.apply(s2), rightType);
        const eqConstraint = new TConstraint('Eq', rightType.apply(s3));
        return [composeSubst(s3, composeSubst(s2, s1)), tBool, [...cs1, ...cs2, eqConstraint]];
      }

      const opTypes = {
        '+': [tInt, tInt, tInt],
        '-': [tInt, tInt, tInt],
        '*': [tInt, tInt, tInt],
        '/': [tInt, tInt, tInt],
        '%': [tInt, tInt, tInt],
        '<': [tInt, tInt, tBool],
        '>': [tInt, tInt, tBool],
        '<=': [tInt, tInt, tBool],
        '>=': [tInt, tInt, tBool],
        '&&': [tBool, tBool, tBool],
        '||': [tBool, tBool, tBool],
      };

      const [expectedLeft, expectedRight, resultType] = opTypes[expr.op];
      const s3 = unify(leftType.apply(s2), expectedLeft);
      const s4 = unify(rightType.apply(s3), expectedRight);
      return [composeSubst(s4, composeSubst(s3, composeSubst(s2, s1))), resultType, [...cs1, ...cs2]];
    }

    case 'match': {
      const [s1, exprType, cs1] = algorithmWConstrained(env, expr.expr, classEnv);
      let subst = s1;
      let resultType = freshTypeVar();
      let allConstraints = [...cs1];

      for (const { pattern, body } of expr.cases) {
        const [patSubst, patType, bindings] = inferPattern(pattern, env.apply(subst));
        const s2 = unify(exprType.apply(subst).apply(patSubst), patType);
        subst = composeSubst(s2, composeSubst(patSubst, subst));

        let bodyEnv = env.apply(subst);
        for (const [name, type] of bindings) {
          bodyEnv = bodyEnv.extend(name, type.apply(subst));
        }

        const [s3, bodyType, cs] = algorithmWConstrained(bodyEnv, body, classEnv);
        const s4 = unify(resultType.apply(s3).apply(subst), bodyType);
        subst = composeSubst(s4, composeSubst(s3, subst));
        resultType = resultType.apply(subst);
        allConstraints.push(...cs.map(c => c.apply(subst)));
      }

      return [subst, resultType.apply(subst), allConstraints];
    }

    case 'record': {
      let subst = new Map();
      let row = new TRowEmpty();
      let allCs = [];
      const labels = Object.keys(expr.fields).reverse();
      for (const label of labels) {
        const [s, fieldType, cs] = algorithmWConstrained(env.apply(subst), expr.fields[label], classEnv);
        subst = composeSubst(s, subst);
        row = new TRowExtend(label, fieldType, row);
        allCs.push(...cs);
      }
      return [subst, new TRecord(row), allCs];
    }

    case 'recordAccess': {
      const [s1, recType, cs] = algorithmWConstrained(env, expr.record, classEnv);
      const fieldType = freshTypeVar();
      const restRow = freshTypeVar();
      const expectedType = new TRecord(new TRowExtend(expr.label, fieldType, restRow));
      const s2 = unify(recType.apply(s1), expectedType);
      return [composeSubst(s2, s1), fieldType.apply(s2), cs];
    }

    case 'recordExtend': {
      const [s1, recType, cs1] = algorithmWConstrained(env, expr.record, classEnv);
      const [s2, valType, cs2] = algorithmWConstrained(env.apply(s1), expr.value, classEnv);
      const restRow = freshTypeVar();
      const expectedRec = new TRecord(restRow);
      const s3 = unify(recType.apply(s2), expectedRec);
      const newRow = new TRowExtend(expr.label, valType, restRow.apply(s3));
      return [composeSubst(s3, composeSubst(s2, s1)), new TRecord(newRow), [...cs1, ...cs2]];
    }

    case 'recordRestrict': {
      const [s1, recType, cs] = algorithmWConstrained(env, expr.record, classEnv);
      const fieldType = freshTypeVar();
      const restRow = freshTypeVar();
      const expectedType = new TRecord(new TRowExtend(expr.label, fieldType, restRow));
      const s2 = unify(recType.apply(s1), expectedType);
      return [composeSubst(s2, s1), new TRecord(restRow.apply(s2)), cs];
    }

    default:
      throw new Error(`Unknown expression tag: ${expr.tag}`);
  }
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

    case 'record': {
      // { name: expr, ... }
      let subst = new Map();
      let row = new TRowEmpty();
      const labels = Object.keys(expr.fields).reverse();
      for (const label of labels) {
        const [s, fieldType] = algorithmW(env.apply(subst), expr.fields[label]);
        subst = composeSubst(s, subst);
        row = new TRowExtend(label, fieldType, row);
      }
      return [subst, new TRecord(row)];
    }

    case 'recordAccess': {
      const [s1, recType] = algorithmW(env, expr.record);
      const fieldType = freshTypeVar();
      const restRow = freshTypeVar();
      const expectedType = new TRecord(new TRowExtend(expr.label, fieldType, restRow));
      const s2 = unify(recType.apply(s1), expectedType);
      return [composeSubst(s2, s1), fieldType.apply(s2)];
    }

    case 'recordExtend': {
      const [s1, recType] = algorithmW(env, expr.record);
      const [s2, valType] = algorithmW(env.apply(s1), expr.value);
      const restRow = freshTypeVar();
      const expectedRec = new TRecord(restRow);
      const s3 = unify(recType.apply(s2), expectedRec);
      const newRow = new TRowExtend(expr.label, valType, restRow.apply(s3));
      return [composeSubst(s3, composeSubst(s2, s1)), new TRecord(newRow)];
    }

    case 'recordRestrict': {
      const [s1, recType] = algorithmW(env, expr.record);
      const fieldType = freshTypeVar();
      const restRow = freshTypeVar();
      const expectedType = new TRecord(new TRowExtend(expr.label, fieldType, restRow));
      const s2 = unify(recType.apply(s1), expectedType);
      return [composeSubst(s2, s1), new TRecord(restRow.apply(s2))];
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
