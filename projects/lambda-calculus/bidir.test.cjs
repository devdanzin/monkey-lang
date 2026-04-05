const { test, run } = require('./test-runner.cjs');
const {
  Int, Bool, Unit, Arrow, typesEqual,
  Context, BiTypeError,
  infer, check,
  lit, v, lam, app, ann, binop, if_, let_,
} = require('./bidir.cjs');

// ============================================================
// Infer literals
// ============================================================

test('infer: int literal', () => {
  const t = infer(new Context(), lit.int(42));
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

test('infer: bool literal', () => {
  const t = infer(new Context(), lit.bool(true));
  if (!typesEqual(t, Bool)) throw new Error(`Expected Bool`);
});

// ============================================================
// Infer variables
// ============================================================

test('infer: bound variable', () => {
  const ctx = new Context().extend('x', Int);
  const t = infer(ctx, v('x'));
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

test('infer: unbound variable throws', () => {
  try {
    infer(new Context(), v('x'));
    throw new Error('Should throw');
  } catch (e) { if (!(e instanceof BiTypeError)) throw e; }
});

// ============================================================
// Check lambdas (the key bidirectional feature)
// ============================================================

test('check: lambda against arrow', () => {
  // λx.x checked against Int → Int
  check(new Context(), lam('x', v('x')), Arrow(Int, Int));
  // No error = pass
});

test('check: lambda against wrong type', () => {
  try {
    check(new Context(), lam('x', v('x')), Int);
    throw new Error('Should throw');
  } catch (e) { if (!(e instanceof BiTypeError)) throw e; }
});

test('check: nested lambda', () => {
  // λx y.x checked against Int → Bool → Int
  check(new Context(), lam('x', lam('y', v('x'))), Arrow(Int, Arrow(Bool, Int)));
});

test('check: lambda body type mismatch', () => {
  try {
    // λx.x checked against Int → Bool (x:Int, but body returns Int, expected Bool)
    check(new Context(), lam('x', v('x')), Arrow(Int, Bool));
    throw new Error('Should throw');
  } catch (e) { if (!(e instanceof BiTypeError)) throw e; }
});

// ============================================================
// Infer cannot infer unannotated lambda
// ============================================================

test('infer: unannotated lambda fails', () => {
  try {
    infer(new Context(), lam('x', v('x')));
    throw new Error('Should throw');
  } catch (e) { if (!(e instanceof BiTypeError)) throw e; }
});

// ============================================================
// Annotations (switch from check to infer)
// ============================================================

test('infer: annotated lambda', () => {
  // (λx.x : Int → Int)
  const t = infer(new Context(), ann(lam('x', v('x')), Arrow(Int, Int)));
  if (!typesEqual(t, Arrow(Int, Int))) throw new Error(`Expected Int → Int`);
});

test('infer: wrong annotation', () => {
  try {
    // (λx.x : Int → Bool) — should fail because x:Int but body is Int not Bool
    infer(new Context(), ann(lam('x', v('x')), Arrow(Int, Bool)));
    throw new Error('Should throw');
  } catch (e) { if (!(e instanceof BiTypeError)) throw e; }
});

// ============================================================
// Application
// ============================================================

test('infer: application', () => {
  // (λx.x : Int → Int) 42
  const t = infer(new Context(), app(ann(lam('x', v('x')), Arrow(Int, Int)), lit.int(42)));
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

test('infer: application arg checked', () => {
  // (λx.x : Int → Int) true — should fail, arg checked against Int
  try {
    infer(new Context(), app(ann(lam('x', v('x')), Arrow(Int, Int)), lit.bool(true)));
    throw new Error('Should throw');
  } catch (e) { if (!(e instanceof BiTypeError)) throw e; }
});

// ============================================================
// If-then-else
// ============================================================

test('check: if expression', () => {
  check(new Context(), if_(lit.bool(true), lit.int(1), lit.int(2)), Int);
});

test('check: if branch mismatch', () => {
  try {
    check(new Context(), if_(lit.bool(true), lit.int(1), lit.bool(false)), Int);
    throw new Error('Should throw');
  } catch (e) { if (!(e instanceof BiTypeError)) throw e; }
});

test('check: if non-bool condition', () => {
  try {
    check(new Context(), if_(lit.int(1), lit.int(2), lit.int(3)), Int);
    throw new Error('Should throw');
  } catch (e) { if (!(e instanceof BiTypeError)) throw e; }
});

// ============================================================
// Let
// ============================================================

test('infer: let with annotation', () => {
  // let x : Int = 5 in x + 1
  const t = infer(new Context(), let_('x', Int, lit.int(5), binop('+', v('x'), lit.int(1))));
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

test('infer: let without annotation', () => {
  // let x = 5 in x + 1 (infers x : Int)
  const t = infer(new Context(), let_('x', null, lit.int(5), binop('+', v('x'), lit.int(1))));
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

// ============================================================
// Higher-order with bidirectional checking
// ============================================================

test('check: higher-order lambda', () => {
  // λf.λx.f x checked against (Int → Bool) → Int → Bool
  check(new Context(),
    lam('f', lam('x', app(v('f'), v('x')))),
    Arrow(Arrow(Int, Bool), Arrow(Int, Bool)));
});

test('infer: compose', () => {
  // (λf.λg.λx.f (g x) : (Bool → Int) → (Int → Bool) → Int → Int)
  const composeType = Arrow(Arrow(Bool, Int), Arrow(Arrow(Int, Bool), Arrow(Int, Int)));
  const t = infer(new Context(),
    ann(lam('f', lam('g', lam('x', app(v('f'), app(v('g'), v('x')))))), composeType));
  if (!typesEqual(t, composeType)) throw new Error(`Expected compose type`);
});

// ============================================================
// Arithmetic
// ============================================================

test('infer: arithmetic', () => {
  const t = infer(new Context(), binop('+', lit.int(1), lit.int(2)));
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

test('infer: comparison', () => {
  const t = infer(new Context(), binop('<', lit.int(1), lit.int(2)));
  if (!typesEqual(t, Bool)) throw new Error(`Expected Bool`);
});

run();
