const { test, run } = require('./test-runner.cjs');
const {
  Int, Bool, LinArrow, Bang, Tensor, typesEqual,
  LinCtx, LinearTypeError,
  typeCheck, check,
  lit, v, lam, app, pair, letpair, bang, letbang,
} = require('./linear.cjs');

// ============================================================
// Basic linear typing
// ============================================================

test('linear: identity uses param once', () => {
  // λx:Int.x — x used once, OK
  const t = check(lam('x', Int, v('x')));
  if (!typesEqual(t, LinArrow(Int, Int))) throw new Error(`Expected Int ⊸ Int, got ${t}`);
});

test('linear: unused param fails', () => {
  try {
    // λx:Int.42 — x not used (linear violation)
    check(lam('x', Int, lit.int(42)));
    throw new Error('Should throw');
  } catch (e) { if (!(e instanceof LinearTypeError)) throw e; }
});

test('linear: double use fails', () => {
  try {
    // λf:(Int⊸Int).λx:Int.f (f x) — f used twice
    check(lam('f', LinArrow(Int, Int), lam('x', Int, app(v('f'), app(v('f'), v('x'))))));
    throw new Error('Should throw');
  } catch (e) { if (!(e instanceof LinearTypeError)) throw e; }
});

// ============================================================
// Application
// ============================================================

test('linear: simple application', () => {
  // (λx:Int.x) 42
  const t = check(app(lam('x', Int, v('x')), lit.int(42)));
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

test('linear: higher-order', () => {
  // λf:(Int⊸Int).λx:Int.f x
  const t = check(lam('f', LinArrow(Int, Int), lam('x', Int, app(v('f'), v('x')))));
  if (!typesEqual(t, LinArrow(LinArrow(Int, Int), LinArrow(Int, Int)))) throw new Error(`Bad type: ${t}`);
});

// ============================================================
// Tensor pairs
// ============================================================

test('linear: pair construction', () => {
  // λx:Int.λy:Bool.(x, y)
  const t = check(lam('x', Int, lam('y', Bool, pair(v('x'), v('y')))));
  if (!typesEqual(t, LinArrow(Int, LinArrow(Bool, Tensor(Int, Bool))))) throw new Error(`Bad type: ${t}`);
});

test('linear: let-pair destructuring', () => {
  // λp:(Int⊗Bool).let (x,y) = p in x
  // Should fail because y is not used
  try {
    check(lam('p', Tensor(Int, Bool), letpair('x', 'y', v('p'), v('x'))));
    throw new Error('Should throw — y unused');
  } catch (e) { if (!(e instanceof LinearTypeError)) throw e; }
});

test('linear: let-pair both used', () => {
  // λp:(Int⊗Int).let (x,y) = p in (y, x)
  const t = check(lam('p', Tensor(Int, Int), letpair('x', 'y', v('p'), pair(v('y'), v('x')))));
  if (!typesEqual(t, LinArrow(Tensor(Int, Int), Tensor(Int, Int)))) throw new Error(`Bad type: ${t}`);
});

// ============================================================
// Bang (unrestricted)
// ============================================================

test('linear: bang allows multiple use', () => {
  // λx:!Int. let !y = x in (y, y)  — conceptually
  // Using letbang to unwrap, y should be usable multiple times
  const t = check(lam('x', Bang(Int),
    letbang('y', v('x'),
      pair(v('y'), v('y')))));
  // y : !Int is unrestricted, so pair(y,y) should work
  if (!typesEqual(t, LinArrow(Bang(Int), Tensor(Bang(Int), Bang(Int))))) throw new Error(`Bad type: ${t}`);
});

test('linear: bang intro', () => {
  // !42
  const t = check(bang(lit.int(42)));
  if (!typesEqual(t, Bang(Int))) throw new Error(`Expected !Int`);
});

// ============================================================
// Unused unrestricted is OK
// ============================================================

test('linear: unused unrestricted param OK', () => {
  // λx:!Int.42 — x is unrestricted, can be unused
  const t = check(lam('x', Bang(Int), lit.int(42)));
  if (!typesEqual(t, LinArrow(Bang(Int), Int))) throw new Error(`Bad type: ${t}`);
});

test('linear: unused Int param also fails (Int is linear)', () => {
  // In our system, all types are linear unless wrapped in !
  try {
    check(lam('x', Int, lit.int(42)));
    throw new Error('Should throw — x is linear');
  } catch (e) { if (!(e instanceof LinearTypeError)) throw e; }
});

// ============================================================
// Context splitting across application
// ============================================================

test('linear: context split in application', () => {
  // λx:Int.λy:Int.(λa:Int.a) x uses x, y unused → error
  try {
    check(lam('x', LinArrow(Int, Int), lam('y', LinArrow(Int, Int),
      app(v('x'), lit.int(1)))));
    throw new Error('Should throw — y unused');
  } catch (e) { if (!(e instanceof LinearTypeError)) throw e; }
});

// ============================================================
// Type display
// ============================================================

test('linear arrow toString', () => {
  const s = LinArrow(Int, Bool).toString();
  if (s !== 'Int ⊸ Bool') throw new Error(`Got: ${s}`);
});

test('bang toString', () => {
  const s = Bang(Int).toString();
  if (s !== '!Int') throw new Error(`Got: ${s}`);
});

test('tensor toString', () => {
  const s = Tensor(Int, Bool).toString();
  if (s !== 'Int ⊗ Bool') throw new Error(`Got: ${s}`);
});

run();
