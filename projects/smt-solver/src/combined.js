// Combined DPLL(T) solver with both EUF and Difference Logic
// Extends sexpToLiteral to handle arithmetic comparisons

import { DPLLTSolver, parseSexp, parseSmtLib, sexpToLiteral as baseSexpToLiteral } from './dpll-t.js';
import { DiffLogicSolver, DifferenceConstraint, diff, upperBound, lowerBound } from './diff-logic.js';
import { term, eq, neq, TheoryLiteral } from './euf.js';

// Arithmetic comparison literal (for difference logic)
export class ArithLiteral {
  constructor(x, y, op, bound) {
    this.x = x;      // variable name
    this.y = y;       // variable name (or '__zero' for absolute bounds)
    this.op = op;     // '<=', '>=', '<', '>', '='
    this.bound = bound; // numeric constant
  }
  
  toString() {
    if (this.y === '__zero') return `${this.x} ${this.op} ${this.bound}`;
    return `${this.x} - ${this.y} ${this.op} ${this.bound}`;
  }
  
  negate() {
    const negOps = { '<=': '>', '>=': '<', '<': '>=', '>': '<=', '=': '!=' };
    return new ArithLiteral(this.x, this.y, negOps[this.op], this.bound);
  }
  
  toDifferenceConstraint() {
    return new DifferenceConstraint(this.x, this.y, this.bound, this.op);
  }
}

// Extended sexp → literal that handles arithmetic
export function extendedSexpToLiteral(sexp, termCache = new Map()) {
  if (!Array.isArray(sexp)) return baseSexpToLiteral(sexp, termCache);
  
  const op = sexp[0];
  
  // Arithmetic comparisons
  if (['<=', '>=', '<', '>'].includes(op)) {
    const lhs = parseArithExpr(sexp[1]);
    const rhs = parseArithExpr(sexp[2]);
    
    // Handle difference expression: (op (- x y) c) → x - y op c
    if (lhs.diffVar) {
      const bound = (rhs.offset || 0) - lhs.offset;
      return new ArithLiteral(lhs.varName, lhs.diffVar, op, bound);
    }
    
    // Simple: lhsVar + lhsOff op rhsVar + rhsOff → lhsVar - rhsVar op rhsOff - lhsOff
    const x = lhs.varName || '__zero';
    const y = rhs.varName || '__zero';
    const bound = (rhs.offset || 0) - (lhs.offset || 0);
    
    return new ArithLiteral(x, y, op, bound);
  }
  
  // Equality on arithmetic
  if (op === '=' && sexp.length === 3) {
    const lhs = parseArithExpr(sexp[1]);
    const rhs = parseArithExpr(sexp[2]);
    
    // If both sides have variable names or differences, it's arithmetic equality
    if (lhs.varName || rhs.varName || lhs.diffVar || rhs.diffVar) {
      // Check if it's EUF (function applications) vs arithmetic
      if (lhs.isFunction || rhs.isFunction) {
        return baseSexpToLiteral(sexp, termCache);
      }
      
      // Handle difference: (= (- x y) c) or (= x (+ y c))
      if (lhs.diffVar) {
        const bound = (rhs.offset || 0) - (lhs.offset || 0);
        return new ArithLiteral(lhs.varName, lhs.diffVar, '=', bound);
      }
      if (rhs.diffVar) {
        const bound = (lhs.offset || 0) - (rhs.offset || 0);
        return new ArithLiteral(rhs.diffVar, rhs.varName, '=', -bound);
      }
      
      const x = lhs.varName || '__zero';
      const y = rhs.varName || '__zero';
      const bound = (rhs.offset || 0) - (lhs.offset || 0);
      return new ArithLiteral(x, y, '=', bound);
    }
    
    // Fall through to base parser for non-arithmetic
    return baseSexpToLiteral(sexp, termCache);
  }
  
  // Handle 'not', 'and', 'or', '=>' by recursing with extended parser
  if (op === 'not') {
    const inner = extendedSexpToLiteral(sexp[1], termCache);
    if (inner instanceof ArithLiteral) return inner.negate();
    if (inner instanceof TheoryLiteral) return inner.negate();
    return { type: 'not', child: inner };
  }
  
  if (op === 'and') {
    return { type: 'and', children: sexp.slice(1).map(s => extendedSexpToLiteral(s, termCache)) };
  }
  
  if (op === 'or') {
    return { type: 'or', children: sexp.slice(1).map(s => extendedSexpToLiteral(s, termCache)) };
  }
  
  if (op === '=>') {
    return {
      type: 'implies',
      left: extendedSexpToLiteral(sexp[1], termCache),
      right: extendedSexpToLiteral(sexp[2], termCache),
    };
  }
  
  if (op === 'distinct') {
    const lhs = parseArithExpr(sexp[1]);
    const rhs = parseArithExpr(sexp[2]);
    if (lhs.varName || rhs.varName) {
      const x = lhs.varName || '__zero';
      const y = rhs.varName || '__zero';
      const bound = rhs.offset - lhs.offset;
      return new ArithLiteral(x, y, '!=', bound);
    }
    return baseSexpToLiteral(sexp, termCache);
  }
  
  return baseSexpToLiteral(sexp, termCache);
}

// Parse simple arithmetic expression: variable, number, or (+ var num) / (- var num)
function parseArithExpr(sexp) {
  if (typeof sexp === 'number') {
    return { varName: null, offset: sexp, isFunction: false };
  }
  if (typeof sexp === 'string') {
    return { varName: sexp, offset: 0, isFunction: false };
  }
  if (Array.isArray(sexp)) {
    const op = sexp[0];
    if (op === '+' && sexp.length === 3) {
      const l = parseArithExpr(sexp[1]);
      const r = parseArithExpr(sexp[2]);
      return { 
        varName: l.varName || r.varName, 
        offset: l.offset + r.offset,
        isFunction: l.isFunction || r.isFunction,
      };
    }
    if (op === '-' && sexp.length === 3) {
      const l = parseArithExpr(sexp[1]);
      const r = parseArithExpr(sexp[2]);
      if (l.varName && r.varName) {
        // x - y → treat as difference variable
        return { varName: l.varName, offset: l.offset - r.offset, diffVar: r.varName, isFunction: false };
      }
      return { 
        varName: l.varName || null, 
        offset: l.offset - r.offset,
        isFunction: l.isFunction || r.isFunction,
      };
    }
    if (op === '-' && sexp.length === 2) {
      const r = parseArithExpr(sexp[1]);
      return { varName: null, offset: -r.offset, isFunction: r.isFunction };
    }
    // Function application
    return { varName: null, offset: 0, isFunction: true };
  }
  return { varName: null, offset: 0, isFunction: false };
}

// ===== Combined SMT Solver =====

export class CombinedSMTSolver {
  constructor() {
    this.dpllT = new DPLLTSolver();
    this.diffLogic = new DiffLogicSolver();
    this.arithLiterals = new Map(); // boolVar → ArithLiteral
    this.boolVarCounter = 0;
    this.arithVarMap = new Map();   // literal_key → boolVar
  }
  
  _boolVarFor(literal) {
    const key = literal.toString();
    if (this.arithVarMap.has(key)) return this.arithVarMap.get(key);
    const v = ++this.boolVarCounter + 10000; // offset to avoid collision with DPLL(T) vars
    this.arithVarMap.set(key, v);
    this.arithLiterals.set(v, literal);
    this.diffLogic.addVariable(literal.x);
    this.diffLogic.addVariable(literal.y);
    return v;
  }
  
  assert(formula) {
    if (formula instanceof ArithLiteral) {
      // Pure arithmetic — assert directly to diff logic
      const constraint = formula.toDifferenceConstraint();
      const conflict = this.diffLogic.assertConstraint(constraint);
      return conflict;
    }
    
    if (formula instanceof TheoryLiteral) {
      this.dpllT.assert(formula);
      return null;
    }
    
    if (formula.type === 'and') {
      for (const child of formula.children) {
        const conflict = this.assert(child);
        if (conflict) return conflict;
      }
      return null;
    }
    
    // For now, handle simple cases directly
    if (formula.type === 'or' || formula.type === 'not' || formula.type === 'implies') {
      // Complex Boolean structure — need full DPLL(T) integration
      // For now, just pass to EUF solver
      this.dpllT.assert(formula);
      return null;
    }
    
    return null;
  }
  
  solve() {
    // Check diff logic consistency
    const diffConflict = this.diffLogic.checkConsistency();
    if (diffConflict) return { sat: false, stats: { diffConflict } };
    
    // Check EUF consistency
    const eufResult = this.dpllT.solve();
    if (!eufResult.sat) return eufResult;
    
    // Both consistent
    const model = new Map();
    
    // Add EUF model
    if (eufResult.model) {
      for (const [k, v] of eufResult.model) model.set(`bool_${k}`, v);
    }
    
    // Add diff logic model
    const arithModel = this.diffLogic.getModel();
    if (arithModel) {
      for (const [k, v] of arithModel) model.set(k, v);
    }
    
    return { sat: true, model, stats: eufResult.stats };
  }
}

// High-level API for combined solving
export function solveSmtCombined(smtLib) {
  const { declarations, assertions } = parseSmtLib(smtLib);
  const solver = new CombinedSMTSolver();
  const termCache = new Map();
  
  for (const assertion of assertions) {
    const formula = extendedSexpToLiteral(assertion, termCache);
    const conflict = solver.assert(formula);
    if (conflict) return { sat: false, conflict };
  }
  
  return solver.solve();
}
