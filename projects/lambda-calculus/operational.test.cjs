const { test, run } = require('./test-runner.cjs');
const {
  Num, Bool_, BinOp, If, Var, Let, Lam, App,
  isValue, exprEqual, prettyPrint, subst,
  smallStep, smallStepTrace,
  bigStep,
} = require('./operational.cjs');

// Convenience
const n = v => new Num(v);
const b = v => new Bool_(v);
const add = (l, r) => new BinOp('+', l, r);
const mul = (l, r) => new BinOp('*', l, r);
const lt = (l, r) => new BinOp('<', l, r);
const eq = (l, r) => new BinOp('==', l, r);
const if_ = (c, t, e) => new If(c, t, e);
const v_ = name => new Var(name);
const let_ = (name, val, body) => new Let(name, val, body);
const lam = (p, body) => new Lam(p, body);
const app = (fn, arg) => new App(fn, arg);

// ============================================================
// Small-step: arithmetic
// ============================================================

test('small-step: 1 + 2 → 3', () => {
  const { result, steps } = smallStepTrace(add(n(1), n(2)));
  if (result.n !== 3) throw new Error(`Expected 3`);
  if (steps !== 1) throw new Error(`Expected 1 step`);
});

test('small-step: (1 + 2) * 3', () => {
  const { result, trace } = smallStepTrace(mul(add(n(1), n(2)), n(3)));
  if (result.n !== 9) throw new Error(`Expected 9`);
  // Steps: (1+2)*3 → 3*3 → 9
  if (trace.length !== 3) throw new Error(`Expected 3 trace entries, got ${trace.length}`);
  if (trace[1].rule !== 'BinOp-Left(Add)') throw new Error(`Expected BinOp-Left(Add), got ${trace[1].rule}`);
});

test('small-step: nested arithmetic', () => {
  // (2 + 3) * (4 + 1)
  const { result } = smallStepTrace(mul(add(n(2), n(3)), add(n(4), n(1))));
  if (result.n !== 25) throw new Error(`Expected 25`);
});

// ============================================================
// Small-step: if-then-else
// ============================================================

test('small-step: if true then 1 else 2', () => {
  const { result } = smallStepTrace(if_(b(true), n(1), n(2)));
  if (result.n !== 1) throw new Error(`Expected 1`);
});

test('small-step: if (1 < 2) then 10 else 20', () => {
  const { result, trace } = smallStepTrace(if_(lt(n(1), n(2)), n(10), n(20)));
  if (result.n !== 10) throw new Error(`Expected 10`);
  // Trace: if(1<2)... → if(true)... → 10
  if (trace[1].rule !== 'If-Cond(Lt)') throw new Error(`Expected If-Cond(Lt)`);
  if (trace[2].rule !== 'If-True') throw new Error(`Expected If-True`);
});

// ============================================================
// Small-step: let
// ============================================================

test('small-step: let x = 5 in x + 1', () => {
  const { result } = smallStepTrace(let_('x', n(5), add(v_('x'), n(1))));
  if (result.n !== 6) throw new Error(`Expected 6`);
});

test('small-step: let with evaluation', () => {
  // let x = 2 + 3 in x * x
  const { result, trace } = smallStepTrace(let_('x', add(n(2), n(3)), mul(v_('x'), v_('x'))));
  if (result.n !== 25) throw new Error(`Expected 25`);
  // First step evaluates 2+3→5, then let-subst, then 5*5→25
});

// ============================================================
// Small-step: lambda and application
// ============================================================

test('small-step: (λx.x) 42', () => {
  const { result } = smallStepTrace(app(lam('x', v_('x')), n(42)));
  if (result.n !== 42) throw new Error(`Expected 42`);
});

test('small-step: (λx.x+1) 5', () => {
  const { result } = smallStepTrace(app(lam('x', add(v_('x'), n(1))), n(5)));
  if (result.n !== 6) throw new Error(`Expected 6`);
});

test('small-step: higher-order', () => {
  // (λf.f 3) (λx.x*x)
  const { result } = smallStepTrace(app(lam('f', app(v_('f'), n(3))), lam('x', mul(v_('x'), v_('x')))));
  if (result.n !== 9) throw new Error(`Expected 9`);
});

// ============================================================
// Small-step: derivation rules
// ============================================================

test('derivation rules tracked', () => {
  const { trace } = smallStepTrace(app(lam('x', add(v_('x'), n(1))), add(n(2), n(3))));
  // Steps: app(lam,2+3) →[App-Arg(Add)] app(lam,5) →[Beta] x+1[x:=5]=5+1 →[Add] 6
  const rules = trace.slice(1).map(t => t.rule);
  if (!rules.includes('App-Arg(Add)')) throw new Error('Missing App-Arg(Add)');
  if (!rules.includes('Beta')) throw new Error('Missing Beta');
  if (!rules.includes('Add')) throw new Error('Missing Add');
});

// ============================================================
// Big-step: arithmetic
// ============================================================

test('big-step: 1 + 2 ⇓ 3', () => {
  const { value } = bigStep(add(n(1), n(2)));
  if (value.n !== 3) throw new Error(`Expected 3`);
});

test('big-step: (2 + 3) * (4 + 1) ⇓ 25', () => {
  const { value } = bigStep(mul(add(n(2), n(3)), add(n(4), n(1))));
  if (value.n !== 25) throw new Error(`Expected 25`);
});

// ============================================================
// Big-step: if
// ============================================================

test('big-step: if 1 < 2 then 10 else 20 ⇓ 10', () => {
  const { value } = bigStep(if_(lt(n(1), n(2)), n(10), n(20)));
  if (value.n !== 10) throw new Error(`Expected 10`);
});

// ============================================================
// Big-step: let
// ============================================================

test('big-step: let x = 5 in x * x ⇓ 25', () => {
  const { value } = bigStep(let_('x', n(5), mul(v_('x'), v_('x'))));
  if (value.n !== 25) throw new Error(`Expected 25`);
});

// ============================================================
// Big-step: lambda
// ============================================================

test('big-step: (λx.x+1) 5 ⇓ 6', () => {
  const { value } = bigStep(app(lam('x', add(v_('x'), n(1))), n(5)));
  if (value.n !== 6) throw new Error(`Expected 6`);
});

test('big-step: higher-order', () => {
  const { value } = bigStep(app(lam('f', app(v_('f'), n(3))), lam('x', mul(v_('x'), v_('x')))));
  if (value.n !== 9) throw new Error(`Expected 9`);
});

// ============================================================
// Confluence: small-step and big-step agree
// ============================================================

test('confluence: small-step ≡ big-step on arithmetic', () => {
  const expr = mul(add(n(2), n(3)), add(n(1), n(4)));
  const ss = smallStepTrace(expr).result;
  const bs = bigStep(expr).value;
  if (!exprEqual(ss, bs)) throw new Error(`Small: ${prettyPrint(ss)}, Big: ${prettyPrint(bs)}`);
});

test('confluence: small-step ≡ big-step on if', () => {
  const expr = if_(lt(n(3), n(5)), add(n(10), n(20)), n(0));
  const ss = smallStepTrace(expr).result;
  const bs = bigStep(expr).value;
  if (!exprEqual(ss, bs)) throw new Error(`Small: ${prettyPrint(ss)}, Big: ${prettyPrint(bs)}`);
});

test('confluence: small-step ≡ big-step on lambda', () => {
  const expr = app(lam('x', add(v_('x'), v_('x'))), add(n(3), n(4)));
  const ss = smallStepTrace(expr).result;
  const bs = bigStep(expr).value;
  if (!exprEqual(ss, bs)) throw new Error(`Small: ${prettyPrint(ss)}, Big: ${prettyPrint(bs)}`);
});

// ============================================================
// Determinism: same expression always produces same result
// ============================================================

test('determinism: small-step is deterministic', () => {
  const expr = mul(add(n(1), n(2)), add(n(3), n(4)));
  const r1 = smallStepTrace(expr);
  const r2 = smallStepTrace(expr);
  if (!exprEqual(r1.result, r2.result)) throw new Error('Non-deterministic!');
  if (r1.steps !== r2.steps) throw new Error('Different step counts!');
});

// ============================================================
// Big-step derivation tree
// ============================================================

test('big-step derivation tree', () => {
  const { derivation } = bigStep(add(n(1), n(2)));
  if (derivation.rule !== 'BinOp') throw new Error(`Expected BinOp rule`);
  if (derivation.left.rule !== 'Num') throw new Error('Left should be Num');
  if (derivation.right.rule !== 'Num') throw new Error('Right should be Num');
});

// ============================================================
// prettyPrint
// ============================================================

test('prettyPrint', () => {
  const s = prettyPrint(app(lam('x', add(v_('x'), n(1))), n(5)));
  if (s !== '(λx.(x + 1) 5)') throw new Error(`Got: ${s}`);
});

run();
