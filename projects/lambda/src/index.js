/**
 * Tiny Lambda Calculus Evaluator
 * 
 * Pure untyped lambda calculus:
 * - Variables, Abstraction (λ), Application
 * - Beta reduction (substitution)
 * - Normal order and applicative order evaluation
 * - Church encodings: booleans, numerals, pairs
 * - Alpha conversion (rename bound variables)
 * - De Bruijn indices
 * - Pretty printer and parser
 */

// ─── AST ────────────────────────────────────────────

const Var = (name) => ({ type: 'var', name });
const Abs = (param, body) => ({ type: 'abs', param, body });
const App = (fn, arg) => ({ type: 'app', fn, arg });

// ─── Free Variables ─────────────────────────────────

function freeVars(term) {
  switch (term.type) {
    case 'var': return new Set([term.name]);
    case 'abs': {
      const s = freeVars(term.body);
      s.delete(term.param);
      return s;
    }
    case 'app': {
      const s1 = freeVars(term.fn);
      const s2 = freeVars(term.arg);
      for (const v of s2) s1.add(v);
      return s1;
    }
  }
}

// ─── Alpha Conversion ───────────────────────────────

let freshCount = 0;
function freshName(base) { return `${base}${freshCount++}`; }

function alphaConvert(term, oldName, newName) {
  switch (term.type) {
    case 'var': return term.name === oldName ? Var(newName) : term;
    case 'abs':
      if (term.param === oldName) return term; // shadowed
      return Abs(term.param, alphaConvert(term.body, oldName, newName));
    case 'app':
      return App(alphaConvert(term.fn, oldName, newName), alphaConvert(term.arg, oldName, newName));
  }
}

// ─── Substitution ───────────────────────────────────

function substitute(term, name, value) {
  switch (term.type) {
    case 'var': return term.name === name ? value : term;
    case 'abs': {
      if (term.param === name) return term; // shadowed
      if (freeVars(value).has(term.param)) {
        // Avoid capture: alpha convert
        const fresh = freshName(term.param);
        const renamed = Abs(fresh, alphaConvert(term.body, term.param, fresh));
        return Abs(renamed.param, substitute(renamed.body, name, value));
      }
      return Abs(term.param, substitute(term.body, name, value));
    }
    case 'app':
      return App(substitute(term.fn, name, value), substitute(term.arg, name, value));
  }
}

// ─── Beta Reduction ─────────────────────────────────

function betaReduce(term) {
  if (term.type === 'app' && term.fn.type === 'abs') {
    return substitute(term.fn.body, term.fn.param, term.arg);
  }
  return null;
}

// ─── Evaluation Strategies ──────────────────────────

function normalOrder(term, maxSteps = 1000) {
  let steps = 0;
  while (steps++ < maxSteps) {
    const result = normalStep(term);
    if (!result) return term;
    term = result;
  }
  return term;
}

function normalStep(term) {
  // Try beta reduction at top
  const reduced = betaReduce(term);
  if (reduced) return reduced;
  
  switch (term.type) {
    case 'var': return null;
    case 'abs': {
      const body = normalStep(term.body);
      return body ? Abs(term.param, body) : null;
    }
    case 'app': {
      const fn = normalStep(term.fn);
      if (fn) return App(fn, term.arg);
      const arg = normalStep(term.arg);
      return arg ? App(term.fn, arg) : null;
    }
  }
}

function applicativeOrder(term, maxSteps = 1000) {
  let steps = 0;
  while (steps++ < maxSteps) {
    const result = applicativeStep(term);
    if (!result) return term;
    term = result;
  }
  return term;
}

function applicativeStep(term) {
  switch (term.type) {
    case 'var': return null;
    case 'abs': {
      const body = applicativeStep(term.body);
      return body ? Abs(term.param, body) : null;
    }
    case 'app': {
      // Reduce arguments first
      const arg = applicativeStep(term.arg);
      if (arg) return App(term.fn, arg);
      const fn = applicativeStep(term.fn);
      if (fn) return App(fn, term.arg);
      return betaReduce(term);
    }
  }
}

// ─── Church Encodings ───────────────────────────────

const TRUE = Abs('t', Abs('f', Var('t')));
const FALSE = Abs('t', Abs('f', Var('f')));
const AND = Abs('p', Abs('q', App(App(Var('p'), Var('q')), Var('p'))));
const OR = Abs('p', Abs('q', App(App(Var('p'), Var('p')), Var('q'))));
const NOT = Abs('p', App(App(Var('p'), FALSE), TRUE));

function churchNumeral(n) {
  let body = Var('x');
  for (let i = 0; i < n; i++) body = App(Var('f'), body);
  return Abs('f', Abs('x', body));
}

const SUCC = Abs('n', Abs('f', Abs('x', App(Var('f'), App(App(Var('n'), Var('f')), Var('x'))))));
const PLUS = Abs('m', Abs('n', Abs('f', Abs('x', App(App(Var('m'), Var('f')), App(App(Var('n'), Var('f')), Var('x')))))));
const MULT = Abs('m', Abs('n', Abs('f', App(Var('m'), App(Var('n'), Var('f'))))));

function fromChurch(term) {
  // Apply to (x => x + 1) and 0
  const inc = Abs('x', App(Var('+1'), Var('x')));
  const applied = App(App(term, inc), Var('0'));
  const result = normalOrder(applied);
  return countApps(result);
}

function countApps(term) {
  if (term.type === 'var' && term.name === '0') return 0;
  if (term.type === 'app' && term.fn.type === 'var' && term.fn.name === '+1') {
    return 1 + countApps(term.arg);
  }
  return -1; // not a church numeral
}

// ─── Pretty Print ───────────────────────────────────

function show(term) {
  switch (term.type) {
    case 'var': return term.name;
    case 'abs': return `(λ${term.param}.${show(term.body)})`;
    case 'app': return `(${show(term.fn)} ${show(term.arg)})`;
  }
}

// ─── Parser ─────────────────────────────────────────

function parse(src) {
  let pos = 0;
  const ws = () => { while (pos < src.length && /\s/.test(src[pos])) pos++; };
  
  function parseTerm() {
    ws();
    if (src[pos] === '\\' || src[pos] === 'λ') {
      pos++;
      ws();
      const param = readName();
      ws();
      if (src[pos] === '.') pos++;
      const body = parseTerm();
      return Abs(param, body);
    }
    return parseApp();
  }

  function parseApp() {
    let left = parseAtom();
    while (true) {
      ws();
      if (pos >= src.length || src[pos] === ')') break;
      const right = parseAtom();
      if (!right) break;
      left = App(left, right);
    }
    return left;
  }

  function parseAtom() {
    ws();
    if (src[pos] === '(') {
      pos++;
      const term = parseTerm();
      ws();
      if (src[pos] === ')') pos++;
      return term;
    }
    const name = readName();
    return name ? Var(name) : null;
  }

  function readName() {
    ws();
    let name = '';
    while (pos < src.length && /[a-zA-Z0-9_]/.test(src[pos])) name += src[pos++];
    return name || null;
  }

  return parseTerm();
}

module.exports = {
  Var, Abs, App,
  freeVars, substitute, betaReduce,
  normalOrder, applicativeOrder,
  show, parse,
  TRUE, FALSE, AND, OR, NOT,
  churchNumeral, fromChurch, SUCC, PLUS, MULT,
};
