/**
 * Prolog Interpreter — Unified Engine
 * 
 * Uses terms.js for all term types. Integrates with parser.js for text input.
 * Features: unification, backtracking, cut, arithmetic, comparison,
 * lists, assert/retract, findall, if-then-else, type checks.
 */

const { Atom, Var, Num, Compound, Cut, NIL, atom, variable, compound, num, cut, list, listWithTail } = require('./terms.js');
const { parse, parseTerm } = require('./parser.js');

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

function occursIn(varName, term, subst) {
  term = walk(term, subst);
  if (term.type === 'var') return term.name === varName;
  if (term.type === 'compound') return term.args.some(a => occursIn(varName, a, subst));
  return false;
}

function unify(t1, t2, subst) {
  t1 = walk(t1, subst);
  t2 = walk(t2, subst);

  if (t1.type === 'var' && t2.type === 'var' && t1.name === t2.name) return subst;
  if (t1.type === 'var') {
    if (occursIn(t1.name, t2, subst)) return null;
    const s = new Map(subst);
    s.set(t1.name, t2);
    return s;
  }
  if (t2.type === 'var') {
    if (occursIn(t2.name, t1, subst)) return null;
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

// ─── Cut Signal ─────────────────────────────────────
class CutSignal {
  constructor() { this.type = 'cut-signal'; }
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

  consult(text) {
    const { clauses, queries } = parse(text);
    for (const c of clauses) {
      this.clauses.push(c);
    }
    const results = [];
    for (const goals of queries) {
      const vars = new Set();
      for (const g of goals) this._extractVarsFromTerm(g, vars);
      const qResults = [];
      for (const subst of this._solve(goals, new Map(), false)) {
        const result = {};
        for (const v of vars) {
          result[v] = deepWalk(new Var(v), subst);
        }
        qResults.push(result);
      }
      results.push(qResults);
    }
    return results;
  }

  queryString(text) {
    const fullText = '?- ' + text + (text.trimEnd().endsWith('.') ? '' : '.');
    const { queries } = parse(fullText);
    if (queries.length === 0) return [];
    const goals = queries[0];
    const vars = new Set();
    for (const g of goals) this._extractVarsFromTerm(g, vars);
    const results = [];
    for (const subst of this._solve(goals, new Map(), false)) {
      const result = {};
      for (const v of vars) {
        result[v] = deepWalk(new Var(v), subst);
      }
      results.push(result);
    }
    return results;
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
      if (term.type === 'cut') return term;
      return term;
    };
    return { head: rename(clause.head), body: clause.body.map(rename) };
  }

  query(goal) {
    const results = [];
    const vars = new Set();
    this._extractVarsFromTerm(goal, vars);
    for (const subst of this._solve([goal], new Map(), false)) {
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
    for (const g of goals) this._extractVarsFromTerm(g, vars);
    for (const subst of this._solve(goals, new Map(), false)) {
      const result = {};
      for (const v of vars) {
        result[v] = deepWalk(new Var(v), subst);
      }
      results.push(result);
    }
    return results;
  }

  *_solve(goals, subst, cutParent) {
    if (goals.length === 0) { yield subst; return; }
    const [goal, ...rest] = goals;
    const resolvedGoal = deepWalk(goal, subst);

    // Cut
    if (resolvedGoal.type === 'cut') {
      yield* this._solve(rest, subst, cutParent);
      return; // cut: don't try more alternatives for the parent
    }

    // Built-ins
    const builtin = this._tryBuiltin(resolvedGoal, rest, subst, cutParent);
    if (builtin !== null) {
      yield* builtin;
      return;
    }

    // Search clauses
    for (const clause of this.clauses) {
      const renamed = this._rename(clause);
      const s = unify(resolvedGoal, renamed.head, subst);
      if (s !== null) {
        let wasCut = false;
        for (const result of this._solve([...renamed.body, ...rest], s, false)) {
          yield result;
        }
      }
    }
  }

  _tryBuiltin(goal, rest, subst, cutParent) {
    if (goal.type === 'atom') {
      // true/0
      if (goal.name === 'true') { return this._solve(rest, subst, cutParent); }
      // fail/0
      if (goal.name === 'fail') { return [][Symbol.iterator](); }
      // nl/0
      if (goal.name === 'nl') {
        this.output.push('\n');
        return this._solve(rest, subst, cutParent);
      }
    }

    if (goal.type !== 'compound') return null;
    const { functor, args } = goal;

    // is/2 — arithmetic evaluation
    if (functor === 'is' && args.length === 2) {
      return this._builtin_is(args, rest, subst, cutParent);
    }

    // Arithmetic comparison
    if (['<', '>', '>=', '=<', '=:=', '=\\='].includes(functor) && args.length === 2) {
      return this._builtin_arithCmp(functor, args, rest, subst, cutParent);
    }

    // Unification
    if (functor === '=' && args.length === 2) {
      return this._builtin_unify(args, rest, subst, cutParent);
    }
    if (functor === '\\=' && args.length === 2) {
      return this._builtin_notUnify(args, rest, subst, cutParent);
    }

    // Structural equality
    if (functor === '==' && args.length === 2) {
      return this._builtin_structEq(args, rest, subst, cutParent);
    }
    if (functor === '\\==' && args.length === 2) {
      return this._builtin_structNeq(args, rest, subst, cutParent);
    }

    // not/1 and \+/1
    if ((functor === 'not' || functor === '\\+') && args.length === 1) {
      return this._builtin_not(args, rest, subst, cutParent);
    }

    // write/1, writeln/1
    if (functor === 'write' && args.length === 1) {
      return this._builtin_write(args, rest, subst, cutParent);
    }
    if (functor === 'writeln' && args.length === 1) {
      return this._builtin_writeln(args, rest, subst, cutParent);
    }

    // If-then-else: (Cond -> Then ; Else) or (Cond -> Then)
    if (functor === ';' && args.length === 2) {
      return this._builtin_semicolon(args, rest, subst, cutParent);
    }
    if (functor === '->' && args.length === 2) {
      return this._builtin_ifthen(args, rest, subst, cutParent);
    }

    // Type checks
    if (functor === 'atom' && args.length === 1) {
      return this._builtin_typeCheck(args[0], subst, rest, cutParent, t => t.type === 'atom');
    }
    if (functor === 'number' && args.length === 1) {
      return this._builtin_typeCheck(args[0], subst, rest, cutParent, t => t.type === 'num');
    }
    if (functor === 'integer' && args.length === 1) {
      return this._builtin_typeCheck(args[0], subst, rest, cutParent, t => t.type === 'num' && Number.isInteger(t.value));
    }
    if (functor === 'float' && args.length === 1) {
      return this._builtin_typeCheck(args[0], subst, rest, cutParent, t => t.type === 'num' && !Number.isInteger(t.value));
    }
    if (functor === 'var' && args.length === 1) {
      return this._builtin_typeCheck(args[0], subst, rest, cutParent, t => t.type === 'var');
    }
    if (functor === 'nonvar' && args.length === 1) {
      return this._builtin_typeCheck(args[0], subst, rest, cutParent, t => t.type !== 'var');
    }
    if (functor === 'compound' && args.length === 1) {
      return this._builtin_typeCheck(args[0], subst, rest, cutParent, t => t.type === 'compound');
    }
    if (functor === 'is_list' && args.length === 1) {
      return this._builtin_typeCheck(args[0], subst, rest, cutParent, t => this._isList(t));
    }
    if (functor === 'atomic' && args.length === 1) {
      return this._builtin_typeCheck(args[0], subst, rest, cutParent, t => t.type === 'atom' || t.type === 'num');
    }

    // functor/3
    if (functor === 'functor' && args.length === 3) {
      return this._builtin_functor(args, rest, subst, cutParent);
    }

    // arg/3
    if (functor === 'arg' && args.length === 3) {
      return this._builtin_arg(args, rest, subst, cutParent);
    }

    // =../2 (univ)
    if (functor === '=..' && args.length === 2) {
      return this._builtin_univ(args, rest, subst, cutParent);
    }

    // copy_term/2
    if (functor === 'copy_term' && args.length === 2) {
      return this._builtin_copyTerm(args, rest, subst, cutParent);
    }

    // findall/3
    if (functor === 'findall' && args.length === 3) {
      return this._builtin_findall(args, rest, subst, cutParent);
    }

    // assert/1, assertz/1, asserta/1
    if ((functor === 'assert' || functor === 'assertz') && args.length === 1) {
      return this._builtin_assertz(args, rest, subst, cutParent);
    }
    if (functor === 'asserta' && args.length === 1) {
      return this._builtin_asserta(args, rest, subst, cutParent);
    }

    // retract/1
    if (functor === 'retract' && args.length === 1) {
      return this._builtin_retract(args, rest, subst, cutParent);
    }

    // length/2
    if (functor === 'length' && args.length === 2) {
      return this._builtin_length(args, rest, subst, cutParent);
    }

    // append/3
    if (functor === 'append' && args.length === 3) {
      return this._builtin_append(args, rest, subst, cutParent);
    }

    // member/2
    if (functor === 'member' && args.length === 2) {
      return this._builtin_member(args, rest, subst, cutParent);
    }

    // last/2
    if (functor === 'last' && args.length === 2) {
      return this._builtin_last(args, rest, subst, cutParent);
    }

    // reverse/2
    if (functor === 'reverse' && args.length === 2) {
      return this._builtin_reverse(args, rest, subst, cutParent);
    }

    // msort/2, sort/2
    if (functor === 'msort' && args.length === 2) {
      return this._builtin_msort(args, rest, subst, cutParent);
    }
    if (functor === 'sort' && args.length === 2) {
      return this._builtin_sort(args, rest, subst, cutParent);
    }

    // nth0/3 and nth1/3
    if (functor === 'nth0' && args.length === 3) {
      return this._builtin_nth(args, rest, subst, cutParent, 0);
    }
    if (functor === 'nth1' && args.length === 3) {
      return this._builtin_nth(args, rest, subst, cutParent, 1);
    }

    // between/3
    if (functor === 'between' && args.length === 3) {
      return this._builtin_between(args, rest, subst, cutParent);
    }

    // succ/2
    if (functor === 'succ' && args.length === 2) {
      return this._builtin_succ(args, rest, subst, cutParent);
    }

    // plus/3
    if (functor === 'plus' && args.length === 3) {
      return this._builtin_plus(args, rest, subst, cutParent);
    }

    // number_chars/2, atom_chars/2, atom_length/2, atom_concat/3, number_codes/2, char_code/2
    if (functor === 'number_chars' && args.length === 2) {
      return this._builtin_numberChars(args, rest, subst, cutParent);
    }
    if (functor === 'atom_chars' && args.length === 2) {
      return this._builtin_atomChars(args, rest, subst, cutParent);
    }
    if (functor === 'atom_length' && args.length === 2) {
      return this._builtin_atomLength(args, rest, subst, cutParent);
    }
    if (functor === 'atom_concat' && args.length === 3) {
      return this._builtin_atomConcat(args, rest, subst, cutParent);
    }
    if (functor === 'char_code' && args.length === 2) {
      return this._builtin_charCode(args, rest, subst, cutParent);
    }

    // ground/1
    if (functor === 'ground' && args.length === 1) {
      return this._builtin_typeCheck(args[0], subst, rest, cutParent, t => this._isGround(t));
    }

    // call/1
    if (functor === 'call' && args.length >= 1) {
      return this._builtin_call(args, rest, subst, cutParent);
    }

    // once/1
    if (functor === 'once' && args.length === 1) {
      return this._builtin_once(args, rest, subst, cutParent);
    }

    // aggregate_all/3 (alias for findall)
    if (functor === 'aggregate_all' && args.length === 3) {
      return this._builtin_findall(args, rest, subst, cutParent);
    }

    // maplist/2
    if (functor === 'maplist' && args.length === 2) {
      return this._builtin_maplist(args, rest, subst, cutParent);
    }

    // forall/2
    if (functor === 'forall' && args.length === 2) {
      return this._builtin_forall(args, rest, subst, cutParent);
    }

    // succ_or_zero/2 helper — not standard but useful
    // abs/1 in arithmetic handled in _evalArith

    return null; // not a builtin
  }

  // ─── Builtin Implementations ────────────────────────

  _emptyGen() { return [][Symbol.iterator](); }
  *_wrapGen(gen) { yield* gen; }

  *_builtin_is(args, rest, subst, cutParent) {
    const val = this._evalArith(args[1], subst);
    const s = unify(args[0], num(val), subst);
    if (s !== null) yield* this._solve(rest, s, cutParent);
  }

  *_builtin_arithCmp(op, args, rest, subst, cutParent) {
    const l = this._evalArith(args[0], subst);
    const r = this._evalArith(args[1], subst);
    let result = false;
    switch (op) {
      case '<': result = l < r; break;
      case '>': result = l > r; break;
      case '>=': result = l >= r; break;
      case '=<': result = l <= r; break;
      case '=:=': result = l === r; break;
      case '=\\=': result = l !== r; break;
    }
    if (result) yield* this._solve(rest, subst, cutParent);
  }

  *_builtin_unify(args, rest, subst, cutParent) {
    const s = unify(args[0], args[1], subst);
    if (s !== null) yield* this._solve(rest, s, cutParent);
  }

  *_builtin_notUnify(args, rest, subst, cutParent) {
    const s = unify(args[0], args[1], subst);
    if (s === null) yield* this._solve(rest, subst, cutParent);
  }

  *_builtin_structEq(args, rest, subst, cutParent) {
    const l = deepWalk(args[0], subst);
    const r = deepWalk(args[1], subst);
    if (this._structEqual(l, r)) yield* this._solve(rest, subst, cutParent);
  }

  *_builtin_structNeq(args, rest, subst, cutParent) {
    const l = deepWalk(args[0], subst);
    const r = deepWalk(args[1], subst);
    if (!this._structEqual(l, r)) yield* this._solve(rest, subst, cutParent);
  }

  *_builtin_not(args, rest, subst, cutParent) {
    let found = false;
    for (const _ of this._solve([args[0]], subst, false)) { found = true; break; }
    if (!found) yield* this._solve(rest, subst, cutParent);
  }

  *_builtin_write(args, rest, subst, cutParent) {
    this.output.push(String(deepWalk(args[0], subst)));
    yield* this._solve(rest, subst, cutParent);
  }

  *_builtin_writeln(args, rest, subst, cutParent) {
    this.output.push(String(deepWalk(args[0], subst)) + '\n');
    yield* this._solve(rest, subst, cutParent);
  }

  *_builtin_semicolon(args, rest, subst, cutParent) {
    const left = deepWalk(args[0], subst);
    const right = deepWalk(args[1], subst);
    // If-then-else: (Cond -> Then ; Else)
    if (left.type === 'compound' && left.functor === '->' && left.args.length === 2) {
      const cond = left.args[0];
      const then = left.args[1];
      let found = false;
      for (const s of this._solve([cond], subst, false)) {
        found = true;
        yield* this._solve([then, ...rest], s, cutParent);
        break; // only first solution of cond (committed choice)
      }
      if (!found) {
        yield* this._solve([right, ...rest], subst, cutParent);
      }
      return;
    }
    // Disjunction
    yield* this._solve([left, ...rest], subst, cutParent);
    yield* this._solve([right, ...rest], subst, cutParent);
  }

  *_builtin_ifthen(args, rest, subst, cutParent) {
    const cond = args[0];
    const then = args[1];
    for (const s of this._solve([cond], subst, false)) {
      yield* this._solve([then, ...rest], s, cutParent);
      break; // committed choice
    }
  }

  *_builtin_typeCheck(arg, subst, rest, cutParent, check) {
    const t = deepWalk(arg, subst);
    if (check(t)) yield* this._solve(rest, subst, cutParent);
  }

  *_builtin_functor(args, rest, subst, cutParent) {
    const t = deepWalk(args[0], subst);
    if (t.type === 'compound') {
      let s = unify(args[1], atom(t.functor), subst);
      if (s) s = unify(args[2], num(t.args.length), s);
      if (s) yield* this._solve(rest, s, cutParent);
    } else if (t.type === 'atom') {
      let s = unify(args[1], t, subst);
      if (s) s = unify(args[2], num(0), s);
      if (s) yield* this._solve(rest, s, cutParent);
    } else if (t.type === 'num') {
      let s = unify(args[1], t, subst);
      if (s) s = unify(args[2], num(0), s);
      if (s) yield* this._solve(rest, s, cutParent);
    }
  }

  *_builtin_arg(args, rest, subst, cutParent) {
    const n = deepWalk(args[0], subst);
    const t = deepWalk(args[1], subst);
    if (n.type === 'num' && t.type === 'compound' && n.value >= 1 && n.value <= t.args.length) {
      const s = unify(args[2], t.args[n.value - 1], subst);
      if (s) yield* this._solve(rest, s, cutParent);
    }
  }

  *_builtin_univ(args, rest, subst, cutParent) {
    const t = deepWalk(args[0], subst);
    if (t.type === 'compound') {
      const elems = [atom(t.functor), ...t.args];
      const s = unify(args[1], list(...elems), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    } else if (t.type === 'atom') {
      const s = unify(args[1], list(t), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    } else if (t.type === 'num') {
      const s = unify(args[1], list(t), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    } else if (t.type === 'var') {
      // Construct from list
      const lst = deepWalk(args[1], subst);
      const elems = this._listToArray(lst);
      if (elems && elems.length > 0) {
        const head = elems[0];
        if (elems.length === 1) {
          const s = unify(args[0], head, subst);
          if (s) yield* this._solve(rest, s, cutParent);
        } else if (head.type === 'atom') {
          const term = new Compound(head.name, elems.slice(1));
          const s = unify(args[0], term, subst);
          if (s) yield* this._solve(rest, s, cutParent);
        }
      }
    }
  }

  *_builtin_copyTerm(args, rest, subst, cutParent) {
    const original = deepWalk(args[0], subst);
    const mapping = new Map();
    const copy = this._copyWithFreshVars(original, mapping);
    const s = unify(args[1], copy, subst);
    if (s) yield* this._solve(rest, s, cutParent);
  }

  *_builtin_findall(args, rest, subst, cutParent) {
    const template = args[0];
    const goal = args[1];
    const collected = [];
    for (const s of this._solve([goal], subst, false)) {
      collected.push(deepWalk(template, s));
    }
    const resultList = list(...collected);
    const s = unify(args[2], resultList, subst);
    if (s) yield* this._solve(rest, s, cutParent);
  }

  *_builtin_assertz(args, rest, subst, cutParent) {
    const term = deepWalk(args[0], subst);
    if (term.type === 'compound' && term.functor === ':-' && term.args.length === 2) {
      const head = term.args[0];
      const bodyTerm = term.args[1];
      const body = this._conjunctionToList(bodyTerm);
      this.clauses.push({ head, body });
    } else {
      this.clauses.push({ head: term, body: [] });
    }
    yield* this._solve(rest, subst, cutParent);
  }

  *_builtin_asserta(args, rest, subst, cutParent) {
    const term = deepWalk(args[0], subst);
    if (term.type === 'compound' && term.functor === ':-' && term.args.length === 2) {
      const head = term.args[0];
      const bodyTerm = term.args[1];
      const body = this._conjunctionToList(bodyTerm);
      this.clauses.unshift({ head, body });
    } else {
      this.clauses.unshift({ head: term, body: [] });
    }
    yield* this._solve(rest, subst, cutParent);
  }

  *_builtin_retract(args, rest, subst, cutParent) {
    const pattern = deepWalk(args[0], subst);
    for (let i = 0; i < this.clauses.length; i++) {
      const clause = this.clauses[i];
      let head, body;
      if (pattern.type === 'compound' && pattern.functor === ':-' && pattern.args.length === 2) {
        head = pattern.args[0];
        body = pattern.args[1];
      } else {
        head = pattern;
        body = null;
      }
      const renamed = this._rename(clause);
      const s = unify(head, renamed.head, subst);
      if (s !== null) {
        if (body === null || (clause.body.length === 0 && body.type === 'atom' && body.name === 'true')) {
          this.clauses.splice(i, 1);
          yield* this._solve(rest, s, cutParent);
          return;
        }
      }
    }
  }

  // ─── List Builtins ──────────────────────────────────

  *_builtin_length(args, rest, subst, cutParent) {
    const lst = deepWalk(args[0], subst);
    const arr = this._listToArray(lst);
    if (arr !== null) {
      const s = unify(args[1], num(arr.length), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    }
  }

  *_builtin_append(args, rest, subst, cutParent) {
    // Try to resolve deterministically first
    const l1 = deepWalk(args[0], subst);
    const l2 = deepWalk(args[1], subst);
    const l3 = deepWalk(args[2], subst);

    if (l1.type !== 'var') {
      // l1 is known: l3 = l1 ++ l2
      if (l1.type === 'atom' && l1.name === '[]') {
        const s = unify(args[2], l2, subst);
        if (s) yield* this._solve(rest, s, cutParent);
      } else if (l1.type === 'compound' && l1.functor === '.') {
        const head = l1.args[0];
        const tail = l1.args[1];
        const newTail = this._freshVar();
        const newL3 = new Compound('.', [head, newTail]);
        const s = unify(args[2], newL3, subst);
        if (s) {
          yield* this._solve([new Compound('append', [tail, l2, newTail]), ...rest], s, cutParent);
        }
      }
      return;
    }

    // l1 unknown — enumerate from l3
    if (l3.type !== 'var') {
      // Base: L1=[], L3=L2
      const s1 = unify(args[0], NIL, subst);
      if (s1) {
        const s2 = unify(args[2], args[1], s1);
        if (s2) yield* this._solve(rest, s2, cutParent);
      }
      // Recursive: L3=[H|T3], L1=[H|T1], append(T1, L2, T3)
      if (l3.type === 'compound' && l3.functor === '.') {
        const h = l3.args[0];
        const t3 = l3.args[1];
        const t1 = this._freshVar();
        const newL1 = new Compound('.', [h, t1]);
        const s = unify(args[0], newL1, subst);
        if (s) {
          yield* this._solve([new Compound('append', [t1, args[1], t3]), ...rest], s, cutParent);
        }
      }
    }
  }

  *_builtin_member(args, rest, subst, cutParent) {
    const lst = deepWalk(args[1], subst);
    if (lst.type === 'compound' && lst.functor === '.') {
      // member(X, [H|_]) :- X = H.
      const s = unify(args[0], lst.args[0], subst);
      if (s) yield* this._solve(rest, s, cutParent);
      // member(X, [_|T]) :- member(X, T).
      yield* this._solve([new Compound('member', [args[0], lst.args[1]]), ...rest], subst, cutParent);
    }
  }

  *_builtin_last(args, rest, subst, cutParent) {
    const lst = deepWalk(args[0], subst);
    const arr = this._listToArray(lst);
    if (arr && arr.length > 0) {
      const s = unify(args[1], arr[arr.length - 1], subst);
      if (s) yield* this._solve(rest, s, cutParent);
    }
  }

  *_builtin_reverse(args, rest, subst, cutParent) {
    const lst = deepWalk(args[0], subst);
    const arr = this._listToArray(lst);
    if (arr) {
      const reversed = list(...arr.reverse());
      const s = unify(args[1], reversed, subst);
      if (s) yield* this._solve(rest, s, cutParent);
    }
  }

  *_builtin_msort(args, rest, subst, cutParent) {
    const lst = deepWalk(args[0], subst);
    const arr = this._listToArray(lst);
    if (arr) {
      arr.sort((a, b) => this._termCompare(a, b));
      const s = unify(args[1], list(...arr), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    }
  }

  *_builtin_sort(args, rest, subst, cutParent) {
    const lst = deepWalk(args[0], subst);
    const arr = this._listToArray(lst);
    if (arr) {
      arr.sort((a, b) => this._termCompare(a, b));
      // Remove duplicates
      const unique = arr.filter((t, i) => i === 0 || this._termCompare(t, arr[i - 1]) !== 0);
      const s = unify(args[1], list(...unique), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    }
  }

  *_builtin_nth(args, rest, subst, cutParent, base) {
    const n = deepWalk(args[0], subst);
    const lst = deepWalk(args[1], subst);
    const arr = this._listToArray(lst);
    if (arr && n.type === 'num') {
      const idx = n.value - base;
      if (idx >= 0 && idx < arr.length) {
        const s = unify(args[2], arr[idx], subst);
        if (s) yield* this._solve(rest, s, cutParent);
      }
    } else if (arr && n.type === 'var') {
      // Enumerate
      for (let i = 0; i < arr.length; i++) {
        let s = unify(args[0], num(i + base), subst);
        if (s) s = unify(args[2], arr[i], s);
        if (s) yield* this._solve(rest, s, cutParent);
      }
    }
  }

  *_builtin_between(args, rest, subst, cutParent) {
    const low = deepWalk(args[0], subst);
    const high = deepWalk(args[1], subst);
    if (low.type === 'num' && high.type === 'num') {
      for (let i = low.value; i <= high.value; i++) {
        const s = unify(args[2], num(i), subst);
        if (s) yield* this._solve(rest, s, cutParent);
      }
    }
  }

  *_builtin_succ(args, rest, subst, cutParent) {
    const a = deepWalk(args[0], subst);
    const b = deepWalk(args[1], subst);
    if (a.type === 'num') {
      const s = unify(args[1], num(a.value + 1), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    } else if (b.type === 'num' && b.value > 0) {
      const s = unify(args[0], num(b.value - 1), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    }
  }

  *_builtin_plus(args, rest, subst, cutParent) {
    const a = deepWalk(args[0], subst);
    const b = deepWalk(args[1], subst);
    const c = deepWalk(args[2], subst);
    if (a.type === 'num' && b.type === 'num') {
      const s = unify(args[2], num(a.value + b.value), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    } else if (a.type === 'num' && c.type === 'num') {
      const s = unify(args[1], num(c.value - a.value), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    } else if (b.type === 'num' && c.type === 'num') {
      const s = unify(args[0], num(c.value - b.value), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    }
  }

  *_builtin_numberChars(args, rest, subst, cutParent) {
    const n = deepWalk(args[0], subst);
    if (n.type === 'num') {
      const chars = [...String(n.value)].map(c => atom(c));
      const s = unify(args[1], list(...chars), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    } else {
      const lst = deepWalk(args[1], subst);
      const arr = this._listToArray(lst);
      if (arr) {
        const str = arr.map(a => a.name || String(a.value)).join('');
        const val = Number(str);
        if (!isNaN(val)) {
          const s = unify(args[0], num(val), subst);
          if (s) yield* this._solve(rest, s, cutParent);
        }
      }
    }
  }

  *_builtin_atomChars(args, rest, subst, cutParent) {
    const a = deepWalk(args[0], subst);
    if (a.type === 'atom') {
      const chars = [...a.name].map(c => atom(c));
      const s = unify(args[1], list(...chars), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    } else {
      const lst = deepWalk(args[1], subst);
      const arr = this._listToArray(lst);
      if (arr) {
        const str = arr.map(a => a.name || String(a.value)).join('');
        const s = unify(args[0], atom(str), subst);
        if (s) yield* this._solve(rest, s, cutParent);
      }
    }
  }

  *_builtin_atomLength(args, rest, subst, cutParent) {
    const a = deepWalk(args[0], subst);
    if (a.type === 'atom') {
      const s = unify(args[1], num(a.name.length), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    }
  }

  *_builtin_atomConcat(args, rest, subst, cutParent) {
    const a = deepWalk(args[0], subst);
    const b = deepWalk(args[1], subst);
    if (a.type === 'atom' && b.type === 'atom') {
      const s = unify(args[2], atom(a.name + b.name), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    }
  }

  *_builtin_charCode(args, rest, subst, cutParent) {
    const a = deepWalk(args[0], subst);
    const b = deepWalk(args[1], subst);
    if (a.type === 'atom' && a.name.length === 1) {
      const s = unify(args[1], num(a.name.charCodeAt(0)), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    } else if (b.type === 'num') {
      const s = unify(args[0], atom(String.fromCharCode(b.value)), subst);
      if (s) yield* this._solve(rest, s, cutParent);
    }
  }

  *_builtin_call(args, rest, subst, cutParent) {
    const goal = deepWalk(args[0], subst);
    yield* this._solve([goal, ...rest], subst, cutParent);
  }

  *_builtin_once(args, rest, subst, cutParent) {
    for (const s of this._solve([args[0]], subst, false)) {
      yield* this._solve(rest, s, cutParent);
      return; // only first solution
    }
  }

  *_builtin_maplist(args, rest, subst, cutParent) {
    const pred = deepWalk(args[0], subst);
    const lst = deepWalk(args[1], subst);
    const arr = this._listToArray(lst);
    if (arr) {
      yield* this._maplistHelper(pred, arr, 0, rest, subst, cutParent);
    }
  }

  *_maplistHelper(pred, arr, idx, rest, subst, cutParent) {
    if (idx >= arr.length) {
      yield* this._solve(rest, subst, cutParent);
      return;
    }
    const goal = pred.type === 'atom'
      ? new Compound(pred.name, [arr[idx]])
      : new Compound(pred.functor, [...pred.args, arr[idx]]);
    for (const s of this._solve([goal], subst, false)) {
      yield* this._maplistHelper(pred, arr, idx + 1, rest, s, cutParent);
    }
  }

  *_builtin_forall(args, rest, subst, cutParent) {
    const cond = args[0];
    const action = args[1];
    let allSucceed = true;
    for (const s of this._solve([cond], subst, false)) {
      let found = false;
      for (const _ of this._solve([action], s, false)) {
        found = true;
        break;
      }
      if (!found) { allSucceed = false; break; }
    }
    if (allSucceed) yield* this._solve(rest, subst, cutParent);
  }

  // ─── Arithmetic ─────────────────────────────────────

  _evalArith(term, subst) {
    term = walk(term, subst);
    if (term.type === 'num') return term.value;
    if (term.type === 'var') throw new Error(`Unbound variable in arithmetic: ${term.name}`);
    if (term.type === 'compound') {
      if (term.args.length === 2) {
        const l = this._evalArith(term.args[0], subst);
        const r = this._evalArith(term.args[1], subst);
        switch (term.functor) {
          case '+': return l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/': return Math.trunc(l / r);
          case '//': return Math.trunc(l / r);
          case 'mod': return l % r;
          case 'rem': return l % r;
          case '**': return Math.pow(l, r);
          case '^': return Math.pow(l, r);
          case 'min': return Math.min(l, r);
          case 'max': return Math.max(l, r);
          case '>>': return l >> r;
          case '<<': return l << r;
          case '/\\': return l & r;
          case '\\/': return l | r;
          case 'xor': return l ^ r;
        }
      }
      if (term.args.length === 1) {
        const a = this._evalArith(term.args[0], subst);
        switch (term.functor) {
          case '-': return -a;
          case 'abs': return Math.abs(a);
          case 'sign': return Math.sign(a);
          case 'sqrt': return Math.sqrt(a);
          case 'sin': return Math.sin(a);
          case 'cos': return Math.cos(a);
          case 'tan': return Math.tan(a);
          case 'log': return Math.log(a);
          case 'exp': return Math.exp(a);
          case 'ceiling': return Math.ceil(a);
          case 'floor': return Math.floor(a);
          case 'round': return Math.round(a);
          case 'truncate': return Math.trunc(a);
          case 'float_integer_part': return Math.trunc(a);
          case 'float_fractional_part': return a - Math.trunc(a);
          case 'float': return a;
          case 'integer': return Math.trunc(a);
          case 'msb': return 31 - Math.clz32(a);
          case '\\': return ~a;
          case 'succ': return a + 1;
          case 'plus': return a + 1;
        }
      }
      if (term.functor === 'random' && term.args.length === 1) {
        const n = this._evalArith(term.args[0], subst);
        return Math.floor(Math.random() * n);
      }
    }
    if (term.type === 'atom') {
      switch (term.name) {
        case 'pi': return Math.PI;
        case 'e': return Math.E;
        case 'inf': case 'infinity': return Infinity;
        case 'random_float': return Math.random();
      }
    }
    throw new Error(`Cannot evaluate: ${term}`);
  }

  // ─── Helpers ────────────────────────────────────────

  _extractVarsFromTerm(term, vars) {
    if (term.type === 'var' && !term.name.startsWith('_')) vars.add(term.name);
    if (term.type === 'compound') term.args.forEach(a => this._extractVarsFromTerm(a, vars));
  }

  // For backward compat with old API
  _extractVars(term) {
    const vars = new Set();
    this._extractVarsFromTerm(term, vars);
    return vars;
  }

  _listToArray(term) {
    const arr = [];
    let cur = term;
    let limit = 10000;
    while (cur.type === 'compound' && cur.functor === '.' && cur.args.length === 2 && limit-- > 0) {
      arr.push(cur.args[0]);
      cur = cur.args[1];
    }
    if (cur.type === 'atom' && cur.name === '[]') return arr;
    return null; // not a proper list
  }

  _isList(term) {
    return this._listToArray(term) !== null;
  }

  _isGround(term) {
    if (term.type === 'var') return false;
    if (term.type === 'compound') return term.args.every(a => this._isGround(a));
    return true;
  }

  _structEqual(a, b) {
    if (a.type !== b.type) return false;
    if (a.type === 'atom') return a.name === b.name;
    if (a.type === 'num') return a.value === b.value;
    if (a.type === 'var') return a.name === b.name;
    if (a.type === 'compound') {
      return a.functor === b.functor && a.args.length === b.args.length &&
        a.args.every((arg, i) => this._structEqual(arg, b.args[i]));
    }
    return false;
  }

  _termCompare(a, b) {
    // Standard order: var < num < atom < compound
    const order = { var: 0, num: 1, atom: 2, compound: 3, cut: 4 };
    const oa = order[a.type] ?? 5;
    const ob = order[b.type] ?? 5;
    if (oa !== ob) return oa - ob;
    if (a.type === 'num') return a.value - b.value;
    if (a.type === 'atom') return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    if (a.type === 'var') return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    if (a.type === 'compound') {
      if (a.args.length !== b.args.length) return a.args.length - b.args.length;
      if (a.functor !== b.functor) return a.functor < b.functor ? -1 : 1;
      for (let i = 0; i < a.args.length; i++) {
        const c = this._termCompare(a.args[i], b.args[i]);
        if (c !== 0) return c;
      }
      return 0;
    }
    return 0;
  }

  _copyWithFreshVars(term, mapping) {
    if (term.type === 'var') {
      if (!mapping.has(term.name)) mapping.set(term.name, this._freshVar());
      return mapping.get(term.name);
    }
    if (term.type === 'compound') {
      return new Compound(term.functor, term.args.map(a => this._copyWithFreshVars(a, mapping)));
    }
    return term;
  }

  _conjunctionToList(term) {
    if (term.type === 'compound' && term.functor === ',' && term.args.length === 2) {
      return [...this._conjunctionToList(term.args[0]), ...this._conjunctionToList(term.args[1])];
    }
    return [term];
  }
}

module.exports = { Prolog, atom, variable, compound, num, cut, list, listWithTail, NIL, Atom, Var, Compound, Num, Cut, unify, deepWalk, parse, parseTerm };
