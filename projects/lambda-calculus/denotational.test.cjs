const { test, run } = require('./test-runner.cjs');
const {
  BOTTOM, DInt, DBool, DFun, DPair,
  valToString, valEqual,
  Env, denote, denoteFix,
  lit, v, lam, app, if_, let_, fix, binop, pair, fst, snd,
} = require('./denotational.cjs');

// ============================================================
// Literals
// ============================================================

test('denote integer literal', () => {
  const r = denote(lit.int(42));
  if (r.tag !== 'int' || r.value !== 42) throw new Error(`Expected 42`);
});

test('denote boolean literal', () => {
  const r = denote(lit.bool(true));
  if (r.tag !== 'bool' || r.value !== true) throw new Error(`Expected true`);
});

// ============================================================
// Variables and Environment
// ============================================================

test('denote bound variable', () => {
  const env = new Env().extend('x', new DInt(7));
  const r = denote(v('x'), env);
  if (r.value !== 7) throw new Error(`Expected 7`);
});

test('denote unbound variable is ⊥', () => {
  const r = denote(v('x'));
  if (r !== BOTTOM) throw new Error('Unbound should be ⊥');
});

// ============================================================
// Lambda and Application
// ============================================================

test('denote identity function', () => {
  const r = denote(app(lam('x', v('x')), lit.int(42)));
  if (r.value !== 42) throw new Error(`Expected 42`);
});

test('denote constant function', () => {
  const r = denote(app(app(lam('x', lam('y', v('x'))), lit.int(1)), lit.int(2)));
  if (r.value !== 1) throw new Error(`Expected 1`);
});

// ============================================================
// Arithmetic
// ============================================================

test('denote addition', () => {
  const r = denote(binop('+', lit.int(3), lit.int(4)));
  if (r.value !== 7) throw new Error(`Expected 7`);
});

test('denote division by zero is ⊥', () => {
  const r = denote(binop('/', lit.int(10), lit.int(0)));
  if (r !== BOTTOM) throw new Error('Div by zero should be ⊥');
});

// ============================================================
// Strictness — ⊥ propagation
// ============================================================

test('application of ⊥ is ⊥', () => {
  const r = denote(app(v('undefined'), lit.int(42)));
  if (r !== BOTTOM) throw new Error('⊥ applied should be ⊥');
});

test('arithmetic with ⊥ is ⊥', () => {
  const r = denote(binop('+', v('undefined'), lit.int(1)));
  if (r !== BOTTOM) throw new Error('⊥ + 1 should be ⊥');
});

// ============================================================
// If-then-else
// ============================================================

test('denote if true', () => {
  const r = denote(if_(lit.bool(true), lit.int(1), lit.int(2)));
  if (r.value !== 1) throw new Error(`Expected 1`);
});

test('denote if false', () => {
  const r = denote(if_(lit.bool(false), lit.int(1), lit.int(2)));
  if (r.value !== 2) throw new Error(`Expected 2`);
});

test('if with ⊥ condition is ⊥', () => {
  const r = denote(if_(v('undef'), lit.int(1), lit.int(2)));
  if (r !== BOTTOM) throw new Error('⊥ condition should be ⊥');
});

// ============================================================
// Let
// ============================================================

test('denote let', () => {
  const r = denote(let_('x', lit.int(5), binop('*', v('x'), v('x'))));
  if (r.value !== 25) throw new Error(`Expected 25`);
});

// ============================================================
// Pairs
// ============================================================

test('denote pair fst', () => {
  const r = denote(fst(pair(lit.int(1), lit.int(2))));
  if (r.value !== 1) throw new Error(`Expected 1`);
});

test('denote pair snd', () => {
  const r = denote(snd(pair(lit.int(1), lit.int(2))));
  if (r.value !== 2) throw new Error(`Expected 2`);
});

test('fst of non-pair is ⊥', () => {
  const r = denote(fst(lit.int(42)));
  if (r !== BOTTOM) throw new Error('fst of non-pair should be ⊥');
});

// ============================================================
// Fixed-point (recursion via denoteFix)
// ============================================================

test('factorial via fix', () => {
  // fix (λf.λn. if n==0 then 1 else n * f(n-1))
  const factBody = lam('f', lam('n',
    if_(binop('==', v('n'), lit.int(0)),
      lit.int(1),
      binop('*', v('n'), app(v('f'), binop('-', v('n'), lit.int(1)))))));
  const fact = fix(factBody);
  const r = denoteFix(fact);
  // Apply to 5
  if (r.tag !== 'fun') throw new Error('Expected function');
  const result = r.fn(new DInt(5));
  if (result.value !== 120) throw new Error(`Expected 120, got ${result.value}`);
});

test('fibonacci via fix', () => {
  const fibBody = lam('f', lam('n',
    if_(binop('<=', v('n'), lit.int(1)),
      v('n'),
      binop('+',
        app(v('f'), binop('-', v('n'), lit.int(1))),
        app(v('f'), binop('-', v('n'), lit.int(2)))))));
  const fib = fix(fibBody);
  const r = denoteFix(fib);
  const result = r.fn(new DInt(10));
  if (result.value !== 55) throw new Error(`Expected 55, got ${result.value}`);
});

// ============================================================
// Closures
// ============================================================

test('closure captures environment', () => {
  // let a = 10 in let f = λx.x+a in f 5
  const prog = let_('a', lit.int(10),
    let_('f', lam('x', binop('+', v('x'), v('a'))),
      app(v('f'), lit.int(5))));
  const r = denote(prog);
  if (r.value !== 15) throw new Error(`Expected 15`);
});

// ============================================================
// valEqual and valToString
// ============================================================

test('valEqual — ints', () => {
  if (!valEqual(new DInt(5), new DInt(5))) throw new Error('5 = 5');
  if (valEqual(new DInt(5), new DInt(6))) throw new Error('5 ≠ 6');
});

test('valEqual — bottom', () => {
  if (!valEqual(BOTTOM, BOTTOM)) throw new Error('⊥ = ⊥');
  if (valEqual(BOTTOM, new DInt(1))) throw new Error('⊥ ≠ 1');
});

test('valToString', () => {
  if (valToString(BOTTOM) !== '⊥') throw new Error('bottom');
  if (valToString(new DInt(42)) !== '42') throw new Error('int');
  if (valToString(new DBool(true)) !== 'true') throw new Error('bool');
});

run();
