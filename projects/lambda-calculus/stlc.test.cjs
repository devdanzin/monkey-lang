const { test, run } = require('./test-runner.cjs');
const {
  Int, Bool, Unit, Arrow, typesEqual, TypeError,
  typeCheck, evaluate, TypeEnv,
  lit, v, abs, app, if_, let_, binop,
} = require('./stlc.cjs');

// ============================================================
// Type equality
// ============================================================

test('typesEqual — same primitive', () => {
  if (!typesEqual(Int, Int)) throw new Error('Int = Int');
  if (!typesEqual(Bool, Bool)) throw new Error('Bool = Bool');
});

test('typesEqual — different primitive', () => {
  if (typesEqual(Int, Bool)) throw new Error('Int ≠ Bool');
});

test('typesEqual — arrow', () => {
  if (!typesEqual(Arrow(Int, Bool), Arrow(Int, Bool))) throw new Error('Same arrow');
  if (typesEqual(Arrow(Int, Bool), Arrow(Bool, Int))) throw new Error('Different arrow');
});

// ============================================================
// Literals
// ============================================================

test('typeCheck literal int', () => {
  const t = typeCheck(lit.int(42));
  if (!typesEqual(t, Int)) throw new Error(`Expected Int, got ${t}`);
});

test('typeCheck literal bool', () => {
  const t = typeCheck(lit.bool(true));
  if (!typesEqual(t, Bool)) throw new Error(`Expected Bool, got ${t}`);
});

// ============================================================
// Variables
// ============================================================

test('typeCheck bound variable', () => {
  const env = new TypeEnv().extend('x', Int);
  const t = typeCheck(v('x'), env);
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

test('typeCheck unbound variable throws', () => {
  try {
    typeCheck(v('x'));
    throw new Error('Should have thrown');
  } catch (e) {
    if (!e.message.includes('Unbound')) throw e;
  }
});

// ============================================================
// Abstraction
// ============================================================

test('typeCheck identity function', () => {
  // λx:Int.x : Int → Int
  const t = typeCheck(abs('x', Int, v('x')));
  if (!typesEqual(t, Arrow(Int, Int))) throw new Error(`Expected Int → Int, got ${t}`);
});

test('typeCheck constant function', () => {
  // λx:Int.λy:Bool.x : Int → Bool → Int
  const t = typeCheck(abs('x', Int, abs('y', Bool, v('x'))));
  if (!typesEqual(t, Arrow(Int, Arrow(Bool, Int)))) throw new Error(`Expected Int → Bool → Int`);
});

// ============================================================
// Application
// ============================================================

test('typeCheck application', () => {
  // (λx:Int.x) 42 : Int
  const t = typeCheck(app(abs('x', Int, v('x')), lit.int(42)));
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

test('typeCheck application type mismatch', () => {
  try {
    // (λx:Int.x) true — type error
    typeCheck(app(abs('x', Int, v('x')), lit.bool(true)));
    throw new Error('Should have thrown');
  } catch (e) {
    if (!e.message.includes('mismatch')) throw e;
  }
});

test('typeCheck non-function application', () => {
  try {
    // 42 true — not a function
    typeCheck(app(lit.int(42), lit.bool(true)));
    throw new Error('Should have thrown');
  } catch (e) {
    if (!e.message.includes('function type')) throw e;
  }
});

// ============================================================
// If-then-else
// ============================================================

test('typeCheck if', () => {
  const t = typeCheck(if_(lit.bool(true), lit.int(1), lit.int(2)));
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

test('typeCheck if non-bool condition', () => {
  try {
    typeCheck(if_(lit.int(1), lit.int(2), lit.int(3)));
    throw new Error('Should have thrown');
  } catch (e) {
    if (!e.message.includes('Bool')) throw e;
  }
});

test('typeCheck if branch mismatch', () => {
  try {
    typeCheck(if_(lit.bool(true), lit.int(1), lit.bool(false)));
    throw new Error('Should have thrown');
  } catch (e) {
    if (!e.message.includes('same type')) throw e;
  }
});

// ============================================================
// Let
// ============================================================

test('typeCheck let', () => {
  // let x = 42 in x + 1
  const t = typeCheck(let_('x', lit.int(42), binop('+', v('x'), lit.int(1))));
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

test('typeCheck let with function', () => {
  // let f = λx:Int.x in f 42
  const t = typeCheck(let_('f', abs('x', Int, v('x')), app(v('f'), lit.int(42))));
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

// ============================================================
// Binary operators
// ============================================================

test('typeCheck arithmetic', () => {
  const t = typeCheck(binop('+', lit.int(1), lit.int(2)));
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

test('typeCheck arithmetic type error', () => {
  try {
    typeCheck(binop('+', lit.int(1), lit.bool(true)));
    throw new Error('Should have thrown');
  } catch (e) {
    if (!e.message.includes('Int')) throw e;
  }
});

test('typeCheck comparison', () => {
  const t = typeCheck(binop('<', lit.int(1), lit.int(2)));
  if (!typesEqual(t, Bool)) throw new Error(`Expected Bool`);
});

test('typeCheck logic', () => {
  const t = typeCheck(binop('&&', lit.bool(true), lit.bool(false)));
  if (!typesEqual(t, Bool)) throw new Error(`Expected Bool`);
});

// ============================================================
// Higher-order functions
// ============================================================

test('typeCheck higher-order: apply', () => {
  // λf:(Int→Int).λx:Int.f x : (Int→Int) → Int → Int
  const t = typeCheck(abs('f', Arrow(Int, Int), abs('x', Int, app(v('f'), v('x')))));
  if (!typesEqual(t, Arrow(Arrow(Int, Int), Arrow(Int, Int)))) throw new Error(`Bad type`);
});

test('typeCheck compose', () => {
  // λf:(Int→Int).λg:(Int→Int).λx:Int.f (g x)
  const t = typeCheck(
    abs('f', Arrow(Int, Int),
      abs('g', Arrow(Int, Int),
        abs('x', Int,
          app(v('f'), app(v('g'), v('x'))))))
  );
  const expected = Arrow(Arrow(Int, Int), Arrow(Arrow(Int, Int), Arrow(Int, Int)));
  if (!typesEqual(t, expected)) throw new Error(`Bad compose type`);
});

// ============================================================
// Evaluation
// ============================================================

test('evaluate literal', () => {
  const r = evaluate(lit.int(42));
  if (r.value !== 42) throw new Error(`Expected 42`);
});

test('evaluate arithmetic', () => {
  const r = evaluate(binop('+', lit.int(3), lit.int(4)));
  if (r.value !== 7) throw new Error(`Expected 7`);
});

test('evaluate function application', () => {
  const r = evaluate(app(abs('x', Int, binop('*', v('x'), v('x'))), lit.int(5)));
  if (r.value !== 25) throw new Error(`Expected 25, got ${r.value}`);
});

test('evaluate if-then-else', () => {
  const r = evaluate(if_(binop('<', lit.int(1), lit.int(2)), lit.int(10), lit.int(20)));
  if (r.value !== 10) throw new Error(`Expected 10`);
});

test('evaluate let', () => {
  const r = evaluate(let_('x', lit.int(5), binop('+', v('x'), v('x'))));
  if (r.value !== 10) throw new Error(`Expected 10`);
});

test('evaluate higher-order', () => {
  // let double = λx:Int.x*2 in let apply = λf:(Int→Int).λx:Int.f x in apply double 5
  const double = abs('x', Int, binop('*', v('x'), lit.int(2)));
  const apply_ = abs('f', Arrow(Int, Int), abs('x', Int, app(v('f'), v('x'))));
  const prog = let_('double', double, let_('apply', apply_, app(app(v('apply'), v('double')), lit.int(5))));
  const r = evaluate(prog);
  if (r.value !== 10) throw new Error(`Expected 10, got ${r.value}`);
});

// ============================================================
// Type safety: well-typed programs don't go wrong
// ============================================================

test('type check then evaluate — consistent', () => {
  const prog = let_('f', abs('x', Int, binop('+', v('x'), lit.int(1))),
    app(v('f'), lit.int(41)));
  const t = typeCheck(prog);
  if (!typesEqual(t, Int)) throw new Error(`Type: ${t}`);
  const r = evaluate(prog);
  if (r.value !== 42) throw new Error(`Value: ${r.value}`);
});

// ============================================================
// Type toString
// ============================================================

test('arrow type toString', () => {
  const s = Arrow(Int, Arrow(Bool, Int)).toString();
  if (s !== 'Int → Bool → Int') throw new Error(`Got: ${s}`);
});

test('nested arrow toString', () => {
  const s = Arrow(Arrow(Int, Bool), Int).toString();
  if (s !== '(Int → Bool) → Int') throw new Error(`Got: ${s}`);
});

run();
