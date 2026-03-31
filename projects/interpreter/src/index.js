/**
 * Tiny Interpreter — Tree-walking evaluator for a small language
 * 
 * Features:
 * - Numbers, strings, booleans
 * - Variables and assignment
 * - Arithmetic, comparison, logic
 * - If/else
 * - While loops
 * - Functions (closures)
 * - Print
 */

class Environment {
  constructor(parent = null) {
    this.vars = new Map();
    this.parent = parent;
  }
  get(name) {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    throw new Error(`Undefined: ${name}`);
  }
  set(name, val) { this.vars.set(name, val); }
  assign(name, val) {
    if (this.vars.has(name)) { this.vars.set(name, val); return; }
    if (this.parent) { this.parent.assign(name, val); return; }
    throw new Error(`Undefined: ${name}`);
  }
}

class Interpreter {
  constructor() {
    this.output = [];
    this.globals = new Environment();
    this.globals.set('print', (...args) => { this.output.push(args.map(String).join(' ')); });
    this.globals.set('len', (v) => v.length);
  }

  run(ast) {
    return this.exec(ast, this.globals);
  }

  exec(node, env) {
    switch (node.type) {
      case 'program': {
        let result = null;
        for (const stmt of node.body) result = this.exec(stmt, env);
        return result;
      }
      case 'number': return node.value;
      case 'string': return node.value;
      case 'boolean': return node.value;
      case 'null': return null;
      case 'identifier': return env.get(node.name);
      
      case 'binary': {
        const l = this.exec(node.left, env);
        const r = this.exec(node.right, env);
        switch (node.op) {
          case '+': return l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/': return l / r;
          case '%': return l % r;
          case '==': return l === r;
          case '!=': return l !== r;
          case '<': return l < r;
          case '>': return l > r;
          case '<=': return l <= r;
          case '>=': return l >= r;
          case '&&': return l && r;
          case '||': return l || r;
        }
      }
      
      case 'unary': {
        const v = this.exec(node.expr, env);
        if (node.op === '-') return -v;
        if (node.op === '!') return !v;
      }
      
      case 'let': {
        const val = node.value ? this.exec(node.value, env) : null;
        env.set(node.name, val);
        return val;
      }
      
      case 'assign': {
        const val = this.exec(node.value, env);
        env.assign(node.name, val);
        return val;
      }
      
      case 'if': {
        const cond = this.exec(node.condition, env);
        if (cond) return this.exec(node.then, env);
        else if (node.else) return this.exec(node.else, env);
        return null;
      }
      
      case 'while': {
        let result = null;
        while (this.exec(node.condition, env)) {
          result = this.exec(node.body, env);
        }
        return result;
      }
      
      case 'block': {
        const blockEnv = new Environment(env);
        let result = null;
        for (const stmt of node.body) result = this.exec(stmt, blockEnv);
        return result;
      }
      
      case 'function': {
        const closure = env;
        const fn = (...args) => {
          const fnEnv = new Environment(closure);
          node.params.forEach((p, i) => fnEnv.set(p, args[i]));
          return this.exec(node.body, fnEnv);
        };
        if (node.name) env.set(node.name, fn);
        return fn;
      }
      
      case 'call': {
        const fn = this.exec(node.callee, env);
        const args = node.args.map(a => this.exec(a, env));
        return fn(...args);
      }
      
      case 'return': return this.exec(node.value, env);
      
      default: throw new Error(`Unknown node: ${node.type}`);
    }
  }

  getOutput() { return this.output.join('\n'); }
}

// Simple AST builders
const num = v => ({ type: 'number', value: v });
const str = v => ({ type: 'string', value: v });
const bool = v => ({ type: 'boolean', value: v });
const id = n => ({ type: 'identifier', name: n });
const bin = (op, l, r) => ({ type: 'binary', op, left: l, right: r });
const un = (op, e) => ({ type: 'unary', op, expr: e });
const let_ = (name, value) => ({ type: 'let', name, value });
const assign = (name, value) => ({ type: 'assign', name, value });
const if_ = (cond, then, else_) => ({ type: 'if', condition: cond, then, else: else_ });
const while_ = (cond, body) => ({ type: 'while', condition: cond, body });
const block = (...body) => ({ type: 'block', body });
const fn = (name, params, body) => ({ type: 'function', name, params, body });
const call = (callee, ...args) => ({ type: 'call', callee, args });
const ret = v => ({ type: 'return', value: v });
const prog = (...body) => ({ type: 'program', body });

module.exports = { Interpreter, Environment, num, str, bool, id, bin, un, let_, assign, if_, while_, block, fn, call, ret, prog };
