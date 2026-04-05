// Operational Semantics — Small-step and Big-step for a simple language
//
// Language: integers, booleans, arithmetic, comparisons, if, let, lambda, application
// Small-step: e → e' (one step at a time, with derivation trace)
// Big-step: e ⇓ v (direct evaluation to a value)

// ============================================================
// AST
// ============================================================

class Num { constructor(n) { this.kind = 'num'; this.n = n; } }
class Bool_ { constructor(b) { this.kind = 'bool'; this.b = b; } }
class BinOp { constructor(op, l, r) { this.kind = 'binop'; this.op = op; this.l = l; this.r = r; } }
class If { constructor(c, t, e) { this.kind = 'if'; this.c = c; this.t = t; this.e = e; } }
class Var { constructor(name) { this.kind = 'var'; this.name = name; } }
class Let { constructor(name, val, body) { this.kind = 'let'; this.name = name; this.val = val; this.body = body; } }
class Lam { constructor(param, body) { this.kind = 'lam'; this.param = param; this.body = body; } }
class App { constructor(fn, arg) { this.kind = 'app'; this.fn = fn; this.arg = arg; } }

function isValue(e) {
  return e.kind === 'num' || e.kind === 'bool' || e.kind === 'lam';
}

function exprEqual(a, b) {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'num': return a.n === b.n;
    case 'bool': return a.b === b.b;
    case 'var': return a.name === b.name;
    case 'binop': return a.op === b.op && exprEqual(a.l, b.l) && exprEqual(a.r, b.r);
    case 'if': return exprEqual(a.c, b.c) && exprEqual(a.t, b.t) && exprEqual(a.e, b.e);
    case 'let': return a.name === b.name && exprEqual(a.val, b.val) && exprEqual(a.body, b.body);
    case 'lam': return a.param === b.param && exprEqual(a.body, b.body);
    case 'app': return exprEqual(a.fn, b.fn) && exprEqual(a.arg, b.arg);
  }
}

function prettyPrint(e) {
  switch (e.kind) {
    case 'num': return String(e.n);
    case 'bool': return String(e.b);
    case 'var': return e.name;
    case 'binop': return `(${prettyPrint(e.l)} ${e.op} ${prettyPrint(e.r)})`;
    case 'if': return `if ${prettyPrint(e.c)} then ${prettyPrint(e.t)} else ${prettyPrint(e.e)}`;
    case 'let': return `let ${e.name} = ${prettyPrint(e.val)} in ${prettyPrint(e.body)}`;
    case 'lam': return `λ${e.param}.${prettyPrint(e.body)}`;
    case 'app': return `(${prettyPrint(e.fn)} ${prettyPrint(e.arg)})`;
  }
}

// ============================================================
// Substitution (capture-avoiding, simple version)
// ============================================================

function subst(expr, name, replacement) {
  switch (expr.kind) {
    case 'num': case 'bool': return expr;
    case 'var': return expr.name === name ? replacement : expr;
    case 'binop': return new BinOp(expr.op, subst(expr.l, name, replacement), subst(expr.r, name, replacement));
    case 'if': return new If(subst(expr.c, name, replacement), subst(expr.t, name, replacement), subst(expr.e, name, replacement));
    case 'let':
      if (expr.name === name) return new Let(expr.name, subst(expr.val, name, replacement), expr.body);
      return new Let(expr.name, subst(expr.val, name, replacement), subst(expr.body, name, replacement));
    case 'lam':
      if (expr.param === name) return expr; // shadowed
      return new Lam(expr.param, subst(expr.body, name, replacement));
    case 'app': return new App(subst(expr.fn, name, replacement), subst(expr.arg, name, replacement));
  }
}

// ============================================================
// Small-Step Semantics (e → e')
// ============================================================

class StepResult {
  constructor(expr, rule) { this.expr = expr; this.rule = rule; }
}

function smallStep(e) {
  switch (e.kind) {
    case 'num': case 'bool': case 'lam': case 'var':
      return null; // values/vars don't step
    
    case 'binop': {
      // Evaluate left first
      if (!isValue(e.l)) {
        const s = smallStep(e.l);
        if (s) return new StepResult(new BinOp(e.op, s.expr, e.r), `BinOp-Left(${s.rule})`);
        return null;
      }
      // Then right
      if (!isValue(e.r)) {
        const s = smallStep(e.r);
        if (s) return new StepResult(new BinOp(e.op, e.l, s.expr), `BinOp-Right(${s.rule})`);
        return null;
      }
      // Both values — compute
      if (e.l.kind === 'num' && e.r.kind === 'num') {
        switch (e.op) {
          case '+': return new StepResult(new Num(e.l.n + e.r.n), 'Add');
          case '-': return new StepResult(new Num(e.l.n - e.r.n), 'Sub');
          case '*': return new StepResult(new Num(e.l.n * e.r.n), 'Mul');
          case '/': return new StepResult(new Num(Math.trunc(e.l.n / e.r.n)), 'Div');
          case '<': return new StepResult(new Bool_(e.l.n < e.r.n), 'Lt');
          case '>': return new StepResult(new Bool_(e.l.n > e.r.n), 'Gt');
          case '==': return new StepResult(new Bool_(e.l.n === e.r.n), 'Eq');
        }
      }
      return null;
    }
    
    case 'if': {
      if (!isValue(e.c)) {
        const s = smallStep(e.c);
        if (s) return new StepResult(new If(s.expr, e.t, e.e), `If-Cond(${s.rule})`);
        return null;
      }
      if (e.c.kind === 'bool') {
        return e.c.b
          ? new StepResult(e.t, 'If-True')
          : new StepResult(e.e, 'If-False');
      }
      return null;
    }
    
    case 'let': {
      if (!isValue(e.val)) {
        const s = smallStep(e.val);
        if (s) return new StepResult(new Let(e.name, s.expr, e.body), `Let-Val(${s.rule})`);
        return null;
      }
      return new StepResult(subst(e.body, e.name, e.val), 'Let-Subst');
    }
    
    case 'app': {
      // Evaluate fn first
      if (!isValue(e.fn)) {
        const s = smallStep(e.fn);
        if (s) return new StepResult(new App(s.expr, e.arg), `App-Fn(${s.rule})`);
        return null;
      }
      // Then arg
      if (!isValue(e.arg)) {
        const s = smallStep(e.arg);
        if (s) return new StepResult(new App(e.fn, s.expr), `App-Arg(${s.rule})`);
        return null;
      }
      // Beta reduction
      if (e.fn.kind === 'lam') {
        return new StepResult(subst(e.fn.body, e.fn.param, e.arg), 'Beta');
      }
      return null;
    }
  }
  return null;
}

// Multi-step with trace
function smallStepTrace(e, maxSteps = 100) {
  const trace = [{ expr: e, rule: 'Start' }];
  let current = e;
  for (let i = 0; i < maxSteps; i++) {
    const step = smallStep(current);
    if (!step) break;
    trace.push({ expr: step.expr, rule: step.rule });
    current = step.expr;
  }
  return { result: current, trace, steps: trace.length - 1 };
}

// ============================================================
// Big-Step Semantics (e ⇓ v)
// ============================================================

class BigStepResult {
  constructor(value, derivation) { this.value = value; this.derivation = derivation; }
}

function bigStep(e, env = new Map()) {
  switch (e.kind) {
    case 'num': return new BigStepResult(e, { rule: 'Num', expr: e });
    case 'bool': return new BigStepResult(e, { rule: 'Bool', expr: e });
    case 'lam': return new BigStepResult(e, { rule: 'Lam', expr: e });
    
    case 'var': {
      if (!env.has(e.name)) throw new Error(`Unbound: ${e.name}`);
      return new BigStepResult(env.get(e.name), { rule: 'Var', name: e.name });
    }
    
    case 'binop': {
      const lr = bigStep(e.l, env);
      const rr = bigStep(e.r, env);
      let result;
      switch (e.op) {
        case '+': result = new Num(lr.value.n + rr.value.n); break;
        case '-': result = new Num(lr.value.n - rr.value.n); break;
        case '*': result = new Num(lr.value.n * rr.value.n); break;
        case '/': result = new Num(Math.trunc(lr.value.n / rr.value.n)); break;
        case '<': result = new Bool_(lr.value.n < rr.value.n); break;
        case '>': result = new Bool_(lr.value.n > rr.value.n); break;
        case '==': result = new Bool_(lr.value.n === rr.value.n); break;
        default: throw new Error(`Unknown op: ${e.op}`);
      }
      return new BigStepResult(result, { rule: 'BinOp', op: e.op, left: lr.derivation, right: rr.derivation });
    }
    
    case 'if': {
      const cr = bigStep(e.c, env);
      if (cr.value.b) {
        const tr = bigStep(e.t, env);
        return new BigStepResult(tr.value, { rule: 'If-True', cond: cr.derivation, body: tr.derivation });
      } else {
        const er = bigStep(e.e, env);
        return new BigStepResult(er.value, { rule: 'If-False', cond: cr.derivation, body: er.derivation });
      }
    }
    
    case 'let': {
      const vr = bigStep(e.val, env);
      const newEnv = new Map(env);
      newEnv.set(e.name, vr.value);
      const br = bigStep(e.body, newEnv);
      return new BigStepResult(br.value, { rule: 'Let', val: vr.derivation, body: br.derivation });
    }
    
    case 'app': {
      const fr = bigStep(e.fn, env);
      const ar = bigStep(e.arg, env);
      if (fr.value.kind !== 'lam') throw new Error('Not a function');
      const newEnv = new Map(env);
      newEnv.set(fr.value.param, ar.value);
      const br = bigStep(fr.value.body, newEnv);
      return new BigStepResult(br.value, { rule: 'App', fn: fr.derivation, arg: ar.derivation, body: br.derivation });
    }
  }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  Num, Bool_, BinOp, If, Var, Let, Lam, App,
  isValue, exprEqual, prettyPrint, subst,
  smallStep, smallStepTrace, StepResult,
  bigStep, BigStepResult,
};
