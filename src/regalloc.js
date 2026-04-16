/**
 * Register Allocator for monkey-lang
 * 
 * Graph coloring register allocation:
 * - Build interference graph from liveness analysis
 * - Color the graph with K colors (= K registers)
 * - Spill variables that can't be colored
 * 
 * Based on Chaitin-Briggs algorithm:
 * 1. Simplify: remove nodes with degree < K, push to stack
 * 2. Spill: if no node has degree < K, pick one to spill
 * 3. Select: pop nodes from stack, assign colors
 */

class RegisterAllocator {
  constructor(numRegs = 8) {
    this.numRegs = numRegs;  // Number of available registers
    this.regNames = [];
    for (let i = 0; i < numRegs; i++) {
      this.regNames.push(`r${i}`);
    }
  }

  /**
   * Allocate registers given an interference graph.
   * graph: [[var1, var2], ...] — pairs of interfering variables
   * Returns: { allocation: Map<var, register>, spilled: [var, ...] }
   */
  allocate(graph) {
    // Build adjacency representation
    const adj = new Map();
    const allVars = new Set();
    
    for (const [a, b] of graph) {
      allVars.add(a);
      allVars.add(b);
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a).add(b);
      adj.get(b).add(a);
    }
    
    // Variables with no interference
    // (they can get any register)
    
    // === SIMPLIFY ===
    const stack = [];
    const removed = new Set();
    const degrees = new Map();
    
    for (const v of allVars) {
      degrees.set(v, adj.get(v)?.size || 0);
    }
    
    while (removed.size < allVars.size) {
      // Find a node with degree < K
      let found = false;
      for (const v of allVars) {
        if (removed.has(v)) continue;
        const currentDegree = this._currentDegree(v, adj, removed);
        if (currentDegree < this.numRegs) {
          stack.push({ var: v, spill: false });
          removed.add(v);
          found = true;
          break;
        }
      }
      
      if (!found) {
        // === SPILL === : pick node with highest degree
        let maxDegree = -1;
        let spillVar = null;
        for (const v of allVars) {
          if (removed.has(v)) continue;
          const d = this._currentDegree(v, adj, removed);
          if (d > maxDegree) {
            maxDegree = d;
            spillVar = v;
          }
        }
        if (spillVar) {
          stack.push({ var: spillVar, spill: true });
          removed.add(spillVar);
        } else {
          break; // All removed
        }
      }
    }
    
    // === SELECT ===
    const allocation = new Map();
    const spilled = [];
    
    while (stack.length > 0) {
      const { var: v, spill } = stack.pop();
      
      // Find colors used by neighbors
      const usedColors = new Set();
      const neighbors = adj.get(v) || new Set();
      for (const n of neighbors) {
        if (allocation.has(n)) {
          usedColors.add(allocation.get(n));
        }
      }
      
      // Find first available color
      let assigned = false;
      for (const reg of this.regNames) {
        if (!usedColors.has(reg)) {
          allocation.set(v, reg);
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        // Must spill
        spilled.push(v);
        allocation.set(v, 'spill');
      }
    }
    
    return { allocation, spilled };
  }

  _currentDegree(v, adj, removed) {
    let degree = 0;
    const neighbors = adj.get(v) || new Set();
    for (const n of neighbors) {
      if (!removed.has(n)) degree++;
    }
    return degree;
  }

  /**
   * Allocate from liveness analysis results
   */
  allocateFromLiveness(interferenceGraph) {
    return this.allocate(interferenceGraph);
  }
}

/**
 * Simple linear scan register allocator (alternative, simpler)
 * Assigns registers in order of variable appearance.
 */
class LinearScanAllocator {
  constructor(numRegs = 8) {
    this.numRegs = numRegs;
  }

  allocate(variables, liveRanges) {
    // liveRanges: Map<var, {start, end}>
    // Sort by start position
    const sorted = [...liveRanges.entries()].sort((a, b) => a[1].start - b[1].start);
    
    const allocation = new Map();
    const active = []; // {var, end, reg}
    const freeRegs = [];
    for (let i = this.numRegs - 1; i >= 0; i--) freeRegs.push(`r${i}`);
    const spilled = [];
    
    for (const [v, range] of sorted) {
      // Expire old intervals
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].end < range.start) {
          freeRegs.push(active[i].reg);
          active.splice(i, 1);
        }
      }
      
      if (freeRegs.length > 0) {
        const reg = freeRegs.pop();
        allocation.set(v, reg);
        active.push({ var: v, end: range.end, reg });
      } else {
        // Spill the interval with the farthest end
        if (active.length > 0 && active[active.length - 1].end > range.end) {
          const spill = active.pop();
          spilled.push(spill.var);
          allocation.set(v, spill.reg);
          allocation.set(spill.var, 'spill');
          active.push({ var: v, end: range.end, reg: spill.reg });
        } else {
          spilled.push(v);
          allocation.set(v, 'spill');
        }
      }
      
      // Keep active sorted by end
      active.sort((a, b) => a.end - b.end);
    }
    
    return { allocation, spilled };
  }
}

export { RegisterAllocator, LinearScanAllocator };
