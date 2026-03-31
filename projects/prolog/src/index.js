/**
 * Tiny Prolog Interpreter
 * 
 * Logic programming:
 * - Facts and rules
 * - Unification
 * - Backtracking search
 * - Queries with variable binding
 * - Lists
 * - Built-in: is/2, not/1, write/1, nl/0
 */

// ─── Terms ──────────────────────────────────────────

class Atom { constructor(name) { this.type = 'atom'; this.name = name; } toString() { return this.name; } }
class Var { constructor(name) { this.type = 'var'; this.name = name; } toString() { return this.name; } }
class Compound {
  constructor(functor, args) { this.type = 'compound'; this.functor = functor; this.args = args; }
  toString() { return `${this.functor}(${this.args.join(', ')})`; }
}
class Num { constructor(value) { this.type = 'num'; this.value = value; } toString() { return String(this.value); } }

function atom(name) { return new Atom(name); }
function variable(name) { return new Var(name); }
function compound(f, ...args) { return new Compound(f, args); }
function num(n) { return new Num(n); }

// ─── Substitution / Unification ─────────────────────

function walk(term, subst) {
  while (term.type === 'var' && subst.has(term.name)) {
    term = subst.get(term.name);
  }
  return term;
}

function deepWalk(term, subst) {
  term = walk(term, subst);
  if (term.type === 'compound') {
    return new Compound(term.functor, term.args.map(a => deepWalk(a, subst)));
  }
  return term;
}

function unify(t1, t2, subst) {
  t1 = walk(t1, subst);
  t2 = walk(t2, subst);

  if (t1.type === 'var') {
    const s = new Map(subst);
    s.set(t1.name, t2);
    return s;
  }
  if (t2.type === 'var') {
    const s = new Map(subst);
    s.set(t2.name, t1);
    return s;
  }
  if (t1.type === 'atom' && t2.type === 'atom' && t1.name === t2.name) return subst;
  if (t1.type === 'num' && t2.type === 'num' && t1.value === t2.value) return subst;
  if (t1.type === 'compound' && t2.type === 'compound' &&
      t1.functor === t2.functor && t1.args.length === t2.args.length) {
    let s = subst;
    for (let i = 0; i < t1.args.length; i++) {
      s = unify(t1.args[i], t2.args[i], s);
      if (s === null) return null;
    }
    return s;
  }
  return null;
}

// ─── Database ───────────────────────────────────────

class Prolog {
  constructor() {
    this.clauses = []; // [{head, body}]
    this._varCounter = 0;
    this.output = [];
  }

  addFact(head) {
    this.clauses.push({ head, body: [] });
    return this;
  }

  addRule(head, ...body) {
    this.clauses.push({ head, body });
    return this;
  }

  _freshVar() { return new Var(`_G${this._varCounter++}`); }

  _rename(clause) {
    const mapping = new Map();
    const rename = (term) => {
      if (term.type === 'var') {
        if (!mapping.has(term.name)) mapping.set(term.name, this._freshVar());
        return mapping.get(term.name);
      }
      if (term.type === 'compound') return new Compound(term.functor, term.args.map(rename));
      return term;
    };
    return { head: rename(clause.head), body: clause.body.map(rename) };
  }

  query(goal) {
    const results = [];
    const vars = this._extractVars(goal);
    for (const subst of this._solve([goal], new Map())) {
      const result = {};
      for (const v of vars) {
        result[v] = deepWalk(new Var(v), subst);
      }
      results.push(result);
    }
    return results;
  }

  queryAll(...goals) {
    const results = [];
    const vars = new Set();
    for (const g of goals) for (const v of this._extractVars(g)) vars.add(v);
    for (const subst of this._solve(goals, new Map())) {
      const result = {};
      for (const v of vars) {
        result[v] = deepWalk(new Var(v), subst);
      }
      results.push(result);
    }
    return results;
  }

  *_solve(goals, subst) {
    if (goals.length === 0) { yield subst; return; }
    const [goal, ...rest] = goals;
    const resolvedGoal = deepWalk(goal, subst);

    // Built-ins
    if (resolvedGoal.type === 'compound') {
      if (resolvedGoal.functor === 'is' && resolvedGoal.args.length === 2) {
        const val = this._evalArith(resolvedGoal.args[1], subst);
        const s = unify(resolvedGoal.args[0], num(val), subst);
        if (s !== null) yield* this._solve(rest, s);
        return;
      }
      if (resolvedGoal.functor === 'not' && resolvedGoal.args.length === 1) {
        let found = false;
        for (const _ of this._solve([resolvedGoal.args[0]], subst)) { found = true; break; }
        if (!found) yield* this._solve(rest, subst);
        return;
      }
      if (resolvedGoal.functor === '=' && resolvedGoal.args.length === 2) {
        const s = unify(resolvedGoal.args[0], resolvedGoal.args[1], subst);
        if (s !== null) yield* this._solve(rest, s);
        return;
      }
      if (resolvedGoal.functor === '\\=' && resolvedGoal.args.length === 2) {
        const s = unify(resolvedGoal.args[0], resolvedGoal.args[1], subst);
        if (s === null) yield* this._solve(rest, subst);
        return;
      }
      if (resolvedGoal.functor === 'write' && resolvedGoal.args.length === 1) {
        this.output.push(String(deepWalk(resolvedGoal.args[0], subst)));
        yield* this._solve(rest, subst);
        return;
      }
    }
    if (resolvedGoal.type === 'atom' && resolvedGoal.name === 'nl') {
      this.output.push('\n');
      yield* this._solve(rest, subst);
      return;
    }

    // Search clauses
    for (const clause of this.clauses) {
      const renamed = this._rename(clause);
      const s = unify(resolvedGoal, renamed.head, subst);
      if (s !== null) {
        yield* this._solve([...renamed.body, ...rest], s);
      }
    }
  }

  _evalArith(term, subst) {
    term = walk(term, subst);
    if (term.type === 'num') return term.value;
    if (term.type === 'var') throw new Error(`Unbound variable in arithmetic: ${term.name}`);
    if (term.type === 'compound') {
      const args = term.args.map(a => this._evalArith(a, subst));
      switch (term.functor) {
        case '+': return args[0] + args[1];
        case '-': return args[0] - args[1];
        case '*': return args[0] * args[1];
        case '/': return Math.trunc(args[0] / args[1]);
        case 'mod': return args[0] % args[1];
      }
    }
    throw new Error(`Cannot evaluate: ${term}`);
  }

  _extractVars(term) {
    const vars = new Set();
    const extract = (t) => {
      if (t.type === 'var' && !t.name.startsWith('_')) vars.add(t.name);
      if (t.type === 'compound') t.args.forEach(extract);
    };
    extract(term);
    return vars;
  }
}

module.exports = { Prolog, atom, variable, compound, num, Atom, Var, Compound, Num, unify };
