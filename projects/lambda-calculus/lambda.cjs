// Lambda Calculus Interpreter
// Pure untyped lambda calculus with multiple reduction strategies

// ============================================================
// AST
// ============================================================

class Var {
  constructor(name) { this.type = 'var'; this.name = name; }
}

class Abs {
  constructor(param, body) { this.type = 'abs'; this.param = param; this.body = body; }
}

class App {
  constructor(fn, arg) { this.type = 'app'; this.fn = fn; this.arg = arg; }
}

// ============================================================
// Parser — λx.body or \x.body, application by juxtaposition
// ============================================================

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '(' || ch === ')' || ch === '.' || ch === '\\' || ch === 'λ') {
      tokens.push(ch === '\\' ? 'λ' : ch);
      i++;
      continue;
    }
    // identifier
    let id = '';
    while (i < src.length && /[a-zA-Z0-9_']/.test(src[i])) { id += src[i++]; }
    if (id) tokens.push(id);
    else throw new Error(`Unexpected character: ${ch}`);
  }
  return tokens;
}

function parse(src) {
  const tokens = tokenize(src);
  let pos = 0;

  function peek() { return tokens[pos]; }
  function consume(expected) {
    if (expected && tokens[pos] !== expected) throw new Error(`Expected ${expected}, got ${tokens[pos]}`);
    return tokens[pos++];
  }

  function parseExpr() {
    // Application: left-associative sequence of atoms
    let node = parseAtom();
    while (pos < tokens.length && peek() !== ')' && peek() !== undefined) {
      const next = parseAtom();
      node = new App(node, next);
    }
    return node;
  }

  function parseAtom() {
    const tok = peek();
    if (tok === 'λ') {
      consume('λ');
      const params = [];
      while (peek() !== '.') params.push(consume());
      consume('.');
      const body = parseExpr();
      // Curry multiple params: λx y.body → λx.λy.body
      let result = body;
      for (let i = params.length - 1; i >= 0; i--) {
        result = new Abs(params[i], result);
      }
      return result;
    }
    if (tok === '(') {
      consume('(');
      const expr = parseExpr();
      consume(')');
      return expr;
    }
    // Variable
    return new Var(consume());
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error(`Unexpected token: ${tokens[pos]}`);
  return result;
}

// ============================================================
// Pretty Printer
// ============================================================

function prettyPrint(node) {
  switch (node.type) {
    case 'var': return node.name;
    case 'abs': {
      // Collect consecutive abstractions
      const params = [];
      let body = node;
      while (body.type === 'abs') {
        params.push(body.param);
        body = body.body;
      }
      return `λ${params.join(' ')}.${prettyPrint(body)}`;
    }
    case 'app': {
      const fnStr = node.fn.type === 'abs' ? `(${prettyPrint(node.fn)})` : prettyPrint(node.fn);
      const argStr = node.arg.type === 'app' || node.arg.type === 'abs'
        ? `(${prettyPrint(node.arg)})`
        : prettyPrint(node.arg);
      return `${fnStr} ${argStr}`;
    }
  }
}

// ============================================================
// Free Variables
// ============================================================

function freeVars(node, bound = new Set()) {
  switch (node.type) {
    case 'var': return bound.has(node.name) ? new Set() : new Set([node.name]);
    case 'abs': {
      const newBound = new Set(bound);
      newBound.add(node.param);
      return freeVars(node.body, newBound);
    }
    case 'app': {
      const s = freeVars(node.fn, bound);
      for (const v of freeVars(node.arg, bound)) s.add(v);
      return s;
    }
  }
}

// ============================================================
// Alpha Conversion (rename bound variable)
// ============================================================

let freshCounter = 0;
function freshVar(base) {
  return `${base}'${++freshCounter}`;
}

function resetFreshCounter() { freshCounter = 0; }

function alphaConvert(node, oldName, newName) {
  switch (node.type) {
    case 'var': return node.name === oldName ? new Var(newName) : node;
    case 'abs':
      if (node.param === oldName) return node; // shadowed
      return new Abs(node.param, alphaConvert(node.body, oldName, newName));
    case 'app':
      return new App(alphaConvert(node.fn, oldName, newName), alphaConvert(node.arg, oldName, newName));
  }
}

// ============================================================
// Substitution: node[name := replacement]
// Capture-avoiding
// ============================================================

function substitute(node, name, replacement) {
  switch (node.type) {
    case 'var':
      return node.name === name ? replacement : node;
    case 'abs': {
      if (node.param === name) return node; // shadowed
      const fvRep = freeVars(replacement);
      if (fvRep.has(node.param)) {
        // Capture would occur — alpha-convert
        const newParam = freshVar(node.param);
        const renamedBody = alphaConvert(node.body, node.param, newParam);
        return new Abs(newParam, substitute(renamedBody, name, replacement));
      }
      return new Abs(node.param, substitute(node.body, name, replacement));
    }
    case 'app':
      return new App(substitute(node.fn, name, replacement), substitute(node.arg, name, replacement));
  }
}

// ============================================================
// Reduction Strategies
// ============================================================

// Beta reduce one step — returns null if no redex found

// Normal order: leftmost, outermost redex first
function normalOrderStep(node) {
  if (node.type === 'app' && node.fn.type === 'abs') {
    // Beta redex found
    return substitute(node.fn.body, node.fn.param, node.arg);
  }
  if (node.type === 'app') {
    const fnReduced = normalOrderStep(node.fn);
    if (fnReduced) return new App(fnReduced, node.arg);
    const argReduced = normalOrderStep(node.arg);
    if (argReduced) return new App(node.fn, argReduced);
    return null;
  }
  if (node.type === 'abs') {
    const bodyReduced = normalOrderStep(node.body);
    if (bodyReduced) return new Abs(node.param, bodyReduced);
    return null;
  }
  return null;
}

// Applicative order: leftmost, innermost redex first (evaluate args first)
function applicativeOrderStep(node) {
  if (node.type === 'app') {
    // First try reducing inside fn
    const fnReduced = applicativeOrderStep(node.fn);
    if (fnReduced) return new App(fnReduced, node.arg);
    // Then try reducing inside arg
    const argReduced = applicativeOrderStep(node.arg);
    if (argReduced) return new App(node.fn, argReduced);
    // Now try beta reduction at top
    if (node.fn.type === 'abs') {
      return substitute(node.fn.body, node.fn.param, node.arg);
    }
    return null;
  }
  if (node.type === 'abs') {
    const bodyReduced = applicativeOrderStep(node.body);
    if (bodyReduced) return new Abs(node.param, bodyReduced);
    return null;
  }
  return null;
}

// Call-by-value: only reduce when argument is a value (variable or abstraction)
function callByValueStep(node) {
  if (node.type === 'app') {
    // Reduce fn first
    const fnReduced = callByValueStep(node.fn);
    if (fnReduced) return new App(fnReduced, node.arg);
    // Then reduce arg
    const argReduced = callByValueStep(node.arg);
    if (argReduced) return new App(node.fn, argReduced);
    // Beta only if arg is a value
    if (node.fn.type === 'abs' && (node.arg.type === 'var' || node.arg.type === 'abs')) {
      return substitute(node.fn.body, node.fn.param, node.arg);
    }
    return null;
  }
  // Don't reduce under abstractions in CBV
  return null;
}

// Multi-step reduction with limit
function reduce(node, strategy = 'normal', maxSteps = 1000) {
  const stepFn = strategy === 'normal' ? normalOrderStep
    : strategy === 'applicative' ? applicativeOrderStep
    : callByValueStep;
  
  let current = node;
  let steps = 0;
  const trace = [current];
  
  while (steps < maxSteps) {
    const next = stepFn(current);
    if (!next) break;
    current = next;
    trace.push(current);
    steps++;
  }
  
  return { result: current, steps, trace, normalForm: steps < maxSteps };
}

// ============================================================
// Church Encodings
// ============================================================

const church = {
  // Booleans
  true: parse('λt f.t'),
  false: parse('λt f.f'),
  and: parse('λp q.p q p'),
  or: parse('λp q.p p q'),
  not: parse('λp.p (λt f.f) (λt f.t)'),
  if: parse('λp a b.p a b'),

  // Numbers
  zero: parse('λf x.x'),
  one: parse('λf x.f x'),
  two: parse('λf x.f (f x)'),
  three: parse('λf x.f (f (f x))'),
  succ: parse('λn f x.f (n f x)'),
  plus: parse('λm n f x.m f (n f x)'),
  mult: parse('λm n f.m (n f)'),
  pow: parse('λb e.e b'),
  pred: parse('λn f x.n (λg h.h (g f)) (λu.x) (λu.u)'),
  isZero: parse('λn.n (λx.λt f.f) (λt f.t)'),

  // Pairs
  pair: parse('λa b f.f a b'),
  fst: parse('λp.p (λa b.a)'),
  snd: parse('λp.p (λa b.b)'),

  // Convert Church numeral to JS number
  toNumber(node) {
    // Apply to (+1) and 0
    const f = new Var('__f');
    const x = new Var('__x');
    const applied = new App(new App(node, f), x);
    const { result } = reduce(applied, 'normal', 1000);
    // Count applications of __f
    let count = 0;
    let cur = result;
    while (cur.type === 'app' && cur.fn.type === 'var' && cur.fn.name === '__f') {
      count++;
      cur = cur.arg;
    }
    return count;
  },

  // Convert JS number to Church numeral
  fromNumber(n) {
    if (n === 0) return parse('λf x.x');
    let body = new Var('x');
    for (let i = 0; i < n; i++) body = new App(new Var('f'), body);
    return new Abs('f', new Abs('x', body));
  },

  // Convert Church boolean to JS boolean  
  toBool(node) {
    const t = new Var('__true');
    const f = new Var('__false');
    const applied = new App(new App(node, t), f);
    const { result } = reduce(applied, 'normal', 1000);
    return result.type === 'var' && result.name === '__true';
  }
};

// ============================================================
// De Bruijn Indices
// ============================================================

class DeBruijnVar { constructor(index) { this.type = 'dbvar'; this.index = index; } }
class DeBruijnAbs { constructor(body) { this.type = 'dbabs'; this.body = body; } }
class DeBruijnApp { constructor(fn, arg) { this.type = 'dbapp'; this.fn = fn; this.arg = arg; } }

function toDeBruijn(node, env = []) {
  switch (node.type) {
    case 'var': {
      const idx = env.indexOf(node.name);
      if (idx === -1) return new DeBruijnVar(node.name); // free variable as name
      return new DeBruijnVar(idx);
    }
    case 'abs':
      return new DeBruijnAbs(toDeBruijn(node.body, [node.param, ...env]));
    case 'app':
      return new DeBruijnApp(toDeBruijn(node.fn, env), toDeBruijn(node.arg, env));
  }
}

function deBruijnToString(node) {
  switch (node.type) {
    case 'dbvar': return typeof node.index === 'number' ? String(node.index) : node.name;
    case 'dbabs': return `λ.${deBruijnToString(node.body)}`;
    case 'dbapp': {
      const fnStr = node.fn.type === 'dbabs' ? `(${deBruijnToString(node.fn)})` : deBruijnToString(node.fn);
      const argStr = node.arg.type === 'dbapp' || node.arg.type === 'dbabs'
        ? `(${deBruijnToString(node.arg)})`
        : deBruijnToString(node.arg);
      return `${fnStr} ${argStr}`;
    }
  }
}

// ============================================================
// SKI Combinators
// ============================================================

const combinators = {
  S: parse('λx y z.x z (y z)'),
  K: parse('λx y.x'),
  I: parse('λx.x'),
  B: parse('λf g x.f (g x)'),   // composition
  C: parse('λf x y.f y x'),      // flip
  W: parse('λf x.f x x'),        // duplicate
  Y: parse('λf.(λx.f (x x)) (λx.f (x x))'), // Y combinator (fixed point)
  omega: parse('(λx.x x) (λx.x x)'),  // Ω — diverges
};

// ============================================================
// Alpha Equivalence
// ============================================================

function alphaEquivalent(a, b) {
  const da = toDeBruijn(a);
  const db = toDeBruijn(b);
  return deBruijnEqual(da, db);
}

function deBruijnEqual(a, b) {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'dbvar': return a.index === b.index;
    case 'dbabs': return deBruijnEqual(a.body, b.body);
    case 'dbapp': return deBruijnEqual(a.fn, b.fn) && deBruijnEqual(a.arg, b.arg);
  }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  // AST
  Var, Abs, App,
  // Parser
  parse, tokenize,
  // Pretty printer
  prettyPrint,
  // Free variables
  freeVars,
  // Alpha conversion
  alphaConvert, alphaEquivalent, freshVar, resetFreshCounter,
  // Substitution
  substitute,
  // Reduction
  normalOrderStep, applicativeOrderStep, callByValueStep,
  reduce,
  // Church encodings
  church,
  // De Bruijn
  DeBruijnVar, DeBruijnAbs, DeBruijnApp,
  toDeBruijn, deBruijnToString,
  // Combinators
  combinators,
};
