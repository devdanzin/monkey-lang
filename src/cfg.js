/**
 * Control Flow Graph (CFG) Builder for monkey-lang
 * 
 * Extracts basic blocks from monkey-lang AST and builds a CFG.
 * Basic block: maximal sequence of statements with no branches (single entry, single exit).
 * 
 * Features:
 * - Basic block extraction from AST
 * - CFG edges for if/else, while, for, return, break, continue
 * - Dominator tree computation (iterative algorithm)
 * - Natural loop detection
 * - DOT format export for visualization
 */

import * as ast from './ast.js';

class BasicBlock {
  constructor(id, label = '') {
    this.id = id;
    this.label = label;
    this.stmts = [];      // Statements in this block
    this.succs = [];      // Successor block IDs
    this.preds = [];      // Predecessor block IDs
  }

  addStmt(stmt) {
    this.stmts.push(stmt);
  }

  toString() {
    const stmtStrs = this.stmts.map(s => s.toString?.() || String(s)).join('; ');
    return `BB${this.id}[${this.label}]: ${stmtStrs || '(empty)'}`;
  }
}

class CFG {
  constructor() {
    this.blocks = new Map(); // id → BasicBlock
    this.entry = null;       // entry block id
    this.exit = null;        // exit block id  
    this.nextId = 0;
  }

  newBlock(label = '') {
    const id = this.nextId++;
    const block = new BasicBlock(id, label);
    this.blocks.set(id, block);
    return block;
  }

  addEdge(fromId, toId) {
    const from = this.blocks.get(fromId);
    const to = this.blocks.get(toId);
    if (from && to) {
      if (!from.succs.includes(toId)) from.succs.push(toId);
      if (!to.preds.includes(fromId)) to.preds.push(fromId);
    }
  }

  /**
   * Compute dominators using iterative algorithm.
   * dom[n] = {n} ∪ ∩{dom[p] | p ∈ preds(n)}
   * Returns Map<blockId, Set<blockId>> (dominator sets)
   */
  computeDominators() {
    const allIds = new Set(this.blocks.keys());
    const dom = new Map();
    
    // Initialize: dom[entry] = {entry}, dom[n] = all blocks
    for (const id of allIds) {
      dom.set(id, id === this.entry ? new Set([id]) : new Set(allIds));
    }

    // Iterate until fixed point
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of allIds) {
        if (id === this.entry) continue;
        const block = this.blocks.get(id);
        
        // Intersect predecessor dom sets
        let newDom = null;
        for (const predId of block.preds) {
          if (newDom === null) {
            newDom = new Set(dom.get(predId));
          } else {
            for (const d of newDom) {
              if (!dom.get(predId).has(d)) newDom.delete(d);
            }
          }
        }
        
        if (!newDom) newDom = new Set();
        newDom.add(id); // dom[n] includes n itself
        
        // Check if changed
        if (newDom.size !== dom.get(id).size || ![...newDom].every(d => dom.get(id).has(d))) {
          dom.set(id, newDom);
          changed = true;
        }
      }
    }

    return dom;
  }

  /**
   * Compute immediate dominators from dominator sets
   * Returns Map<blockId, blockId|null>
   */
  computeImmediateDominators() {
    const dom = this.computeDominators();
    const idom = new Map();

    for (const [id, domSet] of dom) {
      if (id === this.entry) {
        idom.set(id, null);
        continue;
      }
      
      // idom(n) = d where d ∈ dom(n)\{n} and d dominates all other members of dom(n)\{n}
      const strictDom = new Set(domSet);
      strictDom.delete(id);
      
      for (const d of strictDom) {
        const others = new Set(strictDom);
        others.delete(d);
        // d is idom if all others are dominated by d
        if ([...others].every(o => dom.get(o).has(d))) {
          idom.set(id, d);
          break;
        }
      }
    }

    return idom;
  }

  /**
   * Detect natural loops.
   * A natural loop: back edge n→h where h dominates n.
   * Loop body = {nodes that can reach n without going through h} ∪ {h}
   */
  detectLoops() {
    const dom = this.computeDominators();
    const loops = [];

    for (const [id, block] of this.blocks) {
      for (const succId of block.succs) {
        // Back edge: id → succId where succId dominates id
        if (dom.get(id)?.has(succId)) {
          const loop = this._findLoopBody(succId, id, dom);
          loops.push({ header: succId, backEdge: [id, succId], body: loop });
        }
      }
    }

    return loops;
  }

  _findLoopBody(header, tail, dom) {
    const body = new Set([header]);
    if (header === tail) return body;
    
    const worklist = [tail];
    body.add(tail);
    
    while (worklist.length > 0) {
      const n = worklist.pop();
      const block = this.blocks.get(n);
      for (const predId of block.preds) {
        if (!body.has(predId)) {
          body.add(predId);
          worklist.push(predId);
        }
      }
    }

    return body;
  }

  /**
   * Export to DOT format for Graphviz visualization
   */
  toDot() {
    let dot = 'digraph CFG {\n';
    dot += '  node [shape=box];\n';
    
    for (const [id, block] of this.blocks) {
      const label = block.label || `BB${id}`;
      const stmts = block.stmts.map(s => (s.toString?.() || '').replace(/"/g, '\\"')).join('\\n');
      dot += `  bb${id} [label="${label}${stmts ? '\\n' + stmts : ''}"];\n`;
    }
    
    for (const [id, block] of this.blocks) {
      for (const succId of block.succs) {
        dot += `  bb${id} -> bb${succId};\n`;
      }
    }
    
    dot += '}\n';
    return dot;
  }
}

// ============================================================
// CFG Builder
// ============================================================

class CFGBuilder {
  constructor() {
    this.cfg = new CFG();
    this.breakTarget = null;    // Block to jump to on 'break'
    this.continueTarget = null; // Block to jump to on 'continue'
  }

  build(program) {
    const entry = this.cfg.newBlock('entry');
    const exit = this.cfg.newBlock('exit');
    this.cfg.entry = entry.id;
    this.cfg.exit = exit.id;

    const lastBlock = this._buildStatements(program.statements, entry);
    if (lastBlock) {
      this.cfg.addEdge(lastBlock.id, exit.id);
    }

    return this.cfg;
  }

  _buildStatements(stmts, currentBlock) {
    for (const stmt of stmts) {
      if (!currentBlock) return null; // Dead code after return
      currentBlock = this._buildStatement(stmt, currentBlock);
    }
    return currentBlock;
  }

  _buildStatement(stmt, block) {
    if (stmt instanceof ast.LetStatement) {
      block.addStmt(stmt);
      return block;
    }

    if (stmt instanceof ast.ReturnStatement) {
      block.addStmt(stmt);
      this.cfg.addEdge(block.id, this.cfg.exit);
      return null; // No fallthrough after return
    }

    if (stmt instanceof ast.ExpressionStatement) {
      const expr = stmt.expression;
      
      // If expression creates branches
      if (expr instanceof ast.IfExpression) {
        return this._buildIf(expr, block);
      }
      
      // While loop
      if (expr instanceof ast.WhileExpression) {
        return this._buildWhile(expr, block);
      }

      // For-in loop
      if (expr instanceof ast.ForInExpression) {
        return this._buildForIn(expr, block);
      }

      block.addStmt(stmt);
      return block;
    }

    if (stmt instanceof ast.BlockStatement) {
      return this._buildStatements(stmt.statements || [], block);
    }

    // Default: just add statement to current block
    block.addStmt(stmt);
    return block;
  }

  _buildIf(ifExpr, block) {
    block.addStmt({ toString: () => `if (${ifExpr.condition})`, tag: 'if-cond' });
    
    const thenBlock = this.cfg.newBlock('then');
    const mergeBlock = this.cfg.newBlock('merge');
    
    this.cfg.addEdge(block.id, thenBlock.id);
    
    const thenEnd = this._buildStatements(
      ifExpr.consequence?.statements || [], thenBlock);
    if (thenEnd) this.cfg.addEdge(thenEnd.id, mergeBlock.id);
    
    if (ifExpr.alternative) {
      const elseBlock = this.cfg.newBlock('else');
      this.cfg.addEdge(block.id, elseBlock.id);
      
      const elseEnd = this._buildStatements(
        ifExpr.alternative.statements || [], elseBlock);
      if (elseEnd) this.cfg.addEdge(elseEnd.id, mergeBlock.id);
    } else {
      // No else: fall through to merge
      this.cfg.addEdge(block.id, mergeBlock.id);
    }
    
    return mergeBlock;
  }

  _buildWhile(whileExpr, block) {
    const condBlock = this.cfg.newBlock('while-cond');
    const bodyBlock = this.cfg.newBlock('while-body');
    const exitBlock = this.cfg.newBlock('while-exit');
    
    this.cfg.addEdge(block.id, condBlock.id);
    condBlock.addStmt({ toString: () => `while (${whileExpr.condition || '...'})`, tag: 'while-cond' });
    
    // Condition → body (true) or exit (false)
    this.cfg.addEdge(condBlock.id, bodyBlock.id);
    this.cfg.addEdge(condBlock.id, exitBlock.id);
    
    // Save break/continue targets
    const prevBreak = this.breakTarget;
    const prevContinue = this.continueTarget;
    this.breakTarget = exitBlock;
    this.continueTarget = condBlock;
    
    const bodyEnd = this._buildStatements(
      whileExpr.body?.statements || [], bodyBlock);
    if (bodyEnd) this.cfg.addEdge(bodyEnd.id, condBlock.id); // Loop back
    
    this.breakTarget = prevBreak;
    this.continueTarget = prevContinue;
    
    return exitBlock;
  }

  _buildForIn(forInExpr, block) {
    const condBlock = this.cfg.newBlock('for-cond');
    const bodyBlock = this.cfg.newBlock('for-body');
    const exitBlock = this.cfg.newBlock('for-exit');
    
    this.cfg.addEdge(block.id, condBlock.id);
    condBlock.addStmt({ toString: () => `for (${forInExpr.variable} in ...)`, tag: 'for-cond' });
    
    this.cfg.addEdge(condBlock.id, bodyBlock.id);
    this.cfg.addEdge(condBlock.id, exitBlock.id);
    
    const prevBreak = this.breakTarget;
    const prevContinue = this.continueTarget;
    this.breakTarget = exitBlock;
    this.continueTarget = condBlock;
    
    const bodyEnd = this._buildStatements(
      forInExpr.body?.statements || [], bodyBlock);
    if (bodyEnd) this.cfg.addEdge(bodyEnd.id, condBlock.id);
    
    this.breakTarget = prevBreak;
    this.continueTarget = prevContinue;
    
    return exitBlock;
  }
}

export { BasicBlock, CFG, CFGBuilder };
