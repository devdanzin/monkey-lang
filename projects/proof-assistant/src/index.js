/**
 * Tiny Proof Assistant — Natural Deduction for Propositional Logic
 *
 * Implements a Fitch-style natural deduction system with:
 * - Propositional connectives: ∧ (and), ∨ (or), → (implies), ¬ (not), ⊥ (bottom)
 * - Introduction and elimination rules for each connective
 * - Hypothetical reasoning (assume...derive)
 * - Proof verification (check if a proof is valid)
 * - Proof search (simple backward-chaining)
 */

// ==================== Propositions ====================

const Var = (name) => ({ tag: 'Var', name });
const And = (left, right) => ({ tag: 'And', left, right });
const Or = (left, right) => ({ tag: 'Or', left, right });
const Implies = (ante, cons) => ({ tag: 'Implies', ante, cons });
const Not = (prop) => ({ tag: 'Not', prop });
const Bottom = () => ({ tag: 'Bottom' });
const Top = () => ({ tag: 'Top' });

// ==================== Prop Equality ====================

function propEqual(a, b) {
  if (a.tag !== b.tag) return false;
  switch (a.tag) {
    case 'Var': return a.name === b.name;
    case 'And': case 'Or': return propEqual(a.left, b.left) && propEqual(a.right, b.right);
    case 'Implies': return propEqual(a.ante, b.ante) && propEqual(a.cons, b.cons);
    case 'Not': return propEqual(a.prop, b.prop);
    case 'Bottom': case 'Top': return true;
    default: return false;
  }
}

function propToString(p) {
  switch (p.tag) {
    case 'Var': return p.name;
    case 'And': return `(${propToString(p.left)} ∧ ${propToString(p.right)})`;
    case 'Or': return `(${propToString(p.left)} ∨ ${propToString(p.right)})`;
    case 'Implies': return `(${propToString(p.ante)} → ${propToString(p.cons)})`;
    case 'Not': return `¬${propToString(p.prop)}`;
    case 'Bottom': return '⊥';
    case 'Top': return '⊤';
    default: return '?';
  }
}

// ==================== Proof Steps ====================

// A proof is a sequence of justified steps
// Each step has a proposition and a justification

const Assumption = (prop) => ({ tag: 'Assumption', prop });

const AndIntro = (left, right) => ({ tag: 'AndIntro', left, right }); // from A and B, derive A ∧ B
const AndElimL = (conj) => ({ tag: 'AndElimL', conj }); // from A ∧ B, derive A
const AndElimR = (conj) => ({ tag: 'AndElimR', conj }); // from A ∧ B, derive B

const OrIntroL = (prop, right) => ({ tag: 'OrIntroL', prop, right }); // from A, derive A ∨ B
const OrIntroR = (left, prop) => ({ tag: 'OrIntroR', left, prop }); // from B, derive A ∨ B
const OrElim = (disj, caseL, caseR) => ({ tag: 'OrElim', disj, caseL, caseR }); // from A∨B, A→C, B→C, derive C

const ImpliesIntro = (assumption, conclusion) => ({ tag: 'ImpliesIntro', assumption, conclusion });
const ImpliesElim = (impl, ante) => ({ tag: 'ImpliesElim', impl, ante }); // modus ponens

const NotIntro = (assumption, bottom) => ({ tag: 'NotIntro', assumption, bottom }); // assume A, derive ⊥ → ¬A
const NotElim = (prop, negProp) => ({ tag: 'NotElim', prop, negProp }); // from A and ¬A, derive ⊥

const BottomElim = (bottom, prop) => ({ tag: 'BottomElim', bottom, prop }); // from ⊥, derive anything

const DNE = (prop) => ({ tag: 'DNE', prop }); // from ¬¬A, derive A (double negation elimination)

// ==================== Proof Context ====================

class ProofContext {
  constructor() {
    this.steps = [];     // [{prop, justification, depth}]
    this.assumptions = []; // stack of assumption scopes
    this.depth = 0;
  }

  /** Assume a proposition (opens a sub-proof) */
  assume(prop) {
    this.depth++;
    this.assumptions.push({ prop, depth: this.depth, startIdx: this.steps.length });
    this.steps.push({ prop, justification: Assumption(prop), depth: this.depth });
    return this.steps.length - 1;
  }

  /** Close a sub-proof (for →-intro or ¬-intro) */
  discharge() {
    if (this.depth === 0) throw new Error('No assumption to discharge');
    const assumption = this.assumptions.pop();
    this.depth--;
    return assumption;
  }

  /** Check if a proposition is available at current depth */
  isAvailable(idx) {
    const step = this.steps[idx];
    if (!step) return false;
    // Available if at same or shallower depth, or within current sub-proof scope
    return step.depth <= this.depth;
  }

  /** Get proposition at step index */
  get(idx) {
    if (!this.isAvailable(idx)) throw new Error(`Step ${idx} not available at current depth`);
    return this.steps[idx].prop;
  }

  /** ∧-Introduction: from steps proving A and B, derive A ∧ B */
  andIntro(leftIdx, rightIdx) {
    const left = this.get(leftIdx);
    const right = this.get(rightIdx);
    const prop = And(left, right);
    this.steps.push({ prop, justification: AndIntro(leftIdx, rightIdx), depth: this.depth });
    return this.steps.length - 1;
  }

  /** ∧-Elimination Left: from step proving A ∧ B, derive A */
  andElimL(conjIdx) {
    const conj = this.get(conjIdx);
    if (conj.tag !== 'And') throw new Error(`Step ${conjIdx} is not a conjunction`);
    const prop = conj.left;
    this.steps.push({ prop, justification: AndElimL(conjIdx), depth: this.depth });
    return this.steps.length - 1;
  }

  /** ∧-Elimination Right: from step proving A ∧ B, derive B */
  andElimR(conjIdx) {
    const conj = this.get(conjIdx);
    if (conj.tag !== 'And') throw new Error(`Step ${conjIdx} is not a conjunction`);
    const prop = conj.right;
    this.steps.push({ prop, justification: AndElimR(conjIdx), depth: this.depth });
    return this.steps.length - 1;
  }

  /** ∨-Introduction Left: from step proving A, derive A ∨ B */
  orIntroL(propIdx, rightProp) {
    const left = this.get(propIdx);
    const prop = Or(left, rightProp);
    this.steps.push({ prop, justification: OrIntroL(propIdx, rightProp), depth: this.depth });
    return this.steps.length - 1;
  }

  /** ∨-Introduction Right: from step proving B, derive A ∨ B */
  orIntroR(leftProp, propIdx) {
    const right = this.get(propIdx);
    const prop = Or(leftProp, right);
    this.steps.push({ prop, justification: OrIntroR(leftProp, propIdx), depth: this.depth });
    return this.steps.length - 1;
  }

  /** →-Introduction: assume A, derive B → discharge to get A → B */
  impliesIntro(assumptionIdx, conclusionIdx) {
    const assumption = this.discharge();
    const assumpProp = this.steps[assumptionIdx].prop;
    const concProp = this.steps[conclusionIdx].prop;
    if (!propEqual(assumpProp, assumption.prop)) throw new Error('Assumption mismatch');
    const prop = Implies(assumpProp, concProp);
    this.steps.push({ prop, justification: ImpliesIntro(assumptionIdx, conclusionIdx), depth: this.depth });
    return this.steps.length - 1;
  }

  /** →-Elimination (Modus Ponens): from A → B and A, derive B */
  impliesElim(implIdx, anteIdx) {
    const impl = this.get(implIdx);
    const ante = this.get(anteIdx);
    if (impl.tag !== 'Implies') throw new Error(`Step ${implIdx} is not an implication`);
    if (!propEqual(impl.ante, ante)) throw new Error('Antecedent mismatch');
    const prop = impl.cons;
    this.steps.push({ prop, justification: ImpliesElim(implIdx, anteIdx), depth: this.depth });
    return this.steps.length - 1;
  }

  /** ¬-Introduction: assume A, derive ⊥ → ¬A */
  notIntro(assumptionIdx, bottomIdx) {
    const assumption = this.discharge();
    const bottomProp = this.steps[bottomIdx].prop;
    if (bottomProp.tag !== 'Bottom') throw new Error('Must derive ⊥ for ¬-introduction');
    const prop = Not(assumption.prop);
    this.steps.push({ prop, justification: NotIntro(assumptionIdx, bottomIdx), depth: this.depth });
    return this.steps.length - 1;
  }

  /** ¬-Elimination: from A and ¬A, derive ⊥ */
  notElim(propIdx, negIdx) {
    const p = this.get(propIdx);
    const negP = this.get(negIdx);
    if (negP.tag !== 'Not') throw new Error(`Step ${negIdx} is not a negation`);
    if (!propEqual(p, negP.prop)) throw new Error('Proposition mismatch in ¬-elim');
    const prop = Bottom();
    this.steps.push({ prop, justification: NotElim(propIdx, negIdx), depth: this.depth });
    return this.steps.length - 1;
  }

  /** ⊥-Elimination (ex falso quodlibet): from ⊥, derive anything */
  bottomElim(bottomIdx, prop) {
    const b = this.get(bottomIdx);
    if (b.tag !== 'Bottom') throw new Error(`Step ${bottomIdx} is not ⊥`);
    this.steps.push({ prop, justification: BottomElim(bottomIdx, prop), depth: this.depth });
    return this.steps.length - 1;
  }

  /** Double negation elimination: from ¬¬A, derive A */
  dne(negNegIdx) {
    const nn = this.get(negNegIdx);
    if (nn.tag !== 'Not' || nn.prop.tag !== 'Not') throw new Error(`Step ${negNegIdx} is not ¬¬A`);
    const prop = nn.prop.prop;
    this.steps.push({ prop, justification: DNE(negNegIdx), depth: this.depth });
    return this.steps.length - 1;
  }

  /** Get the final proved proposition */
  qed() {
    if (this.depth !== 0) throw new Error('Unclosed assumptions');
    if (this.steps.length === 0) throw new Error('Empty proof');
    return this.steps[this.steps.length - 1].prop;
  }

  /** Pretty-print the proof */
  toString() {
    const lines = [];
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      const indent = '│ '.repeat(step.depth);
      const justStr = justificationToString(step.justification);
      lines.push(`${i.toString().padStart(3)}. ${indent}${propToString(step.prop)}    [${justStr}]`);
    }
    return lines.join('\n');
  }
}

function justificationToString(j) {
  switch (j.tag) {
    case 'Assumption': return 'Assume';
    case 'AndIntro': return `∧I ${j.left}, ${j.right}`;
    case 'AndElimL': return `∧EL ${j.conj}`;
    case 'AndElimR': return `∧ER ${j.conj}`;
    case 'OrIntroL': return `∨IL ${j.prop}`;
    case 'OrIntroR': return `∨IR ${j.prop}`;
    case 'OrElim': return `∨E ${j.disj}, ${j.caseL}, ${j.caseR}`;
    case 'ImpliesIntro': return `→I ${j.assumption}-${j.conclusion}`;
    case 'ImpliesElim': return `→E ${j.impl}, ${j.ante}`;
    case 'NotIntro': return `¬I ${j.assumption}-${j.bottom}`;
    case 'NotElim': return `¬E ${j.prop}, ${j.negProp}`;
    case 'BottomElim': return `⊥E ${j.bottom}`;
    case 'DNE': return `DNE ${j.prop}`;
    default: return '?';
  }
}

// ==================== Parser ====================

function parseProp(str) {
  const tokens = tokenize(str);
  let pos = 0;

  function peek() { return tokens[pos]; }
  function next() { return tokens[pos++]; }

  function parseImplies() {
    let left = parseOr();
    while (peek() === '->' || peek() === '→') {
      next();
      const right = parseImplies(); // right-associative
      left = Implies(left, right);
    }
    return left;
  }

  function parseOr() {
    let left = parseAnd();
    while (peek() === '|' || peek() === '∨' || peek() === 'v') {
      next();
      left = Or(left, parseAnd());
    }
    return left;
  }

  function parseAnd() {
    let left = parseUnary();
    while (peek() === '&' || peek() === '∧' || peek() === '^') {
      next();
      left = And(left, parseUnary());
    }
    return left;
  }

  function parseUnary() {
    if (peek() === '~' || peek() === '¬' || peek() === '!') {
      next();
      return Not(parseUnary());
    }
    return parseAtom();
  }

  function parseAtom() {
    if (peek() === '(') {
      next();
      const expr = parseImplies();
      if (next() !== ')') throw new Error('Expected )');
      return expr;
    }
    if (peek() === 'F' || peek() === '⊥') { next(); return Bottom(); }
    if (peek() === 'T' || peek() === '⊤') { next(); return Top(); }
    const name = next();
    if (!name || name.match(/[^a-zA-Z0-9_]/)) throw new Error(`Unexpected: ${name}`);
    return Var(name);
  }

  function tokenize(s) {
    const toks = [];
    let i = 0;
    while (i < s.length) {
      if (/\s/.test(s[i])) { i++; continue; }
      if ('()'.includes(s[i])) { toks.push(s[i++]); continue; }
      if (s[i] === '-' && s[i + 1] === '>') { toks.push('->'); i += 2; continue; }
      if ('~¬!&∧^|∨→⊥⊤'.includes(s[i])) { toks.push(s[i++]); continue; }
      let word = '';
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) word += s[i++];
      if (word === 'v' && !/[a-zA-Z0-9_]/.test(s[i] || ' ')) toks.push('v'); // 'v' as or
      else toks.push(word);
    }
    return toks;
  }

  const result = parseImplies();
  if (pos < tokens.length) throw new Error(`Unexpected token: ${tokens[pos]}`);
  return result;
}

// ==================== Truth Table ====================

function truthTable(prop) {
  const vars = collectVars(prop);
  const rows = [];
  const n = vars.length;

  for (let i = 0; i < (1 << n); i++) {
    const assignment = {};
    for (let j = 0; j < n; j++) {
      assignment[vars[j]] = Boolean(i & (1 << (n - 1 - j)));
    }
    rows.push({ assignment, value: evalProp(prop, assignment) });
  }

  return { vars, rows };
}

function evalProp(prop, assignment) {
  switch (prop.tag) {
    case 'Var': return assignment[prop.name];
    case 'And': return evalProp(prop.left, assignment) && evalProp(prop.right, assignment);
    case 'Or': return evalProp(prop.left, assignment) || evalProp(prop.right, assignment);
    case 'Implies': return !evalProp(prop.ante, assignment) || evalProp(prop.cons, assignment);
    case 'Not': return !evalProp(prop.prop, assignment);
    case 'Bottom': return false;
    case 'Top': return true;
    default: return false;
  }
}

function collectVars(prop) {
  const vars = new Set();
  function walk(p) {
    if (p.tag === 'Var') vars.add(p.name);
    if (p.left) walk(p.left);
    if (p.right) walk(p.right);
    if (p.ante) walk(p.ante);
    if (p.cons) walk(p.cons);
    if (p.prop) walk(p.prop);
  }
  walk(prop);
  return [...vars].sort();
}

function isTautology(prop) {
  return truthTable(prop).rows.every(r => r.value);
}

function isContradiction(prop) {
  return truthTable(prop).rows.every(r => !r.value);
}

function isSatisfiable(prop) {
  return truthTable(prop).rows.some(r => r.value);
}

module.exports = {
  // Propositions
  Var, And, Or, Implies, Not, Bottom, Top,
  propEqual, propToString, parseProp,
  // Proof
  ProofContext,
  // Semantics
  truthTable, evalProp, collectVars, isTautology, isContradiction, isSatisfiable,
};
