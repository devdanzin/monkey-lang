const { test, run: runTests } = require('./test-runner.cjs');
const {
  run, evaluate, Return,
  num, bool, str, unit, v_, lam, app, binop, if_, let_, seq, perform, pair, handle,
} = require('./effects.cjs');

// ============================================================
// Basic evaluation (no effects)
// ============================================================

test('eval: literal', () => {
  const r = run(num(42));
  if (r.n !== 42) throw new Error(`Expected 42`);
});

test('eval: arithmetic', () => {
  const r = run(binop('+', num(3), num(4)));
  if (r.n !== 7) throw new Error(`Expected 7`);
});

test('eval: function application', () => {
  const r = run(app(lam('x', binop('*', v_('x'), v_('x'))), num(5)));
  if (r.n !== 25) throw new Error(`Expected 25`);
});

test('eval: let', () => {
  const r = run(let_('x', num(10), binop('+', v_('x'), v_('x'))));
  if (r.n !== 20) throw new Error(`Expected 20`);
});

test('eval: if', () => {
  const r = run(if_(bool(true), num(1), num(2)));
  if (r.n !== 1) throw new Error(`Expected 1`);
});

// ============================================================
// Exception effect (handle without resume)
// ============================================================

test('effect: exception — no throw', () => {
  // handle { 42 } with { raise(e) -> -1 } return(x) -> x
  const prog = handle(
    num(42),
    { raise: { param: 'e', body: num(-1) } },
    { param: 'x', body: v_('x') }
  );
  const r = run(prog);
  if (r.n !== 42) throw new Error(`Expected 42, got ${r.n}`);
});

test('effect: exception — throw caught', () => {
  // handle { perform raise 99 } with { raise(e) -> e } return(x) -> x
  const prog = handle(
    perform('raise', num(99)),
    { raise: { param: 'e', body: v_('e') } },
    { param: 'x', body: v_('x') }
  );
  const r = run(prog);
  if (r.n !== 99) throw new Error(`Expected 99, got ${r.n}`);
});

test('effect: exception — computation after throw is skipped', () => {
  // handle { perform raise 1; 42 } with { raise(e) -> e } return(x) -> 0
  const prog = handle(
    seq(perform('raise', num(1)), num(42)),
    { raise: { param: 'e', body: v_('e') } },
    { param: 'x', body: num(0) }
  );
  const r = run(prog);
  // Should be 1, not 42 or 0 — the handler catches and the body is abandoned
  if (r.n !== 1) throw new Error(`Expected 1, got ${r.n}`);
});

// ============================================================
// Return handler transforms result
// ============================================================

test('effect: return handler transforms', () => {
  // handle { 10 } with {} return(x) -> x + 1
  const prog = handle(
    num(10),
    {},
    { param: 'x', body: binop('+', v_('x'), num(1)) }
  );
  const r = run(prog);
  if (r.n !== 11) throw new Error(`Expected 11, got ${r.n}`);
});

// ============================================================
// State effect (using resume)
// ============================================================

test('effect: simple resume', () => {
  // handle { perform ask () + 1 } with { ask(x, resume) -> resume(10) } return(x) -> x
  // This should: perform ask, handler provides 10, computation resumes with 10, adds 1
  const prog = handle(
    binop('+', perform('ask', unit), num(1)),
    {
      ask: {
        param: '_',
        resumeName: 'resume',
        body: app(v_('resume'), num(10))
      }
    },
    { param: 'x', body: v_('x') }
  );
  const r = run(prog);
  if (r.n !== 11) throw new Error(`Expected 11, got ${r.n}`);
});

// ============================================================
// Unhandled effect error
// ============================================================

test('effect: unhandled throws', () => {
  try {
    run(perform('unknown', num(1)));
    throw new Error('Should throw');
  } catch (e) {
    if (!e.message.includes('Unhandled')) throw e;
  }
});

// ============================================================
// Nested handlers
// ============================================================

test('effect: nested handlers — inner handles', () => {
  // handle { handle { perform raise 5 } with { raise(e) -> e + 1 } return(x) -> x } 
  //   with { raise(e) -> e + 100 } return(x) -> x
  // Inner handler catches, result is 6
  const inner = handle(
    perform('raise', num(5)),
    { raise: { param: 'e', body: binop('+', v_('e'), num(1)) } },
    { param: 'x', body: v_('x') }
  );
  const outer = handle(
    inner,
    { raise: { param: 'e', body: binop('+', v_('e'), num(100)) } },
    { param: 'x', body: v_('x') }
  );
  const r = run(outer);
  if (r.n !== 6) throw new Error(`Expected 6, got ${r.n}`);
});

// ============================================================
// Multiple effects
// ============================================================

test('effect: two different effects', () => {
  // handle { perform ask () + perform tell 10 }
  //   with { ask(_) -> resume(5), tell(x) -> resume(x * 2) }
  //   return(x) -> x
  // ask → 5, tell 10 → 20, 5 + 20 = 25
  const prog = handle(
    binop('+', perform('ask', unit), perform('tell', num(10))),
    {
      ask: { param: '_', resumeName: 'resume', body: app(v_('resume'), num(5)) },
      tell: { param: 'x', resumeName: 'resume', body: app(v_('resume'), binop('*', v_('x'), num(2))) }
    },
    { param: 'x', body: v_('x') }
  );
  const r = run(prog);
  if (r.n !== 25) throw new Error(`Expected 25, got ${r.n}`);
});

// ============================================================
// Higher-order with effects
// ============================================================

test('effect: function performs effect', () => {
  // let f = λx. perform ask () + x in handle { f 3 } with { ask(_) -> resume(10) } return(x) -> x
  const prog = let_('f', lam('x', binop('+', perform('ask', unit), v_('x'))),
    handle(
      app(v_('f'), num(3)),
      { ask: { param: '_', resumeName: 'resume', body: app(v_('resume'), num(10)) } },
      { param: 'x', body: v_('x') }
    ));
  const r = run(prog);
  if (r.n !== 13) throw new Error(`Expected 13, got ${r.n}`);
});

// ============================================================
// Pair
// ============================================================

test('eval: pair', () => {
  const r = run(pair(num(1), num(2)));
  if (r.fst.n !== 1 || r.snd.n !== 2) throw new Error('Bad pair');
});

runTests();
