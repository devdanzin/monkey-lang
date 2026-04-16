/**
 * Algorithm W Step-by-Step Tracer
 * 
 * Shows the inference process step by step:
 * - Each expression visited
 * - Each unification performed
 * - Each substitution applied
 * - Each generalization and instantiation
 * 
 * Usage:
 *   import { traceInference } from './type-tracer.js';
 *   const trace = traceInference('let id = fn(x) { x }; id(5)');
 *   trace.steps.forEach(s => console.log(s.toString()));
 */

import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import * as ast from './ast.js';
import {
  typecheck, TypeChecker,
  TVar, TCon, TFun, TArray, THash, Scheme,
  tInt, tFloat, tBool, tString, tNull, tVoid,
  Subst, unify, freshVar, resetFresh,
  generalize, instantiateScheme, freeTypeVars
} from './typechecker.js';

// ============================================================
// Trace Steps
// ============================================================

class Step {
  constructor(type, data) {
    this.type = type;
    this.data = data;
    this.timestamp = Date.now();
  }
  
  toString() {
    switch (this.type) {
      case 'infer':
        return `INFER ${this.data.exprType}: ${this.data.expr} ⇒ ${this.data.resultType}`;
      case 'unify':
        return `UNIFY ${this.data.t1} ~ ${this.data.t2} ${this.data.success ? '✓' : '✗ ' + this.data.error}`;
      case 'subst':
        return `SUBST ${this.data.var} ↦ ${this.data.type}`;
      case 'generalize':
        return `GENERALIZE ${this.data.name}: ${this.data.type} ⇒ ${this.data.scheme}`;
      case 'instantiate':
        return `INSTANTIATE ${this.data.name}: ${this.data.scheme} ⇒ ${this.data.type}`;
      case 'env':
        return `ENV ${this.data.action} ${this.data.name}: ${this.data.type}`;
      case 'error':
        return `ERROR ${this.data.message}`;
      default:
        return `${this.type}: ${JSON.stringify(this.data)}`;
    }
  }
}

// ============================================================
// Tracing Type Checker
// ============================================================

class TracingTypeChecker extends TypeChecker {
  constructor() {
    super();
    this.steps = [];
    this.depth = 0;
  }
  
  _trace(type, data) {
    const step = new Step(type, { ...data, depth: this.depth });
    this.steps.push(step);
    return step;
  }
  
  _inferExpr(expr, env) {
    if (!expr) return tNull;
    
    const exprName = expr.constructor?.name || 'unknown';
    let exprStr = '';
    try {
      if (expr instanceof ast.Identifier) exprStr = expr.value;
      else if (expr instanceof ast.IntegerLiteral) exprStr = `${expr.value}`;
      else if (expr instanceof ast.StringLiteral) exprStr = `"${expr.value}"`;
      else if (expr instanceof ast.BooleanLiteral) exprStr = `${expr.value}`;
      else if (expr instanceof ast.InfixExpression) exprStr = `_ ${expr.operator} _`;
      else if (expr instanceof ast.FunctionLiteral) exprStr = `fn(${expr.parameters.map(p => p.value).join(',')})`;
      else if (expr instanceof ast.CallExpression) exprStr = `call(...)`;
      else exprStr = exprName;
    } catch { exprStr = exprName; }
    
    this.depth++;
    const result = super._inferExpr(expr, env);
    this.depth--;
    
    this._trace('infer', {
      exprType: exprName,
      expr: exprStr,
      resultType: this.subst.apply(result).toString(),
    });
    
    return result;
  }
  
  _checkLet(stmt, env) {
    const name = stmt.name.value;
    this._trace('env', { action: 'let', name, type: '(inferring...)' });
    
    const placeholder = freshVar();
    env.set(name, placeholder);
    
    const valueType = this._inferExpr(stmt.value, env);
    try {
      this._unify(placeholder, valueType, stmt);
    } catch {}
    
    env.bindings.delete(name);
    const scheme = generalize(env, this.subst, valueType);
    env.set(name, scheme);
    
    this._trace('generalize', {
      name,
      type: this.subst.apply(valueType).toString(),
      scheme: scheme.toString(),
    });
    
    return tVoid;
  }
  
  _inferIdent(expr, env) {
    const t = env.get(expr.value);
    if (!t) {
      this._trace('error', { message: `Undefined variable: ${expr.value}` });
      return freshVar();
    }
    
    const instantiated = instantiateScheme(t);
    
    if (t instanceof Scheme && t.vars.length > 0) {
      this._trace('instantiate', {
        name: expr.value,
        scheme: t.toString(),
        type: this.subst.apply(instantiated).toString(),
      });
    }
    
    return this.subst.apply(instantiated);
  }
  
  _unify(t1, t2, node) {
    const t1Str = this.subst.apply(t1).toString();
    const t2Str = this.subst.apply(t2).toString();
    
    try {
      const s = unify(this.subst.apply(t1), this.subst.apply(t2));
      this.subst = s.compose(this.subst);
      
      this._trace('unify', { t1: t1Str, t2: t2Str, success: true });
      
      // Log new substitutions
      for (const [k, v] of s.map) {
        this._trace('subst', { var: k, type: v.toString() });
      }
    } catch (e) {
      this._trace('unify', { t1: t1Str, t2: t2Str, success: false, error: e.message });
      throw e;
    }
  }
}

// ============================================================
// Public API
// ============================================================

function traceInference(code) {
  const l = new Lexer(code);
  const p = new Parser(l);
  const program = p.parseProgram();
  
  if (p.errors.length > 0) {
    return { steps: [], errors: p.errors, parseErrors: true };
  }
  
  resetFresh();
  const checker = new TracingTypeChecker();
  const { errors, env } = checker.check(program);
  
  return {
    steps: checker.steps,
    errors,
    env,
    subst: checker.subst,
  };
}

function formatTrace(trace) {
  const lines = [];
  for (const step of trace.steps) {
    const indent = '  '.repeat(step.data.depth || 0);
    lines.push(`${indent}${step.toString()}`);
  }
  if (trace.errors.length > 0) {
    lines.push('');
    lines.push('TYPE ERRORS:');
    for (const err of trace.errors) {
      lines.push(`  ${err.message}`);
    }
  }
  return lines.join('\n');
}

export { traceInference, formatTrace, TracingTypeChecker, Step };
