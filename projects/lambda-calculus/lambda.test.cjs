const { test, run } = require('./test-runner.cjs');
const {
  Var, Abs, App,
  parse, prettyPrint,
  freeVars, alphaConvert, alphaEquivalent, resetFreshCounter,
  substitute,
  normalOrderStep, applicativeOrderStep, callByValueStep,
  reduce,
  church,
  toDeBruijn, deBruijnToString,
  combinators,
} = require('./lambda.cjs');

// ============================================================
// Parser
// ============================================================

test('parse variable', () => {
  const node = parse('x');
  if (node.type !== 'var' || node.name !== 'x') throw new Error('Expected Var x');
});

test('parse abstraction', () => {
  const node = parse('λx.x');
  if (node.type !== 'abs' || node.param !== 'x') throw new Error('Expected Abs');
  if (node.body.type !== 'var' || node.body.name !== 'x') throw new Error('Expected body = x');
});

test('parse backslash as lambda', () => {
  const node = parse('\\x.x');
  if (node.type !== 'abs' || node.param !== 'x') throw new Error('Expected Abs');
});

test('parse application', () => {
  const node = parse('x y');
  if (node.type !== 'app') throw new Error('Expected App');
  if (node.fn.name !== 'x' || node.arg.name !== 'y') throw new Error('Bad app');
});

test('parse left-associative application', () => {
  const node = parse('x y z');
  if (node.type !== 'app' || node.fn.type !== 'app') throw new Error('Expected left-assoc');
  if (node.fn.fn.name !== 'x' || node.fn.arg.name !== 'y' || node.arg.name !== 'z') throw new Error('Bad assoc');
});

test('parse multi-param lambda', () => {
  // λx y.x should become λx.λy.x
  const node = parse('λx y.x');
  if (node.type !== 'abs' || node.param !== 'x') throw new Error('Outer abs');
  if (node.body.type !== 'abs' || node.body.param !== 'y') throw new Error('Inner abs');
  if (node.body.body.name !== 'x') throw new Error('Body');
});

test('parse parenthesized', () => {
  const node = parse('(λx.x) y');
  if (node.type !== 'app') throw new Error('Expected App');
  if (node.fn.type !== 'abs') throw new Error('Expected Abs in fn');
});

// ============================================================
// Pretty Printer
// ============================================================

test('pretty print identity', () => {
  const s = prettyPrint(parse('λx.x'));
  if (s !== 'λx.x') throw new Error(`Expected λx.x, got ${s}`);
});

test('pretty print application', () => {
  const s = prettyPrint(parse('(λx.x) y'));
  if (s !== '(λx.x) y') throw new Error(`Expected (λx.x) y, got ${s}`);
});

test('pretty print multi-param', () => {
  const s = prettyPrint(parse('λx y.x'));
  if (s !== 'λx y.x') throw new Error(`Expected λx y.x, got ${s}`);
});

// ============================================================
// Free Variables
// ============================================================

test('free vars — no free', () => {
  const fv = freeVars(parse('λx.x'));
  if (fv.size !== 0) throw new Error('Expected no free vars');
});

test('free vars — one free', () => {
  const fv = freeVars(parse('λx.y'));
  if (!fv.has('y') || fv.size !== 1) throw new Error('Expected {y}');
});

test('free vars — mixed', () => {
  const fv = freeVars(parse('λx.x y'));
  if (!fv.has('y') || fv.size !== 1) throw new Error('Expected {y}');
});

// ============================================================
// Substitution
// ============================================================

test('substitute simple', () => {
  const result = substitute(parse('x'), 'x', parse('y'));
  if (result.name !== 'y') throw new Error('Expected y');
});

test('substitute avoids capture', () => {
  resetFreshCounter();
  // (λy.x)[x := y] should alpha-convert to avoid capture
  const result = substitute(parse('λy.x'), 'x', new Var('y'));
  // result should be λy'.y (where y' is fresh)
  if (result.type !== 'abs') throw new Error('Expected abs');
  if (result.param === 'y') throw new Error('Should have renamed to avoid capture');
  if (result.body.name !== 'y') throw new Error('Body should be y (the substituted value)');
});

test('substitute shadowed', () => {
  // (λx.x)[x := y] — shadowed, no change
  const result = substitute(parse('λx.x'), 'x', new Var('y'));
  if (result.body.name !== 'x') throw new Error('Shadowed, should be unchanged');
});

// ============================================================
// Alpha Equivalence
// ============================================================

test('alpha equivalence — identical', () => {
  if (!alphaEquivalent(parse('λx.x'), parse('λx.x'))) throw new Error('Should be equivalent');
});

test('alpha equivalence — renamed', () => {
  if (!alphaEquivalent(parse('λx.x'), parse('λy.y'))) throw new Error('Should be alpha-equivalent');
});

test('alpha equivalence — not equivalent', () => {
  if (alphaEquivalent(parse('λx.x'), parse('λx.y'))) throw new Error('Should not be equivalent');
});

// ============================================================
// Normal Order Reduction
// ============================================================

test('beta reduction — identity', () => {
  const { result } = reduce(parse('(λx.x) y'), 'normal');
  if (result.name !== 'y') throw new Error(`Expected y, got ${prettyPrint(result)}`);
});

test('beta reduction — K combinator', () => {
  const { result } = reduce(parse('(λx y.x) a b'), 'normal');
  if (result.name !== 'a') throw new Error(`Expected a, got ${prettyPrint(result)}`);
});

test('normal order — outermost first', () => {
  // (λx.λy.x) ((λz.z) a) should reduce outermost first
  const step = normalOrderStep(parse('(λx.λy.x) ((λz.z) a)'));
  // Should substitute arg as-is, not reduce it first
  if (step.type !== 'abs') throw new Error('Expected abs after outer beta');
});

test('normal order finds normal form', () => {
  const { result, normalForm } = reduce(parse('(λx y.x) a b'), 'normal');
  if (!normalForm) throw new Error('Should reach normal form');
  if (result.name !== 'a') throw new Error(`Expected a`);
});

// ============================================================
// Applicative Order
// ============================================================

test('applicative order — reduces arg first', () => {
  const step = applicativeOrderStep(parse('(λx.x) ((λy.y) z)'));
  // Should reduce inner (λy.y) z → z first
  if (step.type !== 'app') throw new Error('Expected app (arg reduced)');
  if (step.arg.name !== 'z') throw new Error('Arg should be z');
});

// ============================================================
// Call-by-Value
// ============================================================

test('call-by-value — only reduces when arg is value', () => {
  const { result } = reduce(parse('(λx.x) (λy.y)'), 'cbv');
  // λy.y is a value, so should reduce
  if (result.type !== 'abs') throw new Error('Expected abs');
});

test('call-by-value — does not reduce under abs', () => {
  const { result, steps } = reduce(parse('λx.(λy.y) x'), 'cbv');
  // CBV doesn't reduce under lambda
  if (steps !== 0) throw new Error('CBV should not reduce under lambda');
});

// ============================================================
// Church Numerals
// ============================================================

test('church zero', () => {
  const n = church.toNumber(church.zero);
  if (n !== 0) throw new Error(`Expected 0, got ${n}`);
});

test('church one', () => {
  const n = church.toNumber(church.one);
  if (n !== 1) throw new Error(`Expected 1, got ${n}`);
});

test('church three', () => {
  const n = church.toNumber(church.three);
  if (n !== 3) throw new Error(`Expected 3, got ${n}`);
});

test('church fromNumber roundtrip', () => {
  for (let i = 0; i <= 5; i++) {
    const n = church.toNumber(church.fromNumber(i));
    if (n !== i) throw new Error(`Expected ${i}, got ${n}`);
  }
});

test('church successor', () => {
  const two = new App(church.succ, church.one);
  const { result } = reduce(two, 'normal');
  const n = church.toNumber(result);
  if (n !== 2) throw new Error(`Expected 2, got ${n}`);
});

test('church addition', () => {
  const sum = new App(new App(church.plus, church.two), church.three);
  const { result } = reduce(sum, 'normal');
  const n = church.toNumber(result);
  if (n !== 5) throw new Error(`Expected 5, got ${n}`);
});

test('church multiplication', () => {
  const prod = new App(new App(church.mult, church.two), church.three);
  const { result } = reduce(prod, 'normal');
  const n = church.toNumber(result);
  if (n !== 6) throw new Error(`Expected 6, got ${n}`);
});

test('church isZero true', () => {
  const r = new App(church.isZero, church.zero);
  const { result } = reduce(r, 'normal');
  if (!church.toBool(result)) throw new Error('Expected true');
});

test('church isZero false', () => {
  const r = new App(church.isZero, church.three);
  const { result } = reduce(r, 'normal');
  if (church.toBool(result)) throw new Error('Expected false');
});

// ============================================================
// Church Booleans
// ============================================================

test('church and true true', () => {
  const r = new App(new App(church.and, church.true), church.true);
  const { result } = reduce(r, 'normal');
  if (!church.toBool(result)) throw new Error('Expected true');
});

test('church and true false', () => {
  const r = new App(new App(church.and, church.true), church.false);
  const { result } = reduce(r, 'normal');
  if (church.toBool(result)) throw new Error('Expected false');
});

test('church or false true', () => {
  const r = new App(new App(church.or, church.false), church.true);
  const { result } = reduce(r, 'normal');
  if (!church.toBool(result)) throw new Error('Expected true');
});

test('church not true', () => {
  const r = new App(church.not, church.true);
  const { result } = reduce(r, 'normal');
  if (church.toBool(result)) throw new Error('Expected false');
});

// ============================================================
// Church Pairs
// ============================================================

test('church pair fst', () => {
  const p = new App(new App(church.pair, church.one), church.two);
  const f = new App(church.fst, p);
  const { result } = reduce(f, 'normal');
  const n = church.toNumber(result);
  if (n !== 1) throw new Error(`Expected 1, got ${n}`);
});

test('church pair snd', () => {
  const p = new App(new App(church.pair, church.one), church.two);
  const s = new App(church.snd, p);
  const { result } = reduce(s, 'normal');
  const n = church.toNumber(result);
  if (n !== 2) throw new Error(`Expected 2, got ${n}`);
});

// ============================================================
// De Bruijn Indices
// ============================================================

test('de Bruijn — identity', () => {
  const db = toDeBruijn(parse('λx.x'));
  const s = deBruijnToString(db);
  if (s !== 'λ.0') throw new Error(`Expected λ.0, got ${s}`);
});

test('de Bruijn — K combinator', () => {
  const db = toDeBruijn(parse('λx y.x'));
  const s = deBruijnToString(db);
  if (s !== 'λ.λ.1') throw new Error(`Expected λ.λ.1, got ${s}`);
});

test('de Bruijn — S combinator', () => {
  const db = toDeBruijn(parse('λx y z.x z (y z)'));
  const s = deBruijnToString(db);
  if (s !== 'λ.λ.λ.2 0 (1 0)') throw new Error(`Expected λ.λ.λ.2 0 (1 0), got ${s}`);
});

test('de Bruijn — free variable', () => {
  const db = toDeBruijn(parse('λx.y'));
  if (db.body.type !== 'dbvar' || db.body.index !== 'y') throw new Error('Free var should stay as name');
});

// ============================================================
// SKI Combinators
// ============================================================

test('I combinator', () => {
  const { result } = reduce(new App(combinators.I, new Var('a')), 'normal');
  if (result.name !== 'a') throw new Error(`Expected a`);
});

test('K combinator', () => {
  const { result } = reduce(new App(new App(combinators.K, new Var('a')), new Var('b')), 'normal');
  if (result.name !== 'a') throw new Error(`Expected a`);
});

test('S K K = I', () => {
  // S K K x = K x (K x) = x
  const skk = new App(new App(combinators.S, combinators.K), combinators.K);
  const applied = new App(skk, new Var('a'));
  const { result } = reduce(applied, 'normal');
  if (result.name !== 'a') throw new Error(`S K K a should equal a, got ${prettyPrint(result)}`);
});

// ============================================================
// Omega (divergence detection)
// ============================================================

test('omega diverges (hits step limit)', () => {
  const { normalForm, steps } = reduce(combinators.omega, 'normal', 100);
  if (normalForm) throw new Error('Omega should not reach normal form');
  if (steps !== 100) throw new Error('Should hit step limit');
});

// ============================================================
// Reduction trace
// ============================================================

test('reduction trace records steps', () => {
  const { trace } = reduce(parse('(λx y.x) a b'), 'normal');
  if (trace.length < 3) throw new Error('Expected at least 3 trace entries');
  // First is original, last is result
  if (trace[0].type !== 'app') throw new Error('First should be app');
  if (trace[trace.length - 1].name !== 'a') throw new Error('Last should be a');
});

// ============================================================
// Complex examples
// ============================================================

test('predecessor of 3 is 2', () => {
  const p = new App(church.pred, church.three);
  const { result } = reduce(p, 'normal');
  const n = church.toNumber(result);
  if (n !== 2) throw new Error(`Expected 2, got ${n}`);
});

test('power 2^3 = 8', () => {
  const p = new App(new App(church.pow, church.two), church.three);
  const { result } = reduce(p, 'normal');
  const n = church.toNumber(result);
  if (n !== 8) throw new Error(`Expected 8, got ${n}`);
});

run();
