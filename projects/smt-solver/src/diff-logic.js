// Difference Logic Theory Solver
//
// Handles constraints of the form: x - y <= c (integer difference constraints)
// Uses a weighted directed graph + Bellman-Ford negative cycle detection.
//
// Graph representation:
//   Edge from y to x with weight c means: x - y <= c
//   (equivalently, x <= y + c)
//
// UNSAT iff the constraint graph has a negative-weight cycle.
// Also handles: x - y >= c (rewrite as y - x <= -c)
//               x - y = c  (split into x - y <= c AND y - x <= -c)
//               x - y < c  (rewrite as x - y <= c - 1 for integers)
//               x <= c     (introduce variable "zero": x - zero <= c)

export class DifferenceConstraint {
  constructor(x, y, bound, operator = '<=') {
    this.x = x;          // variable name
    this.y = y;          // variable name
    this.bound = bound;   // numeric constant
    this.operator = operator; // '<=', '>=', '=', '<', '>'
  }

  toString() {
    return `${this.x} - ${this.y} ${this.operator} ${this.bound}`;
  }

  // Convert to canonical form: list of (x, y, c) where x - y <= c
  toCanonical() {
    const edges = [];
    switch (this.operator) {
      case '<=':
        edges.push({ from: this.y, to: this.x, weight: this.bound });
        break;
      case '>=':
        // x - y >= c ↔ y - x <= -c
        edges.push({ from: this.x, to: this.y, weight: -this.bound });
        break;
      case '=':
        // x - y = c ↔ x - y <= c AND y - x <= -c
        edges.push({ from: this.y, to: this.x, weight: this.bound });
        edges.push({ from: this.x, to: this.y, weight: -this.bound });
        break;
      case '<':
        // x - y < c ↔ x - y <= c - 1 (integers)
        edges.push({ from: this.y, to: this.x, weight: this.bound - 1 });
        break;
      case '>':
        // x - y > c ↔ y - x <= -(c + 1)
        edges.push({ from: this.x, to: this.y, weight: -(this.bound + 1) });
        break;
      case '!=':
        // Cannot be directly represented — handled separately
        return [];
    }
    return edges;
  }
}

export class DiffLogicSolver {
  constructor() {
    this.nodes = new Set();   // variable names
    this.edges = [];          // list of { from, to, weight, constraintIdx }
    this.constraints = [];    // list of DifferenceConstraint
    
    // Backtracking support
    this.checkpoints = [];    // stack of edges.length at each checkpoint
    this.constraintCheckpoints = []; // stack of constraints.length
    
    // Distance labels (shortest paths) — lazily computed
    this.dist = null;
  }

  // Ensure a variable exists
  addVariable(name) {
    this.nodes.add(name);
    // Always have a "zero" node for absolute bounds
    this.nodes.add('__zero');
  }

  // Push a decision level
  pushLevel() {
    this.checkpoints.push(this.edges.length);
    this.constraintCheckpoints.push(this.constraints.length);
  }

  // Pop to decision level
  popTo(level) {
    while (this.checkpoints.length > level) {
      const edgeTarget = this.checkpoints.pop();
      this.edges.length = edgeTarget;
      const consTarget = this.constraintCheckpoints.pop();
      this.constraints.length = consTarget;
    }
    this.dist = null; // invalidate cached distances
  }

  // Assert a difference constraint
  // Returns null if consistent, or a list of constraint indices forming a conflict
  assertConstraint(constraint) {
    const idx = this.constraints.length;
    this.constraints.push(constraint);
    
    this.addVariable(constraint.x);
    this.addVariable(constraint.y);
    
    const canonEdges = constraint.toCanonical();
    for (const edge of canonEdges) {
      this.edges.push({ ...edge, constraintIdx: idx });
    }
    
    this.dist = null; // invalidate
    
    // Check for negative cycle using incremental Bellman-Ford
    return this.checkConsistency();
  }

  // Full consistency check using Bellman-Ford
  // Uses all-zeros init for negative cycle detection
  checkConsistency() {
    const nodeList = [...this.nodes];
    const n = nodeList.length;
    if (n === 0) return null;
    
    const nodeIdx = new Map();
    nodeList.forEach((name, i) => nodeIdx.set(name, i));
    
    // Initialize all to 0 for global negative cycle detection
    const dist = new Array(n).fill(0);
    const pred = new Array(n).fill(-1);
    
    // Bellman-Ford: relax all edges n-1 times
    for (let iter = 0; iter < n - 1; iter++) {
      let updated = false;
      for (let ei = 0; ei < this.edges.length; ei++) {
        const { from, to, weight } = this.edges[ei];
        const fi = nodeIdx.get(from);
        const ti = nodeIdx.get(to);
        if (fi !== undefined && ti !== undefined && dist[fi] + weight < dist[ti]) {
          dist[ti] = dist[fi] + weight;
          pred[ti] = ei;
          updated = true;
        }
      }
      if (!updated) break;
    }
    
    // Check for negative cycle
    for (let ei = 0; ei < this.edges.length; ei++) {
      const { from, to, weight } = this.edges[ei];
      const fi = nodeIdx.get(from);
      const ti = nodeIdx.get(to);
      if (fi !== undefined && ti !== undefined && dist[fi] + weight < dist[ti]) {
        this.dist = null;
        return this._extractConflict(ei, pred, nodeIdx, nodeList);
      }
    }
    
    // For model extraction: run Bellman-Ford from __zero with proper init
    this._computeModel(nodeList, nodeIdx);
    
    return null;
  }
  
  _computeModel(nodeList, nodeIdx) {
    const n = nodeList.length;
    const zeroIdx = nodeIdx.get('__zero');
    
    // Use all-zeros initialization (same as cycle detection)
    // Then normalize relative to __zero
    const dist = new Array(n).fill(0);
    
    for (let iter = 0; iter < n - 1; iter++) {
      let updated = false;
      for (const { from, to, weight } of this.edges) {
        const fi = nodeIdx.get(from);
        const ti = nodeIdx.get(to);
        if (fi !== undefined && ti !== undefined && dist[fi] + weight < dist[ti]) {
          dist[ti] = dist[fi] + weight;
          updated = true;
        }
      }
      if (!updated) break;
    }
    
    // Normalize: subtract dist[__zero] so that __zero maps to 0
    const zeroOffset = zeroIdx !== undefined ? dist[zeroIdx] : 0;
    
    this.dist = new Map();
    for (let i = 0; i < n; i++) {
      this.dist.set(nodeList[i], dist[i] - zeroOffset);
    }
  }

  // Extract conflicting constraint indices from negative cycle
  _extractConflict(lastEdge, pred, nodeIdx, nodeList) {
    const conflictEdges = new Set();
    conflictEdges.add(lastEdge);
    
    // Walk predecessor chain to find cycle
    const visited = new Set();
    let current = nodeIdx.get(this.edges[lastEdge].from);
    visited.add(current);
    
    while (pred[current] >= 0) {
      conflictEdges.add(pred[current]);
      current = nodeIdx.get(this.edges[pred[current]].from);
      if (visited.has(current)) break;
      visited.add(current);
    }
    
    // Return unique constraint indices
    const indices = new Set();
    for (const ei of conflictEdges) {
      if (this.edges[ei]) indices.add(this.edges[ei].constraintIdx);
    }
    return [...indices];
  }

  // Get a satisfying assignment (distances from zero)
  getModel() {
    if (!this.dist) this.checkConsistency();
    if (!this.dist) return null; // inconsistent
    
    const model = new Map();
    for (const [name, val] of this.dist) {
      if (name !== '__zero') {
        model.set(name, val);
      }
    }
    return model;
  }

  // Query: what's the tightest upper bound on x - y?
  queryBound(x, y) {
    if (!this.dist) this.checkConsistency();
    if (!this.dist) return null;
    
    const dx = this.dist.get(x);
    const dy = this.dist.get(y);
    if (dx === undefined || dy === undefined) return Infinity;
    return dx - dy;
  }
}

// Helper: create constraint
export function diff(x, y, op, bound) {
  return new DifferenceConstraint(x, y, bound, op);
}

// Absolute bounds: x <= c is (x - zero <= c), x >= c is (zero - x <= -c)
export function upperBound(x, c) {
  return new DifferenceConstraint(x, '__zero', c, '<=');
}

export function lowerBound(x, c) {
  return new DifferenceConstraint('__zero', x, -c, '<=');
}
