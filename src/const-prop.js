/**
 * SSA Constant Propagation for monkey-lang
 * 
 * Sparse Conditional Constant Propagation (SCCP) on SSA form.
 * 
 * Lattice:
 *   ⊤ (top/unknown) → no info yet
 *   constant → known value
 *   ⊥ (bottom/varying) → not constant
 * 
 * Rules:
 *   x = 5           → x is Const(5)
 *   x = y + z       → if y and z are Const, x is Const(y+z); else ⊥
 *   x = φ(a, b)     → if a == b == Const(c), x is Const(c); else ⊥
 *   x = f(args)     → ⊥ (function calls are not constant)
 * 
 * Uses worklist algorithm for efficiency.
 */

import { toSSA, SSAAssign, SSAPhi, SSAReturn, SSAExpr } from './ssa.js';

// ============================================================
// Lattice Values
// ============================================================

const TOP = { tag: 'top' };     // Unknown (no info yet)
const BOTTOM = { tag: 'bottom' }; // Not a constant (varying)

function constVal(v) { return { tag: 'const', value: v }; }

function isConst(v) { return v?.tag === 'const'; }
function isTop(v) { return v?.tag === 'top'; }
function isBottom(v) { return v?.tag === 'bottom'; }

function latticeEqual(a, b) {
  if (a.tag !== b.tag) return false;
  if (a.tag === 'const') return a.value === b.value;
  return true;
}

// Meet operation: ⊤ ⊓ x = x, c ⊓ c = c, c₁ ⊓ c₂ = ⊥
function meet(a, b) {
  if (isTop(a)) return b;
  if (isTop(b)) return a;
  if (isBottom(a) || isBottom(b)) return BOTTOM;
  if (a.value === b.value) return a;
  return BOTTOM;
}

// ============================================================
// Constant Propagation
// ============================================================

class ConstantPropagation {
  constructor() {
    this.values = new Map(); // varName → lattice value
  }

  /**
   * Run constant propagation on SSA blocks
   */
  propagate(ssaBlocks) {
    // Initialize all variables to TOP
    for (const [, block] of ssaBlocks) {
      for (const phi of block.phis) {
        this.values.set(phi.target, TOP);
      }
      for (const instr of block.instructions) {
        if (instr.tag === 'assign') {
          this.values.set(instr.target, TOP);
        }
      }
    }

    // Worklist algorithm
    let changed = true;
    let iterations = 0;
    
    while (changed && iterations < 100) {
      changed = false;
      iterations++;
      
      for (const [, block] of ssaBlocks) {
        // Process phi nodes
        for (const phi of block.phis) {
          const newVal = this._evaluatePhi(phi);
          if (!latticeEqual(newVal, this.values.get(phi.target) || TOP)) {
            this.values.set(phi.target, newVal);
            changed = true;
          }
        }
        
        // Process instructions
        for (const instr of block.instructions) {
          if (instr.tag === 'assign') {
            const newVal = this._evaluateExpr(instr.value);
            if (!latticeEqual(newVal, this.values.get(instr.target) || TOP)) {
              this.values.set(instr.target, newVal);
              changed = true;
            }
          }
        }
      }
    }

    return {
      constants: this._getConstants(),
      iterations,
      allValues: new Map(this.values)
    };
  }

  _evaluatePhi(phi) {
    let result = TOP;
    for (const src of phi.sources) {
      const srcVal = this.values.get(src.var) || BOTTOM;
      result = meet(result, srcVal);
    }
    return result;
  }

  _evaluateExpr(expr) {
    if (typeof expr === 'number') return constVal(expr);
    if (typeof expr === 'boolean') return constVal(expr);
    if (typeof expr === 'string') {
      // Check if it's a quoted string literal
      if (expr.startsWith('"') && expr.endsWith('"')) {
        return constVal(expr.slice(1, -1));
      }
      // Check if it's a variable reference
      if (this.values.has(expr)) {
        return this.values.get(expr);
      }
      // Check if it's an arithmetic expression
      return this._evaluateArith(expr);
    }
    return BOTTOM;
  }

  _evaluateArith(expr) {
    // Try to match "a op b" pattern
    const ops = [' + ', ' - ', ' * ', ' / ', ' % ', ' == ', ' != ', ' < ', ' > '];
    for (const op of ops) {
      const idx = expr.indexOf(op);
      if (idx !== -1) {
        const left = expr.substring(0, idx).trim();
        const right = expr.substring(idx + op.length).trim();
        const leftVal = this._evaluateExpr(left);
        const rightVal = this._evaluateExpr(right);
        
        if (isConst(leftVal) && isConst(rightVal)) {
          const l = leftVal.value;
          const r = rightVal.value;
          switch (op.trim()) {
            case '+': return constVal(typeof l === 'number' ? l + r : `${l}${r}`);
            case '-': return constVal(l - r);
            case '*': return constVal(l * r);
            case '/': return r !== 0 ? constVal(Math.floor(l / r)) : BOTTOM;
            case '%': return r !== 0 ? constVal(l % r) : BOTTOM;
            case '==': return constVal(l === r);
            case '!=': return constVal(l !== r);
            case '<': return constVal(l < r);
            case '>': return constVal(l > r);
          }
        }
        if (isBottom(leftVal) || isBottom(rightVal)) return BOTTOM;
        return TOP; // Not enough info yet
      }
    }
    
    // Try as number
    const num = Number(expr);
    if (!isNaN(num) && expr.trim() !== '') return constVal(num);
    
    // Variable reference
    if (this.values.has(expr)) return this.values.get(expr);
    
    // Function call or unknown → bottom
    if (expr.includes('(')) return BOTTOM;
    
    return BOTTOM;
  }

  _getConstants() {
    const result = new Map();
    for (const [name, val] of this.values) {
      if (isConst(val)) {
        result.set(name, val.value);
      }
    }
    return result;
  }
}

// ============================================================
// Convenience
// ============================================================

function propagateConstants(source) {
  const { ssa } = toSSA(source);
  const cp = new ConstantPropagation();
  return cp.propagate(ssa);
}

export { 
  ConstantPropagation, propagateConstants,
  TOP, BOTTOM, constVal, isConst, isTop, isBottom, meet, latticeEqual
};
