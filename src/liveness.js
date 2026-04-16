/**
 * Liveness Analysis for monkey-lang
 * 
 * Backward dataflow analysis computing live variables at each program point.
 * A variable is LIVE at a point if it may be used before being redefined.
 * 
 * Uses:
 * - Dead code elimination (variable never live → assignment is dead)
 * - Register allocation (non-interfering variables can share registers)
 * - Warning generation (use before definition)
 * 
 * Algorithm: iterate backward over CFG until fixed point.
 *   liveIn(B) = use(B) ∪ (liveOut(B) \ def(B))
 *   liveOut(B) = ∪{liveIn(S) | S ∈ succs(B)}
 */

import * as ast from './ast.js';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { CFGBuilder } from './cfg.js';

// ============================================================
// Use/Def analysis per block
// ============================================================

function computeUseDef(block) {
  const use = new Set();  // Variables used before defined in this block
  const def = new Set();  // Variables defined in this block

  for (const stmt of block.stmts) {
    collectStmtUseDef(stmt, use, def);
  }

  return { use, def };
}

function collectStmtUseDef(stmt, use, def) {
  if (stmt instanceof ast.LetStatement) {
    // RHS uses happen before the LHS def
    if (stmt.value) collectExprUse(stmt.value, use, def);
    def.add(stmt.name.value);
  } else if (stmt instanceof ast.ReturnStatement) {
    if (stmt.returnValue) collectExprUse(stmt.returnValue, use, def);
  } else if (stmt instanceof ast.ExpressionStatement) {
    if (stmt.expression) collectExprUse(stmt.expression, use, def);
  } else if (stmt instanceof ast.BlockStatement) {
    for (const s of (stmt.statements || [])) {
      collectStmtUseDef(s, use, def);
    }
  }
  // For synthetic CFG nodes (if-cond, while-cond, etc.)
  if (stmt.tag === 'if-cond' || stmt.tag === 'while-cond' || stmt.tag === 'for-cond') {
    // These don't define/use in a structured way
  }
}

function collectExprUse(expr, use, def) {
  if (!expr) return;
  
  if (expr instanceof ast.Identifier) {
    if (!def.has(expr.value)) use.add(expr.value);
  } else if (expr instanceof ast.InfixExpression) {
    collectExprUse(expr.left, use, def);
    collectExprUse(expr.right, use, def);
  } else if (expr instanceof ast.PrefixExpression) {
    collectExprUse(expr.right, use, def);
  } else if (expr instanceof ast.CallExpression) {
    collectExprUse(expr.function, use, def);
    for (const arg of (expr.arguments || [])) collectExprUse(arg, use, def);
  } else if (expr instanceof ast.IfExpression) {
    collectExprUse(expr.condition, use, def);
    // Branches handled by CFG
  } else if (expr instanceof ast.ArrayLiteral) {
    for (const elem of (expr.elements || [])) collectExprUse(elem, use, def);
  } else if (expr instanceof ast.IndexExpression) {
    collectExprUse(expr.left, use, def);
    collectExprUse(expr.index, use, def);
  } else if (expr instanceof ast.FunctionLiteral) {
    // Don't look inside function bodies (separate scope)
  } else if (expr instanceof ast.HashLiteral) {
    for (const pair of (expr.pairs || [])) {
      collectExprUse(pair.key || pair[0], use, def);
      collectExprUse(pair.value || pair[1], use, def);
    }
  }
}

// ============================================================
// Liveness analysis
// ============================================================

class LivenessAnalysis {
  constructor(cfg) {
    this.cfg = cfg;
    this.liveIn = new Map();   // blockId → Set<varName>
    this.liveOut = new Map();  // blockId → Set<varName>
    this.useDef = new Map();   // blockId → {use, def}
  }

  /**
   * Run liveness analysis
   */
  analyze() {
    // Compute use/def for each block
    for (const [id, block] of this.cfg.blocks) {
      this.useDef.set(id, computeUseDef(block));
      this.liveIn.set(id, new Set());
      this.liveOut.set(id, new Set());
    }

    // Iterate backward until fixed point
    let changed = true;
    let iterations = 0;
    const maxIter = 100;
    
    while (changed && iterations < maxIter) {
      changed = false;
      iterations++;
      
      for (const [id, block] of this.cfg.blocks) {
        const { use, def } = this.useDef.get(id);
        
        // liveOut(B) = ∪{liveIn(S) | S ∈ succs(B)}
        const newOut = new Set();
        for (const succId of block.succs) {
          for (const v of this.liveIn.get(succId)) {
            newOut.add(v);
          }
        }
        
        // liveIn(B) = use(B) ∪ (liveOut(B) \ def(B))
        const newIn = new Set(use);
        for (const v of newOut) {
          if (!def.has(v)) newIn.add(v);
        }
        
        // Check for changes
        if (!setsEqual(newOut, this.liveOut.get(id))) {
          this.liveOut.set(id, newOut);
          changed = true;
        }
        if (!setsEqual(newIn, this.liveIn.get(id))) {
          this.liveIn.set(id, newIn);
          changed = true;
        }
      }
    }

    return { iterations, liveIn: this.liveIn, liveOut: this.liveOut };
  }

  /**
   * Find dead assignments (variable defined but never live after)
   * A variable is dead if: defined in block, not in liveOut, and not used
   * after its definition within the same block.
   */
  findDeadAssignments() {
    const dead = [];
    for (const [id, block] of this.cfg.blocks) {
      const liveOut = this.liveOut.get(id);
      
      // Track which variables are used after their definition within this block
      const usedAfterDef = new Set();
      const defined = new Set();
      
      for (const stmt of block.stmts) {
        // Collect uses (any identifier used here that was defined earlier in this block)
        const stmtUses = new Set();
        const stmtDefs = new Set();
        collectStmtUseDef(stmt, stmtUses, stmtDefs);
        
        for (const v of stmtUses) {
          if (defined.has(v)) usedAfterDef.add(v);
        }
        for (const v of stmtDefs) {
          defined.add(v);
        }
      }
      
      for (const v of defined) {
        if (!liveOut.has(v) && !usedAfterDef.has(v)) {
          dead.push({ variable: v, blockId: id });
        }
      }
    }
    return dead;
  }

  /**
   * Build interference graph: variables that are live at the same time
   * can't share a register
   */
  buildInterferenceGraph() {
    const edges = new Set();
    
    for (const [id] of this.cfg.blocks) {
      // Check both liveIn and liveOut for interference
      for (const live of [this.liveIn.get(id), this.liveOut.get(id)]) {
        const liveArr = [...live];
        for (let i = 0; i < liveArr.length; i++) {
          for (let j = i + 1; j < liveArr.length; j++) {
            const edge = [liveArr[i], liveArr[j]].sort().join(':');
            edges.add(edge);
          }
        }
      }
    }
    
    return [...edges].map(e => e.split(':'));
  }
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// ============================================================
// Convenience: analyze from source
// ============================================================

function analyzeLiveness(source) {
  const lexer = new Lexer(source);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  
  const cfgBuilder = new CFGBuilder();
  const cfg = cfgBuilder.build(program);
  
  const analysis = new LivenessAnalysis(cfg);
  analysis.analyze();
  
  return analysis;
}

export { LivenessAnalysis, analyzeLiveness, computeUseDef };
