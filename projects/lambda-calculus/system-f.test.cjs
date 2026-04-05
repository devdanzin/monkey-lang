const { test, run } = require('./test-runner.cjs');
const {
  Int, Bool, TypeVar, Arrow, Forall, typesEqual, typeSubst,
  TypeEnv, FTypeError, typeCheck, evaluate,
  lit, v, abs, app, tabs, tapp, if_, let_, binop,
} = require('./system-f.cjs');

// ============================================================
// Type Substitution
// ============================================================

test('typeSubst — simple', () => {
  const t = typeSubst(TypeVar('a'), 'a', Int);
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
});

test('typeSubst — arrow', () => {
  const t = typeSubst(Arrow(TypeVar('a'), TypeVar('a')), 'a', Int);
  if (!typesEqual(t, Arrow(Int, Int))) throw new Error(`Expected Int → Int`);
});

test('typeSubst — shadowed forall', () => {
  // ∀a.a should not be affected by substitution of a
  const t = typeSubst(Forall('a', TypeVar('a')), 'a', Int);
  if (!typesEqual(t, Forall('a', TypeVar('a')))) throw new Error('Shadowed, should not change');
});

// ============================================================
// Polymorphic Identity
// ============================================================

test('polymorphic identity — type', () => {
  // Λα.λx:α.x : ∀α.α → α
  const id = tabs('a', abs('x', TypeVar('a'), v('x')));
  const t = typeCheck(id);
  if (!typesEqual(t, Forall('a', Arrow(TypeVar('a'), TypeVar('a'))))) throw new Error(`Got: ${t}`);
});

test('polymorphic identity — instantiate to Int', () => {
  // (Λα.λx:α.x) [Int] : Int → Int
  const id = tabs('a', abs('x', TypeVar('a'), v('x')));
  const idInt = tapp(id, Int);
  const t = typeCheck(idInt);
  if (!typesEqual(t, Arrow(Int, Int))) throw new Error(`Expected Int → Int, got ${t}`);
});

test('polymorphic identity — apply', () => {
  // (Λα.λx:α.x) [Int] 42 : Int
  const id = tabs('a', abs('x', TypeVar('a'), v('x')));
  const result = app(tapp(id, Int), lit.int(42));
  const t = typeCheck(result);
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
  const r = evaluate(result);
  if (r.value !== 42) throw new Error(`Expected 42, got ${r.value}`);
});

// ============================================================
// Polymorphic Const
// ============================================================

test('polymorphic const (K combinator)', () => {
  // Λα.Λβ.λx:α.λy:β.x : ∀α.∀β.α → β → α
  const k = tabs('a', tabs('b', abs('x', TypeVar('a'), abs('y', TypeVar('b'), v('x')))));
  const t = typeCheck(k);
  const expected = Forall('a', Forall('b', Arrow(TypeVar('a'), Arrow(TypeVar('b'), TypeVar('a')))));
  if (!typesEqual(t, expected)) throw new Error(`Got: ${t}`);
});

test('polymorphic const — apply', () => {
  const k = tabs('a', tabs('b', abs('x', TypeVar('a'), abs('y', TypeVar('b'), v('x')))));
  const result = app(app(tapp(tapp(k, Int), Bool), lit.int(7)), lit.bool(true));
  const t = typeCheck(result);
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
  const r = evaluate(result);
  if (r.value !== 7) throw new Error(`Expected 7`);
});

// ============================================================
// Polymorphic apply
// ============================================================

test('polymorphic apply', () => {
  // Λα.Λβ.λf:(α→β).λx:α.f x : ∀α.∀β.(α→β) → α → β
  const apply = tabs('a', tabs('b',
    abs('f', Arrow(TypeVar('a'), TypeVar('b')),
      abs('x', TypeVar('a'),
        app(v('f'), v('x'))))));
  const t = typeCheck(apply);
  const expected = Forall('a', Forall('b', Arrow(Arrow(TypeVar('a'), TypeVar('b')), Arrow(TypeVar('a'), TypeVar('b')))));
  if (!typesEqual(t, expected)) throw new Error(`Got: ${t}`);
});

// ============================================================
// Type errors
// ============================================================

test('type error — tapp on non-forall', () => {
  try {
    typeCheck(tapp(lit.int(42), Int));
    throw new Error('Should throw');
  } catch (e) {
    if (!e.message.includes('∀')) throw e;
  }
});

test('type error — unbound type variable', () => {
  try {
    // λx:α.x — α not in scope
    typeCheck(abs('x', TypeVar('a'), v('x')));
    throw new Error('Should throw');
  } catch (e) {
    if (!e.message.includes('Unbound type')) throw e;
  }
});

// ============================================================
// Let-polymorphism (manual)
// ============================================================

test('let with polymorphic function', () => {
  // let id = Λα.λx:α.x in (id [Int] 42)
  const id = tabs('a', abs('x', TypeVar('a'), v('x')));
  const prog = let_('id', id, app(tapp(v('id'), Int), lit.int(42)));
  const t = typeCheck(prog);
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
  const r = evaluate(prog);
  if (r.value !== 42) throw new Error(`Expected 42`);
});

test('let polymorphism — use at multiple types', () => {
  // let id = Λα.λx:α.x in (id [Int] 42, id [Bool] true)
  // We'll test id [Bool] true
  const id = tabs('a', abs('x', TypeVar('a'), v('x')));
  const useBool = let_('id', id, app(tapp(v('id'), Bool), lit.bool(true)));
  const t = typeCheck(useBool);
  if (!typesEqual(t, Bool)) throw new Error(`Expected Bool`);
  const r = evaluate(useBool);
  if (r.value !== true) throw new Error(`Expected true`);
});

// ============================================================
// Church Encodings in System F
// ============================================================

test('Church numeral zero in System F', () => {
  // Λα.λf:(α→α).λx:α.x : ∀α.(α→α) → α → α
  const zero = tabs('a', abs('f', Arrow(TypeVar('a'), TypeVar('a')), abs('x', TypeVar('a'), v('x'))));
  const t = typeCheck(zero);
  const nat = Forall('a', Arrow(Arrow(TypeVar('a'), TypeVar('a')), Arrow(TypeVar('a'), TypeVar('a'))));
  if (!typesEqual(t, nat)) throw new Error(`Got: ${t}`);
});

test('Church succ in System F', () => {
  const nat = Forall('a', Arrow(Arrow(TypeVar('a'), TypeVar('a')), Arrow(TypeVar('a'), TypeVar('a'))));
  // Λα.λf:(α→α).λx:α.f x  (this is Church 1)
  const one = tabs('a', abs('f', Arrow(TypeVar('a'), TypeVar('a')), abs('x', TypeVar('a'), app(v('f'), v('x')))));
  const t = typeCheck(one);
  if (!typesEqual(t, nat)) throw new Error(`Church 1 type wrong: ${t}`);
});

// ============================================================
// Forall toString
// ============================================================

test('forall toString', () => {
  const s = Forall('a', Arrow(TypeVar('a'), TypeVar('a'))).toString();
  if (s !== '∀a.a → a') throw new Error(`Got: ${s}`);
});

test('nested forall toString', () => {
  const s = Forall('a', Forall('b', Arrow(TypeVar('a'), TypeVar('b')))).toString();
  if (s !== '∀a.∀b.a → b') throw new Error(`Got: ${s}`);
});

// ============================================================
// Composition
// ============================================================

test('polymorphic compose', () => {
  // Λα.Λβ.Λγ.λf:(β→γ).λg:(α→β).λx:α.f (g x)
  const compose = tabs('a', tabs('b', tabs('c',
    abs('f', Arrow(TypeVar('b'), TypeVar('c')),
      abs('g', Arrow(TypeVar('a'), TypeVar('b')),
        abs('x', TypeVar('a'),
          app(v('f'), app(v('g'), v('x')))))))));
  const t = typeCheck(compose);
  // ∀a.∀b.∀c.(b→c) → (a→b) → a → c
  if (t.tag !== 'forall' || t.tvar !== 'a') throw new Error('Bad compose type');
  if (t.body.tag !== 'forall' || t.body.tvar !== 'b') throw new Error('Bad compose type');
});

// ============================================================
// Evaluation of polymorphic programs
// ============================================================

test('evaluate polymorphic double', () => {
  // let double = Λα.λf:(α→α).λx:α.f (f x) in double [Int] (λn:Int.n+1) 0
  const double = tabs('a',
    abs('f', Arrow(TypeVar('a'), TypeVar('a')),
      abs('x', TypeVar('a'),
        app(v('f'), app(v('f'), v('x'))))));
  const incr = abs('n', Int, binop('+', v('n'), lit.int(1)));
  const prog = let_('double', double,
    app(app(tapp(v('double'), Int), incr), lit.int(0)));
  const t = typeCheck(prog);
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
  const r = evaluate(prog);
  if (r.value !== 2) throw new Error(`Expected 2, got ${r.value}`);
});

test('evaluate flip in System F', () => {
  // Λα.Λβ.Λγ.λf:(α→β→γ).λb:β.λa:α.f a b
  const flip = tabs('a', tabs('b', tabs('c',
    abs('f', Arrow(TypeVar('a'), Arrow(TypeVar('b'), TypeVar('c'))),
      abs('y', TypeVar('b'),
        abs('x', TypeVar('a'),
          app(app(v('f'), v('x')), v('y'))))))));
  // sub = λa:Int.λb:Int.a-b
  const sub = abs('a', Int, abs('b', Int, binop('-', v('a'), v('b'))));
  // flip [Int] [Int] [Int] sub 3 10 should be 10-3 = 7
  const prog = app(app(app(tapp(tapp(tapp(flip, Int), Int), Int), sub), lit.int(3)), lit.int(10));
  const t = typeCheck(prog);
  if (!typesEqual(t, Int)) throw new Error(`Expected Int`);
  const r = evaluate(prog);
  if (r.value !== 7) throw new Error(`Expected 7, got ${r.value}`);
});

run();
