const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  Var, And, Or, Implies, Not, Bottom, Top,
  propEqual, propToString, parseProp,
  ProofContext,
  truthTable, evalProp, isTautology, isContradiction, isSatisfiable,
} = require('../src/index.js');

const P = Var('P'), Q = Var('Q'), R = Var('R');

// ==================== Proposition Basics ====================

test('propEqual', () => {
  assert.ok(propEqual(And(P, Q), And(P, Q)));
  assert.ok(!propEqual(And(P, Q), And(Q, P)));
  assert.ok(propEqual(Not(P), Not(P)));
  assert.ok(propEqual(Implies(P, Q), Implies(P, Q)));
});

test('propToString', () => {
  assert.equal(propToString(And(P, Q)), '(P ∧ Q)');
  assert.equal(propToString(Or(P, Q)), '(P ∨ Q)');
  assert.equal(propToString(Implies(P, Q)), '(P → Q)');
  assert.equal(propToString(Not(P)), '¬P');
  assert.equal(propToString(Bottom()), '⊥');
});

test('parseProp', () => {
  assert.ok(propEqual(parseProp('P & Q'), And(P, Q)));
  assert.ok(propEqual(parseProp('P | Q'), Or(P, Q)));
  assert.ok(propEqual(parseProp('P -> Q'), Implies(P, Q)));
  assert.ok(propEqual(parseProp('~P'), Not(P)));
  assert.ok(propEqual(parseProp('P & Q -> R'), Implies(And(P, Q), R)));
});

// ==================== Truth Table / Semantics ====================

test('truthTable basic', () => {
  const tt = truthTable(And(P, Q));
  assert.equal(tt.rows.length, 4);
  // Only T&T = T
  assert.equal(tt.rows.filter(r => r.value).length, 1);
});

test('isTautology', () => {
  assert.ok(isTautology(Or(P, Not(P)))); // P ∨ ¬P (LEM)
  assert.ok(isTautology(Implies(P, P))); // P → P
  assert.ok(!isTautology(P));
});

test('isContradiction', () => {
  assert.ok(isContradiction(And(P, Not(P)))); // P ∧ ¬P
  assert.ok(!isContradiction(P));
});

test('isSatisfiable', () => {
  assert.ok(isSatisfiable(P));
  assert.ok(isSatisfiable(And(P, Q)));
  assert.ok(!isSatisfiable(And(P, Not(P))));
});

test('implies truth table', () => {
  const tt = truthTable(Implies(P, Q));
  // P→Q is false only when P=T, Q=F
  const falseRows = tt.rows.filter(r => !r.value);
  assert.equal(falseRows.length, 1);
  assert.ok(falseRows[0].assignment.P === true && falseRows[0].assignment.Q === false);
});

// ==================== Natural Deduction Proofs ====================

test('∧-Introduction: from P and Q, derive P ∧ Q', () => {
  const ctx = new ProofContext();
  const p = ctx.assume(P);
  const q = ctx.assume(Q);
  // Note: we have two open assumptions - discharge in order
  const pAndQ = ctx.andIntro(p, q);

  // Discharge Q assumption
  const qImpliesPQ = ctx.impliesIntro(q, pAndQ);
  // Discharge P assumption
  const pImpliesQImpliesPQ = ctx.impliesIntro(p, qImpliesPQ);

  const result = ctx.qed();
  // P → (Q → (P ∧ Q))
  assert.ok(propEqual(result, Implies(P, Implies(Q, And(P, Q)))));
});

test('∧-Elimination: from P ∧ Q, derive P and Q', () => {
  const ctx = new ProofContext();
  const pq = ctx.assume(And(P, Q));
  const p = ctx.andElimL(pq);
  const q = ctx.andElimR(pq);
  // Derive Q ∧ P (swap)
  const qp = ctx.andIntro(q, p);
  const result = ctx.impliesIntro(pq, qp);
  assert.ok(propEqual(ctx.qed(), Implies(And(P, Q), And(Q, P))));
});

test('→-Elimination (Modus Ponens)', () => {
  const ctx = new ProofContext();
  const impl = ctx.assume(Implies(P, Q));
  const p = ctx.assume(P);
  const q = ctx.impliesElim(impl, p);
  const pImpliesQ = ctx.impliesIntro(p, q);
  const full = ctx.impliesIntro(impl, pImpliesQ);
  // (P → Q) → P → Q
  assert.ok(propEqual(ctx.qed(), Implies(Implies(P, Q), Implies(P, Q))));
});

test('¬-Elimination: from P and ¬P, derive ⊥', () => {
  const ctx = new ProofContext();
  const p = ctx.assume(P);
  const notP = ctx.assume(Not(P));
  const bot = ctx.notElim(p, notP);
  assert.ok(propEqual(ctx.steps[bot].prop, Bottom()));
  // Discharge both assumptions
  const notPImpliesBot = ctx.impliesIntro(notP, bot);
  ctx.impliesIntro(p, notPImpliesBot);
  assert.ok(ctx.qed()); // P → ¬P → ⊥
});

test('⊥-Elimination (ex falso)', () => {
  const ctx = new ProofContext();
  const bot = ctx.assume(Bottom());
  const anything = ctx.bottomElim(bot, Var('ANYTHING'));
  ctx.impliesIntro(bot, anything);
  // ⊥ → ANYTHING
  assert.ok(propEqual(ctx.qed(), Implies(Bottom(), Var('ANYTHING'))));
});

test('hypothetical syllogism: (P→Q) → (Q→R) → (P→R)', () => {
  const ctx = new ProofContext();
  const pq = ctx.assume(Implies(P, Q));    // 0: assume P→Q
  const qr = ctx.assume(Implies(Q, R));    // 1: assume Q→R
  const p = ctx.assume(P);                 // 2: assume P
  const q = ctx.impliesElim(pq, p);        // 3: Q (by →E on 0, 2)
  const r = ctx.impliesElim(qr, q);        // 4: R (by →E on 1, 3)
  ctx.impliesIntro(p, r);                  // 5: P → R (discharge P)
  ctx.impliesIntro(qr, 5);                 // 6: (Q→R) → (P→R) (discharge Q→R)
  ctx.impliesIntro(pq, 6);                 // 7: (P→Q) → (Q→R) → (P→R) (discharge P→Q)
  
  const result = ctx.qed();
  assert.ok(propEqual(result, Implies(Implies(P, Q), Implies(Implies(Q, R), Implies(P, R)))));
});

test('∨-Introduction', () => {
  const ctx = new ProofContext();
  const p = ctx.assume(P);
  const pOrQ = ctx.orIntroL(p, Q);
  ctx.impliesIntro(p, pOrQ);
  assert.ok(propEqual(ctx.qed(), Implies(P, Or(P, Q))));
});

test('double negation elimination', () => {
  const ctx = new ProofContext();
  const nn = ctx.assume(Not(Not(P)));
  const p = ctx.dne(nn);
  ctx.impliesIntro(nn, p);
  assert.ok(propEqual(ctx.qed(), Implies(Not(Not(P)), P)));
});

test('proof toString shows formatted proof', () => {
  const ctx = new ProofContext();
  const p = ctx.assume(P);
  const q = ctx.assume(Q);
  ctx.andIntro(p, q);
  const str = ctx.toString();
  assert.ok(str.includes('Assume'));
  assert.ok(str.includes('∧I'));
});

test('error on unclosed assumption', () => {
  const ctx = new ProofContext();
  ctx.assume(P);
  assert.throws(() => ctx.qed(), /Unclosed assumptions/);
});

test('error on non-conjunction and-elim', () => {
  const ctx = new ProofContext();
  const p = ctx.assume(P);
  assert.throws(() => ctx.andElimL(p), /not a conjunction/);
});

test('error on antecedent mismatch in →E', () => {
  const ctx = new ProofContext();
  const impl = ctx.assume(Implies(P, Q));
  const r = ctx.assume(R);
  assert.throws(() => ctx.impliesElim(impl, r), /Antecedent mismatch/);
});

test('de Morgan: ¬(P ∧ Q) is satisfiable when P or Q is false', () => {
  const deMorgan = Not(And(P, Q));
  assert.ok(isSatisfiable(deMorgan));
  const tt = truthTable(deMorgan);
  assert.equal(tt.rows.filter(r => r.value).length, 3);
});

test('material equivalence: (P→Q) ∧ (Q→P) iff P↔Q semantics', () => {
  const biconditional = And(Implies(P, Q), Implies(Q, P));
  const tt = truthTable(biconditional);
  // True when P and Q have same value
  const trueRows = tt.rows.filter(r => r.value);
  assert.equal(trueRows.length, 2);
  assert.ok(trueRows.every(r => r.assignment.P === r.assignment.Q));
});
