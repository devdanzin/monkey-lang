/**
 * Tiny Type Checker — Hindley-Milner type inference
 * 
 * Implements Algorithm W for type inference on a simple lambda calculus:
 * - Variables, Integers, Booleans, Strings
 * - Lambda abstraction (fn x => e)
 * - Application (f x)
 * - Let bindings (let x = e1 in e2)
 * - If-then-else
 * - Binary operators (+, -, *, /, ==, <, >, &&, ||)
 * - Recursive let (letrec)
 */

// ─── Types ──────────────────────────────────────────────

class TVar {
  constructor(name) { this.kind = 'TVar'; this.name = name; }
  toString() { return this.name; }
}

class TCon {
  constructor(name, args = []) { this.kind = 'TCon'; this.name = name; this.args = args; }
  toString() {
    if (this.args.length === 0) return this.name;
    if (this.name === '->') return `(${this.args[0]} -> ${this.args[1]})`;
    return `${this.name}<${this.args.join(', ')}>`;
  }
}

const TInt = new TCon('Int');
const TBool = new TCon('Bool');
const TString = new TCon('String');
const TUnit = new TCon('Unit');

function tFun(from, to) { return new TCon('->', [from, to]); }
function tList(t) { return new TCon('List', [t]); }
function tPair(a, b) { return new TCon('Pair', [a, b]); }

// ─── Type Scheme ────────────────────────────────────────

class Scheme {
  constructor(vars, type) { this.vars = vars; this.type = type; }
  toString() {
    if (this.vars.length === 0) return this.type.toString();
    return `forall ${this.vars.join(' ')}. ${this.type}`;
  }
}

// ─── Substitution ───────────────────────────────────────

class Subst {
  constructor(map = new Map()) { this.map = map; }

  apply(type) {
    if (type.kind === 'TVar') {
      const t = this.map.get(type.name);
      return t ? this.apply(t) : type;
    }
    if (type.kind === 'TCon') {
      return new TCon(type.name, type.args.map(a => this.apply(a)));
    }
    return type;
  }

  applyScheme(scheme) {
    const filtered = new Subst(new Map([...this.map].filter(([k]) => !scheme.vars.includes(k))));
    return new Scheme(scheme.vars, filtered.apply(scheme.type));
  }

  applyEnv(env) {
    const result = new Map();
    for (const [k, v] of env) {
      result.set(k, this.applyScheme(v));
    }
    return result;
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

  static empty() { return new Subst(); }
  static single(name, type) { return new Subst(new Map([[name, type]])); }
}

// ─── Free Type Variables ────────────────────────────────

function ftv(type) {
  if (type.kind === 'TVar') return new Set([type.name]);
  if (type.kind === 'TCon') {
    const s = new Set();
    for (const a of type.args) for (const v of ftv(a)) s.add(v);
    return s;
  }
  return new Set();
}

function ftvScheme(scheme) {
  const s = ftv(scheme.type);
  for (const v of scheme.vars) s.delete(v);
  return s;
}

function ftvEnv(env) {
  const s = new Set();
  for (const scheme of env.values()) {
    for (const v of ftvScheme(scheme)) s.add(v);
  }
  return s;
}

// ─── Unification ────────────────────────────────────────

function occursIn(name, type) {
  return ftv(type).has(name);
}

function unify(t1, t2) {
  t1 = resolve(t1); t2 = resolve(t2);

  if (t1.kind === 'TVar' && t2.kind === 'TVar' && t1.name === t2.name) {
    return Subst.empty();
  }
  if (t1.kind === 'TVar') {
    if (occursIn(t1.name, t2)) throw new TypeError(`Infinite type: ${t1.name} ~ ${t2}`);
    return Subst.single(t1.name, t2);
  }
  if (t2.kind === 'TVar') {
    if (occursIn(t2.name, t1)) throw new TypeError(`Infinite type: ${t2.name} ~ ${t1}`);
    return Subst.single(t2.name, t1);
  }
  if (t1.kind === 'TCon' && t2.kind === 'TCon') {
    if (t1.name !== t2.name || t1.args.length !== t2.args.length) {
      throw new TypeError(`Cannot unify ${t1} with ${t2}`);
    }
    let s = Subst.empty();
    for (let i = 0; i < t1.args.length; i++) {
      const s2 = unify(s.apply(t1.args[i]), s.apply(t2.args[i]));
      s = s2.compose(s);
    }
    return s;
  }
  throw new TypeError(`Cannot unify ${t1} with ${t2}`);
}

function resolve(type) { return type; }

// ─── Fresh Variables ────────────────────────────────────

let freshCounter = 0;
function resetFresh() { freshCounter = 0; }
function freshVar() { return new TVar(`t${freshCounter++}`); }

// ─── Generalize / Instantiate ───────────────────────────

function generalize(env, type) {
  const envFtv = ftvEnv(env);
  const vars = [...ftv(type)].filter(v => !envFtv.has(v));
  return new Scheme(vars, type);
}

function instantiate(scheme) {
  const subst = new Map();
  for (const v of scheme.vars) {
    subst.set(v, freshVar());
  }
  const s = new Subst(subst);
  return s.apply(scheme.type);
}

// ─── AST Nodes ──────────────────────────────────────────

const Expr = {
  Var: (name) => ({ tag: 'Var', name }),
  Int: (value) => ({ tag: 'Int', value }),
  Bool: (value) => ({ tag: 'Bool', value }),
  Str: (value) => ({ tag: 'Str', value }),
  Lam: (param, body) => ({ tag: 'Lam', param, body }),
  App: (fn, arg) => ({ tag: 'App', fn, arg }),
  Let: (name, value, body) => ({ tag: 'Let', name, value, body }),
  LetRec: (name, value, body) => ({ tag: 'LetRec', name, value, body }),
  If: (cond, then, else_) => ({ tag: 'If', cond, then, else: else_ }),
  BinOp: (op, left, right) => ({ tag: 'BinOp', op, left, right }),
  Unit: () => ({ tag: 'Unit' }),
  List: (items) => ({ tag: 'List', items }),
  Pair: (fst, snd) => ({ tag: 'Pair', fst, snd }),
  Ann: (expr, type) => ({ tag: 'Ann', expr, type }),
};

// ─── Algorithm W ────────────────────────────────────────

function infer(env, expr) {
  switch (expr.tag) {
    case 'Int': return [Subst.empty(), TInt];
    case 'Bool': return [Subst.empty(), TBool];
    case 'Str': return [Subst.empty(), TString];
    case 'Unit': return [Subst.empty(), TUnit];

    case 'Var': {
      const scheme = env.get(expr.name);
      if (!scheme) throw new TypeError(`Unbound variable: ${expr.name}`);
      return [Subst.empty(), instantiate(scheme)];
    }

    case 'Lam': {
      const tv = freshVar();
      const newEnv = new Map(env);
      newEnv.set(expr.param, new Scheme([], tv));
      const [s1, t1] = infer(newEnv, expr.body);
      return [s1, tFun(s1.apply(tv), t1)];
    }

    case 'App': {
      const tv = freshVar();
      const [s1, t1] = infer(env, expr.fn);
      const [s2, t2] = infer(s1.applyEnv(env), expr.arg);
      const s3 = unify(s2.apply(t1), tFun(t2, tv));
      return [s3.compose(s2).compose(s1), s3.apply(tv)];
    }

    case 'Let': {
      const [s1, t1] = infer(env, expr.value);
      const env1 = s1.applyEnv(env);
      const scheme = generalize(env1, t1);
      const newEnv = new Map(env1);
      newEnv.set(expr.name, scheme);
      const [s2, t2] = infer(newEnv, expr.body);
      return [s2.compose(s1), t2];
    }

    case 'LetRec': {
      const tv = freshVar();
      const newEnv = new Map(env);
      newEnv.set(expr.name, new Scheme([], tv));
      const [s1, t1] = infer(newEnv, expr.value);
      const s2 = unify(s1.apply(tv), t1);
      const s = s2.compose(s1);
      const env1 = s.applyEnv(env);
      const scheme = generalize(env1, s.apply(tv));
      const env2 = new Map(env1);
      env2.set(expr.name, scheme);
      const [s3, t2] = infer(env2, expr.body);
      return [s3.compose(s), t2];
    }

    case 'If': {
      const [s1, t1] = infer(env, expr.cond);
      const s1u = unify(t1, TBool);
      const s = s1u.compose(s1);
      const [s2, t2] = infer(s.applyEnv(env), expr.then);
      const s2c = s2.compose(s);
      const [s3, t3] = infer(s2c.applyEnv(env), expr.else);
      const s3c = s3.compose(s2c);
      const s4 = unify(s3c.apply(t2), t3);
      return [s4.compose(s3c), s4.apply(t3)];
    }

    case 'BinOp': {
      const [s1, t1] = infer(env, expr.left);
      const [s2, t2] = infer(s1.applyEnv(env), expr.right);
      const s = s2.compose(s1);

      const arith = ['+', '-', '*', '/'];
      const comp = ['==', '!=', '<', '>', '<=', '>='];
      const logic = ['&&', '||'];

      if (arith.includes(expr.op)) {
        const s3 = unify(s.apply(t1), TInt);
        const s4 = unify(s3.apply(t2), TInt);
        return [s4.compose(s3).compose(s), TInt];
      }
      if (comp.includes(expr.op)) {
        const s3 = unify(s.apply(t1), s.apply(t2));
        return [s3.compose(s), TBool];
      }
      if (logic.includes(expr.op)) {
        const s3 = unify(s.apply(t1), TBool);
        const s4 = unify(s3.apply(t2), TBool);
        return [s4.compose(s3).compose(s), TBool];
      }
      throw new TypeError(`Unknown operator: ${expr.op}`);
    }

    case 'List': {
      if (expr.items.length === 0) {
        return [Subst.empty(), tList(freshVar())];
      }
      let s = Subst.empty();
      let itemType = null;
      for (const item of expr.items) {
        const [si, ti] = infer(s.applyEnv(env), item);
        s = si.compose(s);
        if (itemType === null) {
          itemType = ti;
        } else {
          const su = unify(s.apply(itemType), ti);
          s = su.compose(s);
          itemType = su.apply(ti);
        }
      }
      return [s, tList(s.apply(itemType))];
    }

    case 'Pair': {
      const [s1, t1] = infer(env, expr.fst);
      const [s2, t2] = infer(s1.applyEnv(env), expr.snd);
      return [s2.compose(s1), tPair(s2.apply(t1), t2)];
    }

    case 'Ann': {
      const [s1, t1] = infer(env, expr.expr);
      const s2 = unify(t1, expr.type);
      return [s2.compose(s1), s2.apply(t1)];
    }

    default:
      throw new TypeError(`Unknown expression: ${expr.tag}`);
  }
}

// ─── Top-level Inference ────────────────────────────────

function typeOf(expr, env = null) {
  resetFresh();
  const defaultEnv = env || new Map([
    ['add', new Scheme(['a'], tFun(TInt, tFun(TInt, TInt)))],
    ['not', new Scheme([], tFun(TBool, TBool))],
    ['head', new Scheme(['a'], tFun(tList(new TVar('a')), new TVar('a')))],
    ['tail', new Scheme(['a'], tFun(tList(new TVar('a')), tList(new TVar('a'))))],
    ['cons', new Scheme(['a'], tFun(new TVar('a'), tFun(tList(new TVar('a')), tList(new TVar('a')))))],
    ['fst', new Scheme(['a', 'b'], tFun(tPair(new TVar('a'), new TVar('b')), new TVar('a')))],
    ['snd', new Scheme(['a', 'b'], tFun(tPair(new TVar('a'), new TVar('b')), new TVar('b')))],
  ]);
  const [subst, type] = infer(defaultEnv, expr);
  return subst.apply(type);
}

// ─── Simple Parser ──────────────────────────────────────

function parse(src) {
  let pos = 0;
  const ws = () => { while (pos < src.length && /\s/.test(src[pos])) pos++; };
  const peek = () => { ws(); return src[pos]; };
  const expect = (ch) => { ws(); if (src[pos] !== ch) throw new SyntaxError(`Expected '${ch}' at ${pos}`); pos++; };
  const word = () => {
    ws();
    let s = '';
    while (pos < src.length && /[a-zA-Z0-9_]/.test(src[pos])) s += src[pos++];
    return s;
  };
  const num = () => {
    ws();
    let s = '';
    if (src[pos] === '-') s += src[pos++];
    while (pos < src.length && /[0-9]/.test(src[pos])) s += src[pos++];
    return parseInt(s, 10);
  };

  function parseExpr() {
    ws();
    if (src.startsWith('fn ', pos)) return parseLam();
    if (src.startsWith('let ', pos)) return parseLet();
    if (src.startsWith('letrec ', pos)) return parseLetRec();
    if (src.startsWith('if ', pos)) return parseIf();
    return parseBinOp();
  }

  function parseLam() {
    pos += 3;
    const param = word();
    expect('='); expect('>');
    const body = parseExpr();
    return Expr.Lam(param, body);
  }

  function parseLet() {
    pos += 4;
    const name = word();
    expect('=');
    const value = parseExpr();
    ws(); pos += 2; // 'in'
    const body = parseExpr();
    return Expr.Let(name, value, body);
  }

  function parseLetRec() {
    pos += 7;
    const name = word();
    expect('=');
    const value = parseExpr();
    ws(); pos += 2;
    const body = parseExpr();
    return Expr.LetRec(name, value, body);
  }

  function parseIf() {
    pos += 3;
    const cond = parseExpr();
    ws(); pos += 4; // 'then'
    const then = parseExpr();
    ws(); pos += 4; // 'else'
    const else_ = parseExpr();
    return Expr.If(cond, then, else_);
  }

  function parseBinOp() {
    let left = parseApp();
    while (true) {
      ws();
      let op = null;
      for (const o of ['==', '!=', '<=', '>=', '&&', '||', '+', '-', '*', '/', '<', '>']) {
        if (src.startsWith(o, pos)) { op = o; break; }
      }
      if (!op) break;
      pos += op.length;
      const right = parseApp();
      left = Expr.BinOp(op, left, right);
    }
    return left;
  }

  function parseApp() {
    let fn = parseAtom();
    while (peek() && peek() !== ')' && !src.startsWith('then', pos) && !src.startsWith('else', pos) && !src.startsWith('in', pos) && !/[+\-*/<>=!&|]/.test(peek())) {
      ws();
      if (!peek() || peek() === ')') break;
      const arg = parseAtom();
      fn = Expr.App(fn, arg);
    }
    return fn;
  }

  function parseAtom() {
    ws();
    if (src[pos] === '(') {
      pos++;
      const e = parseExpr();
      expect(')');
      return e;
    }
    if (src[pos] === '"') {
      pos++;
      let s = '';
      while (src[pos] !== '"') s += src[pos++];
      pos++;
      return Expr.Str(s);
    }
    if (/[0-9]/.test(src[pos]) || (src[pos] === '-' && /[0-9]/.test(src[pos + 1]))) {
      return Expr.Int(num());
    }
    const w = word();
    if (w === 'true') return Expr.Bool(true);
    if (w === 'false') return Expr.Bool(false);
    if (!w) throw new SyntaxError(`Unexpected char at ${pos}: ${src[pos]}`);
    return Expr.Var(w);
  }

  const result = parseExpr();
  return result;
}

function typeCheck(src) {
  const ast = parse(src);
  return typeOf(ast).toString();
}

module.exports = {
  TVar, TCon, Scheme, Subst, Expr,
  TInt, TBool, TString, TUnit,
  tFun, tList, tPair,
  ftv, ftvScheme, ftvEnv,
  unify, generalize, instantiate,
  infer, typeOf, typeCheck,
  parse, resetFresh, freshVar,
};
