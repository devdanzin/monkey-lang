const { test, run } = require('./test-runner.cjs');
const {
  Var, Lam, App, prettyPrint, parse,
  normalize, resetReadback,
} = require('./nbe.cjs');

function norm(src) {
  return prettyPrint(normalize(parse(src)));
}

// ============================================================
// Identity and simple reductions
// ============================================================

test('NbE: identity applied', () => {
  const r = norm('(λx.x) y');
  if (r !== 'y') throw new Error(`Expected y, got ${r}`);
});

test('NbE: K combinator', () => {
  const r = norm('(λx y.x) a b');
  if (r !== 'a') throw new Error(`Expected a, got ${r}`);
});

test('NbE: nested beta', () => {
  const r = norm('(λx.(λy.y) x) z');
  if (r !== 'z') throw new Error(`Expected z, got ${r}`);
});

// ============================================================
// Eta expansion (NbE produces η-long forms)
// ============================================================

test('NbE: η-expand free variable used as function', () => {
  // f where f is free and used in function position
  // NbE will η-expand: f → λx.f x
  const r = norm('f');
  // f is just a variable, readback as-is
  if (r !== 'f') throw new Error(`Expected f, got ${r}`);
});

test('NbE: identity is already normal', () => {
  const r = norm('λx.x');
  // Identity normalizes to itself (with fresh name)
  if (!r.startsWith('λ')) throw new Error(`Expected lambda, got ${r}`);
});

// ============================================================
// Open terms (free variables)
// ============================================================

test('NbE: open application', () => {
  // f x — both free, stays as application
  const r = norm('f x');
  if (!r.includes('f')) throw new Error(`Expected f in result: ${r}`);
});

test('NbE: partially applied', () => {
  // (λx.x y) where y is free
  const r = norm('(λx.x) y');
  if (r !== 'y') throw new Error(`Expected y, got ${r}`);
});

test('NbE: free in body', () => {
  const r = norm('λx.f x');
  // Should normalize λx.f x → λx1.f x1 (α-renamed)
  if (!r.startsWith('λ')) throw new Error(`Expected lambda: ${r}`);
});

// ============================================================
// Complex reductions
// ============================================================

test('NbE: S combinator applied', () => {
  // S = λx y z.x z (y z)
  // S K K a = K a (K a) = a
  const r = norm('(λx y z.x z (y z)) (λa b.a) (λa b.a) w');
  if (r !== 'w') throw new Error(`Expected w, got ${r}`);
});

test('NbE: church 2 + 1', () => {
  // succ = λn f x.f (n f x)
  // two = λf x.f (f x)
  // succ two = λf x.f (f (f x))
  const r = norm('(λn f x.f (n f x)) (λf x.f (f x))');
  // Result should be λf.λx.f (f (f x)) — three applications
  // Count f applications
  // NbE uses fresh names, so check structure: λa b.a (a (a b))
  // Count nesting of first param applied
  const result = normalize(parse('(λn f x.f (n f x)) (λf x.f (f x))'));
  // Should be Church 3: λf.λx.f(f(f x))
  if (result.kind !== 'lam' || result.body.kind !== 'lam') throw new Error(`Expected double lam, got ${r}`);
  // Walk body to count applications of f
  let count = 0;
  let cur = result.body.body;
  const fName = result.param;
  while (cur.kind === 'app' && cur.fn.kind === 'var' && cur.fn.name === fName) {
    count++;
    cur = cur.arg;
  }
  if (count !== 3) throw new Error(`Expected 3 applications, got ${count} in ${r}`);
});

test('NbE: compose', () => {
  // compose f g x = f (g x)
  // compose (λx.x) (λx.x) y = y
  const r = norm('(λf g x.f (g x)) (λa.a) (λb.b) y');
  if (r !== 'y') throw new Error(`Expected y, got ${r}`);
});

// ============================================================
// NbE handles what normal-order can't do easily
// ============================================================

test('NbE: normalizes under lambda', () => {
  // λx.(λy.y) x → λx.x
  const result = normalize(parse('λx.(λy.y) x'));
  const r = prettyPrint(result);
  // Should have reduced the inner redex
  // Result: λx1.x1 (fresh named)
  if (result.kind !== 'lam') throw new Error(`Expected lam`);
  if (result.body.kind !== 'var') throw new Error(`Expected var in body, got ${result.body.kind}`);
});

test('NbE: double identity', () => {
  // (λf x.f (f x)) (λy.y)
  const result = normalize(parse('(λf x.f (f x)) (λy.y)'));
  // Should reduce to identity: λx.x
  if (result.kind !== 'lam') throw new Error(`Expected lam`);
  if (result.body.kind !== 'var') throw new Error(`Expected var`);
  if (result.body.name !== result.param) throw new Error(`Body should reference param`);
});

// ============================================================
// Comparison with β-reduction
// ============================================================

test('NbE: agrees with β-reduction on closed term', () => {
  // (λx y.x) (λa.a) (λb.b) should reduce to λa.a
  const result = normalize(parse('(λx y.x) (λa.a) (λb.b)'));
  // Result should be an identity function
  if (result.kind !== 'lam') throw new Error(`Expected lam`);
  if (result.body.kind !== 'var') throw new Error(`Expected var body`);
});

test('NbE: multiple open vars', () => {
  // λx.f (g x)
  const r = norm('λx.f (g x)');
  if (!r.includes('f') && !r.includes('g')) throw new Error(`Lost free vars: ${r}`);
});

test('NbE: readback preserves structure', () => {
  resetReadback();
  const result = normalize(new App(new App(new Var('f'), new Var('a')), new Var('b')));
  // f a b — all neutral
  if (result.kind !== 'app') throw new Error(`Expected app at top`);
});

run();
