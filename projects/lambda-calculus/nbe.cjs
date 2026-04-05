// Normalization by Evaluation (NbE)
//
// A technique for normalizing lambda terms by:
// 1. Evaluating into a semantic domain (JS functions)
// 2. Reading back (quoting) the semantic values into normal forms
//
// Handles open terms (with free variables) via neutral terms.
// Produces β-normal η-long forms.

// ============================================================
// Syntax (Lambda Terms)
// ============================================================

class Var { constructor(name) { this.kind = 'var'; this.name = name; } }
class Lam { constructor(param, body) { this.kind = 'lam'; this.param = param; this.body = body; } }
class App { constructor(fn, arg) { this.kind = 'app'; this.fn = fn; this.arg = arg; } }

function prettyPrint(e) {
  switch (e.kind) {
    case 'var': return e.name;
    case 'lam': {
      const params = [];
      let body = e;
      while (body.kind === 'lam') { params.push(body.param); body = body.body; }
      return `λ${params.join(' ')}.${prettyPrint(body)}`;
    }
    case 'app': {
      const fn = e.fn.kind === 'lam' ? `(${prettyPrint(e.fn)})` : prettyPrint(e.fn);
      const arg = e.arg.kind === 'app' || e.arg.kind === 'lam' ? `(${prettyPrint(e.arg)})` : prettyPrint(e.arg);
      return `${fn} ${arg}`;
    }
  }
}

// ============================================================
// Semantic Domain
// ============================================================

// Values in the semantic domain:
// - VLam: a JS function from Value → Value
// - VNeutral: a stuck computation (free variable applied to args)

class VLam {
  constructor(fn) { this.tag = 'vlam'; this.fn = fn; }
}

class VNeutral {
  constructor(neutral) { this.tag = 'vneutral'; this.neutral = neutral; }
}

// Neutral terms: computations that can't reduce further
// - NVar: a free variable
// - NApp: a neutral applied to a normal form

class NVar { constructor(name) { this.tag = 'nvar'; this.name = name; } }
class NApp { constructor(fn, arg) { this.tag = 'napp'; this.fn = fn; this.arg = arg; } }

// ============================================================
// Evaluation (Syntax → Semantic Domain)
// ============================================================

function evaluate(expr, env = new Map()) {
  switch (expr.kind) {
    case 'var': {
      if (env.has(expr.name)) return env.get(expr.name);
      // Free variable → neutral
      return new VNeutral(new NVar(expr.name));
    }
    case 'lam': {
      return new VLam(arg => {
        const newEnv = new Map(env);
        newEnv.set(expr.param, arg);
        return evaluate(expr.body, newEnv);
      });
    }
    case 'app': {
      const fn = evaluate(expr.fn, env);
      const arg = evaluate(expr.arg, env);
      return doApp(fn, arg);
    }
  }
}

function doApp(fn, arg) {
  if (fn.tag === 'vlam') return fn.fn(arg);
  if (fn.tag === 'vneutral') return new VNeutral(new NApp(fn.neutral, arg));
  throw new Error('Cannot apply non-function');
}

// ============================================================
// Readback (Semantic Domain → Syntax)
// ============================================================

let readbackCounter = 0;
function freshName(base = 'x') { return `${base}${++readbackCounter}`; }
function resetReadback() { readbackCounter = 0; }

// Quote a semantic value back to syntax
function readback(val) {
  if (val.tag === 'vlam') {
    const name = freshName();
    const argVal = new VNeutral(new NVar(name));
    const bodyVal = val.fn(argVal);
    return new Lam(name, readback(bodyVal));
  }
  if (val.tag === 'vneutral') {
    return readbackNeutral(val.neutral);
  }
  throw new Error(`Unknown value tag: ${val.tag}`);
}

function readbackNeutral(neutral) {
  if (neutral.tag === 'nvar') return new Var(neutral.name);
  if (neutral.tag === 'napp') {
    return new App(readbackNeutral(neutral.fn), readback(neutral.arg));
  }
  throw new Error(`Unknown neutral tag: ${neutral.tag}`);
}

// ============================================================
// Normalize: evaluate then readback
// ============================================================

function normalize(expr) {
  resetReadback();
  const val = evaluate(expr);
  return readback(val);
}

// ============================================================
// Convenience: parse simple lambda syntax
// ============================================================

function parse(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if ('().\\/λ'.includes(ch)) { tokens.push(ch === '\\' ? 'λ' : ch); i++; continue; }
    let id = '';
    while (i < src.length && /[a-zA-Z0-9_']/.test(src[i])) { id += src[i++]; }
    if (id) tokens.push(id);
  }
  let pos = 0;
  function peek() { return tokens[pos]; }
  function consume(e) { if (e && tokens[pos] !== e) throw new Error(`Expected ${e}`); return tokens[pos++]; }
  function parseExpr() {
    let node = parseAtom();
    while (pos < tokens.length && peek() !== ')') node = new App(node, parseAtom());
    return node;
  }
  function parseAtom() {
    if (peek() === 'λ') {
      consume('λ');
      const params = [];
      while (peek() !== '.') params.push(consume());
      consume('.');
      let body = parseExpr();
      for (let i = params.length - 1; i >= 0; i--) body = new Lam(params[i], body);
      return body;
    }
    if (peek() === '(') { consume('('); const e = parseExpr(); consume(')'); return e; }
    return new Var(consume());
  }
  const r = parseExpr();
  return r;
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  Var, Lam, App, prettyPrint, parse,
  VLam, VNeutral, NVar, NApp,
  evaluate, doApp, readback, readbackNeutral,
  normalize, resetReadback,
};
