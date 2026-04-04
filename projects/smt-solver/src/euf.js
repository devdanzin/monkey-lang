// ===== Backtrackable Union-Find =====
// Supports union, find, and backtrack operations
// Uses path compression but stores undo history for backtracking

export class UnionFind {
  constructor() {
    this.parent = new Map(); // node → parent node
    this.rank = new Map();   // node → rank (for union by rank)
    this.history = [];       // stack of { type, node, oldParent, oldRank } for undo
    this.checkpoints = [];   // stack of history.length at each checkpoint
  }

  // Ensure node exists
  _ensure(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  // Find with path compression (but record changes for backtracking)
  find(x) {
    this._ensure(x);
    // Find root without path compression first (for correctness with backtracking)
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    
    // Path compression: point all nodes on path to root
    let current = x;
    while (current !== root) {
      const next = this.parent.get(current);
      this.history.push({ type: 'parent', node: current, old: next });
      this.parent.set(current, root);
      current = next;
    }
    
    return root;
  }

  // Union two elements; returns true if they were in different sets
  union(x, y) {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return false; // already in same set

    // Union by rank
    const rankX = this.rank.get(rx);
    const rankY = this.rank.get(ry);
    
    if (rankX < rankY) {
      this.history.push({ type: 'parent', node: rx, old: rx });
      this.parent.set(rx, ry);
    } else if (rankX > rankY) {
      this.history.push({ type: 'parent', node: ry, old: ry });
      this.parent.set(ry, rx);
    } else {
      this.history.push({ type: 'parent', node: ry, old: ry });
      this.parent.set(ry, rx);
      this.history.push({ type: 'rank', node: rx, old: rankX });
      this.rank.set(rx, rankX + 1);
    }
    
    return true;
  }

  // Check if two elements are in the same set
  connected(x, y) {
    return this.find(x) === this.find(y);
  }

  // Save a checkpoint for backtracking
  checkpoint() {
    this.checkpoints.push(this.history.length);
  }

  // Backtrack to last checkpoint
  backtrack() {
    if (this.checkpoints.length === 0) return;
    const target = this.checkpoints.pop();
    while (this.history.length > target) {
      const op = this.history.pop();
      if (op.type === 'parent') {
        this.parent.set(op.node, op.old);
      } else if (op.type === 'rank') {
        this.rank.set(op.node, op.old);
      }
    }
  }

  // Backtrack to a specific level (pops all checkpoints above that level)
  backtrackTo(level) {
    while (this.checkpoints.length > level) {
      this.backtrack();
    }
  }
}

// ===== EUF Theory Solver =====
// Handles equality and uninterpreted functions using congruence closure

// Term representation
export class Term {
  constructor(name, args = []) {
    this.name = name;    // function/constant name
    this.args = args;    // child terms
    this.id = null;      // unique ID assigned during registration
  }

  toString() {
    if (this.args.length === 0) return this.name;
    return `${this.name}(${this.args.map(a => a.toString()).join(', ')})`;
  }

  isConstant() { return this.args.length === 0; }
}

// Theory literal: equality or disequality between terms
export class TheoryLiteral {
  constructor(lhs, rhs, positive = true) {
    this.lhs = lhs;      // Term
    this.rhs = rhs;      // Term
    this.positive = positive; // true = equality, false = disequality
  }

  toString() {
    return `${this.lhs} ${this.positive ? '=' : '≠'} ${this.rhs}`;
  }

  negate() {
    return new TheoryLiteral(this.lhs, this.rhs, !this.positive);
  }
}

export class EUFSolver {
  constructor() {
    this.uf = new UnionFind();
    this.termCounter = 0;
    this.terms = new Map();         // term_id → Term
    this.termIds = new Map();       // canonical string → term_id
    this.assertions = [];           // stack of asserted literals
    this.assertionLevels = [];      // stack of assertions.length at each level
    this.disequalities = [];        // active disequalities: [{lhs_id, rhs_id, literal}]
    this.diseqLevels = [];          // stack of disequalities.length at each level
    this.pendingCongruences = [];   // terms to check for congruence after each union
    this.useList = new Map();       // term_id → list of term_ids that use this as argument
    this.sig = new Map();           // "name(rep_arg1,...)" → term_id (signature table)
    this.sigHistory = [];           // for backtracking sig table
    this.sigLevels = [];            // checkpoints for sig history
  }

  // Register a term and all its subterms, return its ID
  register(term) {
    const key = term.toString();
    if (this.termIds.has(key)) {
      term.id = this.termIds.get(key);
      return term.id;
    }

    // Register subterms first
    for (const arg of term.args) {
      this.register(arg);
    }

    const id = this.termCounter++;
    term.id = id;
    this.terms.set(id, term);
    this.termIds.set(key, id);
    this.uf._ensure(id);

    // Add to use lists of arguments
    for (const arg of term.args) {
      if (!this.useList.has(arg.id)) this.useList.set(arg.id, []);
      this.useList.get(arg.id).push(id);
    }

    // Add to signature table
    if (term.args.length > 0) {
      const sigKey = this._signature(term);
      if (this.sig.has(sigKey)) {
        // Congruent term already exists — they should be equal
        this.pendingCongruences.push({ newId: id, existingId: this.sig.get(sigKey) });
      } else {
        this.sig.set(sigKey, id);
      }
    }

    return id;
  }

  _signature(term) {
    const argReps = term.args.map(a => this.uf.find(a.id));
    return `${term.name}(${argReps.join(',')})`;
  }

  // Push a new decision level
  pushLevel() {
    this.uf.checkpoint();
    this.assertionLevels.push(this.assertions.length);
    this.diseqLevels.push(this.disequalities.length);
    this.sigLevels.push(this.sigHistory.length);
  }

  // Pop to decision level
  popTo(level) {
    // Undo assertions
    while (this.assertionLevels.length > level) {
      const target = this.assertionLevels.pop();
      this.assertions.length = target;
    }
    
    // Undo disequalities
    while (this.diseqLevels.length > level) {
      const target = this.diseqLevels.pop();
      this.disequalities.length = target;
    }
    
    // Undo signature table changes
    while (this.sigLevels.length > level) {
      const target = this.sigLevels.pop();
      while (this.sigHistory.length > target) {
        const { key, old } = this.sigHistory.pop();
        if (old === undefined) {
          this.sig.delete(key);
        } else {
          this.sig.set(key, old);
        }
      }
    }
    
    // Undo union-find
    this.uf.backtrackTo(level);
  }

  // Assert a theory literal; returns null if consistent, or a conflict explanation
  setTrue(literal) {
    this.assertions.push(literal);
    
    if (literal.positive) {
      // Equality: merge equivalence classes
      return this._merge(literal.lhs.id, literal.rhs.id, literal);
    } else {
      // Disequality: record and check
      this.disequalities.push({
        lhsId: literal.lhs.id,
        rhsId: literal.rhs.id,
        literal,
      });
      // Check if already equal
      if (this.uf.connected(literal.lhs.id, literal.rhs.id)) {
        return this._explainEquality(literal.lhs.id, literal.rhs.id).concat([literal]);
      }
      return null;
    }
  }

  // Merge two term IDs and propagate congruences
  _merge(id1, id2, reason) {
    if (this.uf.connected(id1, id2)) return null; // already equal

    this.uf.union(id1, id2);

    // Check disequalities
    for (const diseq of this.disequalities) {
      if (this.uf.connected(diseq.lhsId, diseq.rhsId)) {
        // Conflict: this merge made an existing disequality invalid
        return this._explainEquality(diseq.lhsId, diseq.rhsId).concat([diseq.literal]);
      }
    }

    // Propagate congruences: check if any terms using id1 or id2 as args
    // now have matching signatures
    const toCheck = new Set();
    for (const id of [id1, id2]) {
      const uses = this.useList.get(id) || [];
      for (const userId of uses) {
        toCheck.add(userId);
      }
    }

    for (const termId of toCheck) {
      const term = this.terms.get(termId);
      const sigKey = this._signature(term);
      
      if (this.sig.has(sigKey)) {
        const existingId = this.sig.get(sigKey);
        if (!this.uf.connected(termId, existingId)) {
          // Congruence: merge these terms
          const conflict = this._merge(termId, existingId, null);
          if (conflict) return conflict;
        }
      } else {
        // Update signature table
        this.sigHistory.push({ key: sigKey, old: undefined });
        this.sig.set(sigKey, termId);
      }
    }

    return null;
  }

  // Check consistency of all assertions
  checkConsistency() {
    for (const diseq of this.disequalities) {
      if (this.uf.connected(diseq.lhsId, diseq.rhsId)) {
        return {
          consistent: false,
          conflict: this._explainEquality(diseq.lhsId, diseq.rhsId).concat([diseq.literal]),
        };
      }
    }
    return { consistent: true };
  }

  // Explain why two terms are equal (returns list of assertions that imply it)
  // Simple version: return all equalities asserted so far
  // TODO: proper proof-producing union-find
  _explainEquality(id1, id2) {
    // For now, return all positive assertions (conservative over-approximation)
    return this.assertions.filter(a => a.positive);
  }

  // Query: are two terms equal?
  areEqual(t1, t2) {
    return this.uf.connected(t1.id, t2.id);
  }

  // Query: are two terms known to be different?
  areDifferent(t1, t2) {
    for (const diseq of this.disequalities) {
      const lRep = this.uf.find(diseq.lhsId);
      const rRep = this.uf.find(diseq.rhsId);
      const t1Rep = this.uf.find(t1.id);
      const t2Rep = this.uf.find(t2.id);
      if ((t1Rep === lRep && t2Rep === rRep) || (t1Rep === rRep && t2Rep === lRep)) {
        return true;
      }
    }
    return false;
  }
}

// Helper: create term
export function term(name, ...args) {
  return new Term(name, args);
}

// Helper: create equality literal
export function eq(lhs, rhs) {
  return new TheoryLiteral(lhs, rhs, true);
}

// Helper: create disequality literal
export function neq(lhs, rhs) {
  return new TheoryLiteral(lhs, rhs, false);
}
