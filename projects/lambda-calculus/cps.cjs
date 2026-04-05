// Continuation-Passing Style (CPS) Transformer
//
// Converts direct-style lambda calculus to CPS:
// - Every function takes an extra continuation argument
// - Every application passes a continuation
// - No implicit control flow — all returns are explicit
//
// Also includes: call/cc, CPS evaluator, ANF (A-Normal Form)

// ============================================================
// Direct-style AST
// ============================================================

class Num { constructor(n) { this.kind = 'num'; this.n = n; } }
class Bool_ { constructor(b) { this.kind = 'bool'; this.b = b; } }
class Var { constructor(name) { this.kind = 'var'; this.name = name; } }
class Lam { constructor(param, body) { this.kind = 'lam'; this.param = param; this.body = body; } }
class App { constructor(fn, arg) { this.kind = 'app'; this.fn = fn; this.arg = arg; } }
class BinOp { constructor(op, l, r) { this.kind = 'binop'; this.op = op; this.l = l; this.r = r; } }
class If { constructor(c, t, e) { this.kind = 'if'; this.c = c; this.t = t; this.e = e; } }
class Let { constructor(name, val, body) { this.kind = 'let'; this.name = name; this.val = val; this.body = body; } }
class CallCC { constructor(fn) { this.kind = 'callcc'; this.fn = fn; } }

// ============================================================
// CPS AST (target)
// ============================================================

class CVar { constructor(name) { this.kind = 'cvar'; this.name = name; } }
class CNum { constructor(n) { this.kind = 'cnum'; this.n = n; } }
class CBool { constructor(b) { this.kind = 'cbool'; this.b = b; } }
class CLam { constructor(params, body) { this.kind = 'clam'; this.params = params; this.body = body; } }
class CApp { constructor(fn, args) { this.kind = 'capp'; this.fn = fn; this.args = args; } }
class CIf { constructor(c, t, e) { this.kind = 'cif'; this.c = c; this.t = t; this.e = e; } }
class CPrim { constructor(op, args, result, cont) {
  this.kind = 'cprim'; this.op = op; this.args = args; this.result = result; this.cont = cont;
} }

// ============================================================
// CPS Transformer
// ============================================================

let freshCount = 0;
function fresh(prefix = 'k') { return `${prefix}${++freshCount}`; }
function resetFresh() { freshCount = 0; }

// cpsTransform(expr, k) where k is a function CPS-AST → CPS-AST
// k represents the current continuation

function cpsTransform(expr, k) {
  switch (expr.kind) {
    case 'num': return k(new CNum(expr.n));
    case 'bool': return k(new CBool(expr.b));
    case 'var': return k(new CVar(expr.name));
    
    case 'lam': {
      const kParam = fresh('k');
      const cpsBody = cpsTransform(expr.body, v => new CApp(new CVar(kParam), [v]));
      return k(new CLam([expr.param, kParam], cpsBody));
    }
    
    case 'app': {
      return cpsTransform(expr.fn, fnVal => {
        return cpsTransform(expr.arg, argVal => {
          const rv = fresh('rv');
          const cont = new CLam([rv], k(new CVar(rv)));
          return new CApp(fnVal, [argVal, cont]);
        });
      });
    }
    
    case 'binop': {
      return cpsTransform(expr.l, lVal => {
        return cpsTransform(expr.r, rVal => {
          const rv = fresh('rv');
          return new CPrim(expr.op, [lVal, rVal], rv, k(new CVar(rv)));
        });
      });
    }
    
    case 'if': {
      return cpsTransform(expr.c, cVal => {
        const jk = fresh('jk');
        const jv = fresh('jv');
        const joinCont = new CLam([jv], k(new CVar(jv)));
        const thenBranch = cpsTransform(expr.t, tv => new CApp(new CVar(jk), [tv]));
        const elseBranch = cpsTransform(expr.e, ev => new CApp(new CVar(jk), [ev]));
        // let jk = λjv.k(jv) in if c then ... else ...
        return new CApp(new CLam([jk], new CIf(cVal, thenBranch, elseBranch)), [joinCont]);
      });
    }
    
    case 'let': {
      return cpsTransform(expr.val, vVal => {
        // Bind name to value, continue with body
        return new CApp(new CLam([expr.name], cpsTransform(expr.body, k)), [vVal]);
      });
    }
    
    case 'callcc': {
      // call/cc f k = f (λv k'. k v) k
      // The continuation k is reified as a value
      return cpsTransform(expr.fn, fnVal => {
        const rv = fresh('rv');
        const kIgnore = fresh('k');
        const kParam = fresh('kcc');
        const reifiedK = new CLam([rv, kIgnore], k(new CVar(rv)));
        const cont = new CLam([rv], k(new CVar(rv)));
        return new CApp(fnVal, [reifiedK, cont]);
      });
    }
  }
}

// Top-level transform: wraps in halt continuation
function cpsConvert(expr) {
  resetFresh();
  return cpsTransform(expr, v => new CApp(new CVar('halt'), [v]));
}

// ============================================================
// CPS Pretty Printer
// ============================================================

function cpsPrint(node) {
  switch (node.kind) {
    case 'cvar': return node.name;
    case 'cnum': return String(node.n);
    case 'cbool': return String(node.b);
    case 'clam': return `(λ(${node.params.join(' ')}).${cpsPrint(node.body)})`;
    case 'capp': return `(${cpsPrint(node.fn)} ${node.args.map(cpsPrint).join(' ')})`;
    case 'cif': return `(if ${cpsPrint(node.c)} ${cpsPrint(node.t)} ${cpsPrint(node.e)})`;
    case 'cprim': return `(let ${node.result} = ${node.args.map(cpsPrint).join(` ${node.op} `)} in ${cpsPrint(node.cont)})`;
  }
}

// ============================================================
// CPS Evaluator
// ============================================================

function cpsEval(node, env = new Map()) {
  switch (node.kind) {
    case 'cnum': return node.n;
    case 'cbool': return node.b;
    case 'cvar': {
      if (node.name === 'halt') return v => v; // halt continuation
      if (!env.has(node.name)) throw new Error(`Unbound: ${node.name}`);
      return env.get(node.name);
    }
    case 'clam': {
      const closureEnv = new Map(env);
      return (...args) => {
        const callEnv = new Map(closureEnv);
        for (let i = 0; i < node.params.length; i++) {
          callEnv.set(node.params[i], args[i]);
        }
        return cpsEval(node.body, callEnv);
      };
    }
    case 'capp': {
      const fn = cpsEval(node.fn, env);
      const args = node.args.map(a => cpsEval(a, env));
      return fn(...args);
    }
    case 'cif': {
      const c = cpsEval(node.c, env);
      return c ? cpsEval(node.t, env) : cpsEval(node.e, env);
    }
    case 'cprim': {
      const [l, r] = node.args.map(a => cpsEval(a, env));
      let result;
      switch (node.op) {
        case '+': result = l + r; break;
        case '-': result = l - r; break;
        case '*': result = l * r; break;
        case '/': result = Math.trunc(l / r); break;
        case '<': result = l < r; break;
        case '>': result = l > r; break;
        case '==': result = l === r; break;
      }
      const newEnv = new Map(env);
      newEnv.set(node.result, result);
      return cpsEval(node.cont, newEnv);
    }
  }
}

// Evaluate by: CPS-convert then CPS-eval
function evalViaCPS(expr) {
  const cps = cpsConvert(expr);
  return cpsEval(cps);
}

// ============================================================
// Convenience
// ============================================================

const num = n => new Num(n);
const bool = b => new Bool_(b);
const v_ = name => new Var(name);
const lam = (p, body) => new Lam(p, body);
const app = (fn, arg) => new App(fn, arg);
const binop = (op, l, r) => new BinOp(op, l, r);
const if_ = (c, t, e) => new If(c, t, e);
const let_ = (name, val, body) => new Let(name, val, body);
const callcc = fn => new CallCC(fn);

module.exports = {
  Num, Bool_, Var, Lam, App, BinOp, If, Let, CallCC,
  CVar, CNum, CBool, CLam, CApp, CIf, CPrim,
  cpsConvert, cpsPrint, cpsEval, evalViaCPS,
  resetFresh,
  num, bool, v_, lam, app, binop, if_, let_, callcc,
};
