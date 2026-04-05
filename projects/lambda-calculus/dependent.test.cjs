const { test, run } = require('./test-runner.cjs');
const {
  Type, Nat, Zero, Succ,
  evaluate, convert,
  Ctx, DepTypeError, infer, check,
  pi, sigma, lam, app, pair, fst, snd, ann, v_, arrow,
} = require('./dependent.cjs');

// ============================================================
// Universe
// ============================================================

test('dep: Type : Type', () => {
  const t = infer(new Ctx(), Type);
  if (t.tag !== 'vtype') throw new Error('Expected VType');
});

test('dep: Nat : Type', () => {
  const t = infer(new Ctx(), Nat);
  if (t.tag !== 'vtype') throw new Error('Expected VType');
});

// ============================================================
// Natural numbers
// ============================================================

test('dep: zero : Nat', () => {
  const t = infer(new Ctx(), Zero);
  if (t.tag !== 'vnat') throw new Error('Expected VNat');
});

test('dep: succ zero : Nat', () => {
  const t = infer(new Ctx(), Succ(Zero));
  if (t.tag !== 'vnat') throw new Error('Expected VNat');
});

// ============================================================
// Pi types (dependent functions)
// ============================================================

test('dep: Π(x:Nat).Nat : Type', () => {
  const t = infer(new Ctx(), pi('x', Nat, Nat));
  if (t.tag !== 'vtype') throw new Error('Expected VType');
});

test('dep: non-dependent arrow Nat → Nat : Type', () => {
  const t = infer(new Ctx(), arrow(Nat, Nat));
  if (t.tag !== 'vtype') throw new Error('Expected VType');
});

test('dep: identity function', () => {
  // (λx.x : Π(x:Nat).Nat)
  const t = infer(new Ctx(), ann(lam('x', v_('x')), pi('x', Nat, Nat)));
  if (t.tag !== 'vpi') throw new Error('Expected VPi');
});

test('dep: identity application', () => {
  // ((λx.x : Nat→Nat) zero) : Nat
  const id = ann(lam('x', v_('x')), arrow(Nat, Nat));
  const t = infer(new Ctx(), app(id, Zero));
  if (t.tag !== 'vnat') throw new Error('Expected VNat');
});

// ============================================================
// Dependent function types
// ============================================================

test('dep: constant function', () => {
  // (λx.λy.x : Π(x:Nat).Π(y:Nat).Nat)
  const t = infer(new Ctx(), ann(lam('x', lam('y', v_('x'))), pi('x', Nat, pi('y', Nat, Nat))));
  if (t.tag !== 'vpi') throw new Error('Expected VPi');
});

test('dep: polymorphic identity', () => {
  // Λ(A:Type).λ(x:A).x : Π(A:Type).Π(x:A).A
  const polyId = ann(lam('A', lam('x', v_('x'))), pi('A', Type, pi('x', v_('A'), v_('A'))));
  const t = infer(new Ctx(), polyId);
  if (t.tag !== 'vpi') throw new Error('Expected VPi');
});

test('dep: polymorphic identity applied to Nat', () => {
  const polyId = ann(lam('A', lam('x', v_('x'))), pi('A', Type, pi('x', v_('A'), v_('A'))));
  // polyId Nat : Π(x:Nat).Nat
  const t = infer(new Ctx(), app(polyId, Nat));
  if (t.tag !== 'vpi') throw new Error('Expected VPi');
});

test('dep: polymorphic identity fully applied', () => {
  const polyId = ann(lam('A', lam('x', v_('x'))), pi('A', Type, pi('x', v_('A'), v_('A'))));
  // polyId Nat zero : Nat
  const t = infer(new Ctx(), app(app(polyId, Nat), Zero));
  if (t.tag !== 'vnat') throw new Error('Expected VNat');
});

// ============================================================
// Sigma types (dependent pairs)
// ============================================================

test('dep: Σ(x:Nat).Nat : Type', () => {
  const t = infer(new Ctx(), sigma('x', Nat, Nat));
  if (t.tag !== 'vtype') throw new Error('Expected VType');
});

test('dep: pair checked against sigma', () => {
  // (zero, succ zero) : Σ(x:Nat).Nat
  const sigType = evaluate(sigma('x', Nat, Nat), new Map());
  check(new Ctx(), pair(Zero, Succ(Zero)), sigType);
  // No error = pass
});

test('dep: fst projection', () => {
  const p = ann(pair(Zero, Succ(Zero)), sigma('x', Nat, Nat));
  const t = infer(new Ctx(), fst(p));
  if (t.tag !== 'vnat') throw new Error('Expected VNat');
});

test('dep: snd projection', () => {
  const p = ann(pair(Zero, Succ(Zero)), sigma('x', Nat, Nat));
  const t = infer(new Ctx(), snd(p));
  if (t.tag !== 'vnat') throw new Error('Expected VNat');
});

// ============================================================
// Type errors
// ============================================================

test('dep: type error — apply non-function', () => {
  try {
    infer(new Ctx(), app(Zero, Zero));
    throw new Error('Should throw');
  } catch (e) { if (!(e instanceof DepTypeError)) throw e; }
});

test('dep: type error — wrong argument type', () => {
  try {
    const id = ann(lam('x', v_('x')), arrow(Nat, Nat));
    // Apply to Type instead of Nat
    infer(new Ctx(), app(id, Type));
    throw new Error('Should throw');
  } catch (e) { if (!(e instanceof DepTypeError)) throw e; }
});

test('dep: type error — unbound variable', () => {
  try {
    infer(new Ctx(), v_('x'));
    throw new Error('Should throw');
  } catch (e) { if (!(e instanceof DepTypeError)) throw e; }
});

// ============================================================
// Conversion checking
// ============================================================

test('dep: conversion — beta equal', () => {
  // (λx.x) zero ≡ zero
  const a = evaluate(app(lam('x', v_('x')), Zero), new Map());
  const b = evaluate(Zero, new Map());
  if (!convert(a, b)) throw new Error('Should be convertible');
});

test('dep: conversion — under lambda', () => {
  // λx.(λy.y) x ≡ λx.x
  const a = evaluate(lam('x', app(lam('y', v_('y')), v_('x'))), new Map());
  const b = evaluate(lam('x', v_('x')), new Map());
  if (!convert(a, b)) throw new Error('Should be convertible (beta under lambda)');
});

run();
