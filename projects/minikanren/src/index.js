/**
 * miniKanren — Relational Logic Programming in JavaScript
 * 
 * A pure, minimal implementation with interleaving search.
 * Based on "The Reasoned Schemer" and μKanren.
 */

// ─── Logic Variables ────────────────────────────────

let _varCounter = 0;

class LVar {
  constructor(name) {
    this.id = _varCounter++;
    this.name = name || `_${this.id}`;
  }
  toString() { return this.name; }
}

function lvar(name) { return new LVar(name); }
function isLvar(x) { return x instanceof LVar; }

// ─── Substitution ───────────────────────────────────

function walk(u, s) {
  while (isLvar(u) && s.has(u.id)) {
    u = s.get(u.id);
  }
  return u;
}

function deepWalk(u, s) {
  u = walk(u, s);
  if (Array.isArray(u)) return u.map(v => deepWalk(v, s));
  if (u !== null && typeof u === 'object' && !isLvar(u) && u.constructor === Object) {
    const result = {};
    for (const k in u) result[k] = deepWalk(u[k], s);
    return result;
  }
  return u;
}

function occursCheck(x, v, s) {
  v = walk(v, s);
  if (isLvar(v)) return v.id === x.id;
  if (Array.isArray(v)) return v.some(e => occursCheck(x, e, s));
  return false;
}

function extend(x, v, s) {
  if (occursCheck(x, v, s)) return null;
  const s2 = new Map(s);
  s2.set(x.id, v);
  return s2;
}

function unify(u, v, s) {
  u = walk(u, s);
  v = walk(v, s);

  if (isLvar(u) && isLvar(v) && u.id === v.id) return s;
  if (isLvar(u)) return extend(u, v, s);
  if (isLvar(v)) return extend(v, u, s);
  
  if (Array.isArray(u) && Array.isArray(v)) {
    if (u.length !== v.length) return null;
    for (let i = 0; i < u.length; i++) {
      s = unify(u[i], v[i], s);
      if (s === null) return null;
    }
    return s;
  }

  if (u !== null && v !== null && typeof u === 'object' && typeof v === 'object' &&
      !isLvar(u) && !isLvar(v) && u.constructor === Object && v.constructor === Object) {
    const keys = new Set([...Object.keys(u), ...Object.keys(v)]);
    for (const k of keys) {
      if (!(k in u) || !(k in v)) return null;
      s = unify(u[k], v[k], s);
      if (s === null) return null;
    }
    return s;
  }

  if (u === v) return s;
  return null;
}

// ─── Streams (Lazy Lists with Interleaving) ─────────

// A stream is one of:
// - null (empty)
// - [substitution, stream] (mature: a result + more)
// - () => stream (immature: a thunk/suspension)

const EMPTY = null;

function mplus(s1, s2) {
  if (s1 === EMPTY) return s2;
  if (typeof s1 === 'function') return () => mplus(s2, s1()); // interleaving!
  // s1 is [head, tail]
  return [s1[0], mplus(s1[1], s2)];
}

function bind(stream, goal) {
  if (stream === EMPTY) return EMPTY;
  if (typeof stream === 'function') return () => bind(stream(), goal);
  // stream is [head, tail]
  return mplus(goal(stream[0]), bind(stream[1], goal));
}

function pull(stream) {
  while (typeof stream === 'function') stream = stream();
  return stream;
}

function takeAll(stream) {
  const results = [];
  stream = pull(stream);
  while (stream !== EMPTY) {
    results.push(stream[0]);
    stream = pull(stream[1]);
  }
  return results;
}

function take(n, stream) {
  const results = [];
  stream = pull(stream);
  while (n > 0 && stream !== EMPTY) {
    results.push(stream[0]);
    n--;
    stream = pull(stream[1]);
  }
  return results;
}

// ─── Goals ──────────────────────────────────────────

// A goal is a function: substitution → stream

function eq(u, v) {
  return (s) => {
    const s2 = unify(u, v, s);
    return s2 !== null ? [s2, EMPTY] : EMPTY;
  };
}

function neq(u, v) {
  return (s) => {
    const s2 = unify(u, v, s);
    // If they can't unify, the constraint is trivially satisfied
    if (s2 === null) return [s, EMPTY];
    // If they already unify with current substitution, fail
    const uWalked = deepWalk(u, s);
    const vWalked = deepWalk(v, s);
    if (deepEqual(uWalked, vWalked)) return EMPTY;
    // Otherwise, store as a constraint (for now, simple check)
    return [s, EMPTY];
  };
}

function succeed(s) { return [s, EMPTY]; }
function fail(_s) { return EMPTY; }

function conde(...clauses) {
  return (s) => {
    let stream = EMPTY;
    for (const clause of clauses) {
      const goals = Array.isArray(clause) ? clause : [clause];
      const goal = conj(...goals);
      stream = mplus(stream, goal(s));
    }
    return stream;
  };
}

function conj(...goals) {
  if (goals.length === 0) return succeed;
  if (goals.length === 1) return goals[0];
  return (s) => {
    let stream = goals[0](s);
    for (let i = 1; i < goals.length; i++) {
      stream = bind(stream, goals[i]);
    }
    return stream;
  };
}

function disj(...goals) {
  if (goals.length === 0) return fail;
  return (s) => {
    let stream = EMPTY;
    for (const goal of goals) {
      stream = mplus(stream, goal(s));
    }
    return stream;
  };
}

function fresh(fn) {
  return (s) => {
    const arity = fn.length;
    const vars = [];
    for (let i = 0; i < arity; i++) vars.push(lvar());
    const goal = fn(...vars);
    return goal(s);
  };
}

// zzz (suspension) — wraps a thunk that produces a goal, making it lazy
// Usage: zzz(() => recursiveGoal(args))
function zzz(thunk) {
  return (s) => () => thunk()(s);
}

// ─── Run Interface ──────────────────────────────────

function run(n, fn) {
  const queryVar = lvar('q');
  const goal = typeof fn === 'function' ? fn(queryVar) : fn;
  const emptyS = new Map();
  const stream = goal(emptyS);
  const results = n === false ? takeAll(stream) : take(n, stream);
  return results.map(s => reify(queryVar, s));
}

function runAll(fn) {
  return run(false, fn);
}

function reify(v, s) {
  return deepWalk(v, s);
}

// ─── Relational Arithmetic & Builtins ───────────────

// appendo(l, s, out) — relational append
function appendo(l, s, out) {
  return conde(
    [eq(l, []), eq(s, out)],
    [fresh((a, d, res) => conj(
      eq(l, [a, ...cons(d)]),
      eq(out, [a, ...cons(res)]),
      // This won't work with standard arrays... need linked lists
      appendo(d, s, res)
    ))]
  );
}

// For miniKanren, we use linked lists: [head, tail] pairs
// nil = null, cons(1, cons(2, null)) = [1, [2, null]]

function conso(h, t, l) {
  return eq([h, t], l);
}

function firsto(l, h) {
  return fresh(t => eq([h, t], l));
}

function resto(l, t) {
  return fresh(h => eq([h, t], l));
}

function emptyo(l) {
  return eq(l, null);
}

function membero(x, l) {
  return conde(
    [firsto(l, x)],
    [fresh(t => conj(resto(l, t), membero(x, t)))]
  );
}

function appendo2(l, s, out) {
  return conde(
    [emptyo(l), eq(s, out)],
    [fresh((h, t, res) => conj(
      conso(h, t, l),
      conso(h, res, out),
      appendo2(t, s, res)
    ))]
  );
}

// ─── Helpers ────────────────────────────────────────

function cons(x) {
  // helper for building linked lists
  return x;
}

function toList(...items) {
  let result = null;
  for (let i = items.length - 1; i >= 0; i--) {
    result = [items[i], result];
  }
  return result;
}

function fromList(l) {
  const arr = [];
  while (l !== null && Array.isArray(l) && l.length === 2) {
    arr.push(l[0]);
    l = l[1];
  }
  return arr;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(k => deepEqual(a[k], b[k]));
  }
  return false;
}

// ─── Constraint Extensions ──────────────────────────

// symbolo(x) — x must be a string/symbol
function symbolo(x) {
  return (s) => {
    const v = walk(x, s);
    if (isLvar(v)) return [s, EMPTY]; // postpone
    if (typeof v === 'string') return [s, EMPTY];
    return EMPTY;
  };
}

// numbero(x) — x must be a number
function numbero(x) {
  return (s) => {
    const v = walk(x, s);
    if (isLvar(v)) return [s, EMPTY]; // postpone
    if (typeof v === 'number') return [s, EMPTY];
    return EMPTY;
  };
}

// ─── Export ─────────────────────────────────────────

module.exports = {
  // Core
  lvar, isLvar, LVar,
  walk, deepWalk, unify,
  // Streams
  EMPTY, mplus, bind, pull, takeAll, take,
  // Goals
  eq, neq, succeed, fail, conde, conj, disj, fresh,
  // Run
  run, runAll, reify,
  // Relations
  conso, firsto, resto, emptyo, membero, appendo: appendo2,
  // Helpers
  toList, fromList, zzz,
  // Constraints
  symbolo, numbero,
};
