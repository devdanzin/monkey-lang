const { test, run } = require('./test-runner.cjs');
const {
  cpsConvert, cpsPrint, evalViaCPS, resetFresh,
  num, bool, v_, lam, app, binop, if_, let_, callcc,
} = require('./cps.cjs');

// ============================================================
// CPS Transform — Structure
// ============================================================

test('CPS: literal', () => {
  resetFresh();
  const cps = cpsConvert(num(42));
  const s = cpsPrint(cps);
  if (!s.includes('42')) throw new Error(`Expected 42 in output: ${s}`);
  if (!s.includes('halt')) throw new Error(`Expected halt: ${s}`);
});

test('CPS: variable', () => {
  resetFresh();
  const cps = cpsConvert(v_('x'));
  const s = cpsPrint(cps);
  if (!s.includes('x')) throw new Error(`Expected x: ${s}`);
});

test('CPS: lambda adds continuation param', () => {
  resetFresh();
  const cps = cpsConvert(lam('x', v_('x')));
  const s = cpsPrint(cps);
  // Should have a continuation parameter
  if (!s.includes('k')) throw new Error(`Expected continuation param: ${s}`);
});

// ============================================================
// Evaluate via CPS
// ============================================================

test('eval CPS: literal', () => {
  const r = evalViaCPS(num(42));
  if (r !== 42) throw new Error(`Expected 42, got ${r}`);
});

test('eval CPS: arithmetic', () => {
  const r = evalViaCPS(binop('+', num(3), num(4)));
  if (r !== 7) throw new Error(`Expected 7, got ${r}`);
});

test('eval CPS: nested arithmetic', () => {
  const r = evalViaCPS(binop('*', binop('+', num(2), num(3)), num(4)));
  if (r !== 20) throw new Error(`Expected 20, got ${r}`);
});

test('eval CPS: identity function', () => {
  const r = evalViaCPS(app(lam('x', v_('x')), num(42)));
  if (r !== 42) throw new Error(`Expected 42, got ${r}`);
});

test('eval CPS: constant function', () => {
  const r = evalViaCPS(app(app(lam('x', lam('y', v_('x'))), num(1)), num(2)));
  if (r !== 1) throw new Error(`Expected 1, got ${r}`);
});

test('eval CPS: function with arithmetic', () => {
  const r = evalViaCPS(app(lam('x', binop('+', v_('x'), num(1))), num(5)));
  if (r !== 6) throw new Error(`Expected 6, got ${r}`);
});

test('eval CPS: if true', () => {
  const r = evalViaCPS(if_(bool(true), num(1), num(2)));
  if (r !== 1) throw new Error(`Expected 1, got ${r}`);
});

test('eval CPS: if false', () => {
  const r = evalViaCPS(if_(bool(false), num(1), num(2)));
  if (r !== 2) throw new Error(`Expected 2, got ${r}`);
});

test('eval CPS: if with computation', () => {
  const r = evalViaCPS(if_(binop('<', num(3), num(5)), binop('+', num(10), num(20)), num(0)));
  if (r !== 30) throw new Error(`Expected 30, got ${r}`);
});

test('eval CPS: let', () => {
  const r = evalViaCPS(let_('x', num(5), binop('*', v_('x'), v_('x'))));
  if (r !== 25) throw new Error(`Expected 25, got ${r}`);
});

test('eval CPS: higher-order function', () => {
  // (λf. f 3) (λx. x * x)
  const r = evalViaCPS(app(lam('f', app(v_('f'), num(3))), lam('x', binop('*', v_('x'), v_('x')))));
  if (r !== 9) throw new Error(`Expected 9, got ${r}`);
});

// ============================================================
// call/cc
// ============================================================

test('call/cc: simple escape', () => {
  // 1 + call/cc(λk. k 10)  →  11
  // But in our simple model: call/cc(λk. k 10) → 10
  const r = evalViaCPS(callcc(lam('k', app(v_('k'), num(10)))));
  if (r !== 10) throw new Error(`Expected 10, got ${r}`);
});

test('call/cc: abort', () => {
  // call/cc(λk. k 5 + 100) → 5 (k aborts, +100 never runs)
  // More precisely: call/cc(λk. (+ (k 5) 100))
  const r = evalViaCPS(callcc(lam('k', binop('+', app(v_('k'), num(5)), num(100)))));
  if (r !== 5) throw new Error(`Expected 5 (abort), got ${r}`);
});

test('call/cc: no escape', () => {
  // call/cc(λk. 42) → 42 (k is never used)
  const r = evalViaCPS(callcc(lam('k', num(42))));
  if (r !== 42) throw new Error(`Expected 42, got ${r}`);
});

// ============================================================
// Complex programs
// ============================================================

test('eval CPS: let with function', () => {
  // let double = λx.x+x in double 5
  const r = evalViaCPS(let_('double', lam('x', binop('+', v_('x'), v_('x'))), app(v_('double'), num(5))));
  if (r !== 10) throw new Error(`Expected 10, got ${r}`);
});

test('eval CPS: nested let', () => {
  // let a = 3 in let b = 4 in a + b
  const r = evalViaCPS(let_('a', num(3), let_('b', num(4), binop('+', v_('a'), v_('b')))));
  if (r !== 7) throw new Error(`Expected 7, got ${r}`);
});

test('eval CPS: compose', () => {
  // let f = λx.x+1 in let g = λx.x*2 in f (g 3)
  const r = evalViaCPS(
    let_('f', lam('x', binop('+', v_('x'), num(1))),
      let_('g', lam('x', binop('*', v_('x'), num(2))),
        app(v_('f'), app(v_('g'), num(3))))));
  if (r !== 7) throw new Error(`Expected 7, got ${r}`);
});

run();
