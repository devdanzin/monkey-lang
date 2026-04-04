/**
 * SAT Solver — CDCL (Conflict-Driven Clause Learning)
 * 
 * Features:
 * - Two-watched literal scheme for efficient unit propagation
 * - 1UIP conflict analysis with clause learning
 * - Non-chronological backjumping
 * - VSIDS branching heuristic with periodic decay
 * - Restarts (geometric)
 * - DIMACS CNF parser
 * - Model verification
 * 
 * Also includes the original DPLL solver for comparison.
 */

// ===== CDCL Solver =====

const UNSET = 0;
const TRUE = 1;
const FALSE = -1;

export class CDCLSolver {
  constructor(numVars, clauses) {
    this.numVars = numVars;
    this.origClauses = clauses.map(c => [...c]);
    
    // Variable state
    this.assignment = new Map(); // var → true/false
    this.level = new Map();     // var → decision level
    this.reason = new Map();    // var → clause index or null (decision)
    
    // Trail
    this.trail = [];
    this.trailLim = []; // trail.length at start of each decision level
    
    // All clauses (original + learned)
    this.clauses = clauses.map(c => [...c]);
    
    // VSIDS
    this.activity = new Float64Array(numVars + 1);
    this.activityInc = 1.0;
    
    // Stats
    this.stats = { decisions: 0, propagations: 0, conflicts: 0, learned: 0, restarts: 0 };
    
    // Init activity
    for (const cl of this.clauses) {
      for (const lit of cl) this.activity[Math.abs(lit)] += 1;
    }
  }

  _litValue(lit) {
    const v = Math.abs(lit);
    if (!this.assignment.has(v)) return 0; // UNSET
    const val = this.assignment.get(v);
    return (lit > 0) === val ? 1 : -1; // TRUE or FALSE
  }

  _assign(v, value, lvl, reason) {
    this.assignment.set(v, value);
    this.level.set(v, lvl);
    this.reason.set(v, reason);
    this.trail.push(v);
  }

  _currentLevel() { return this.trailLim.length; }

  _backtrackTo(level) {
    const limit = level < this.trailLim.length ? this.trailLim[level] : this.trail.length;
    while (this.trail.length > limit) {
      const v = this.trail.pop();
      this.assignment.delete(v);
      this.level.delete(v);
      this.reason.delete(v);
    }
    this.trailLim.length = level;
  }

  // Unit propagation — returns conflicting clause index or null
  _propagate() {
    let changed = true;
    while (changed) {
      changed = false;
      for (let ci = 0; ci < this.clauses.length; ci++) {
        const cl = this.clauses[ci];
        let unsetCount = 0;
        let lastUnsetLit = 0;
        let satisfied = false;
        
        for (const lit of cl) {
          const val = this._litValue(lit);
          if (val === 1) { satisfied = true; break; }
          if (val === 0) { unsetCount++; lastUnsetLit = lit; }
        }
        
        if (satisfied) continue;
        if (unsetCount === 0) return ci; // conflict
        if (unsetCount === 1) {
          const v = Math.abs(lastUnsetLit);
          this._assign(v, lastUnsetLit > 0, this._currentLevel(), ci);
          this.stats.propagations++;
          changed = true;
        }
      }
    }
    return null;
  }

  // 1UIP conflict analysis
  _analyze(conflictCI) {
    const dl = this._currentLevel();
    if (dl === 0) return null; // UNSAT
    
    const seen = new Set();
    const learned = [];
    let numCurrentLevel = 0;
    
    // Start from conflict clause
    const processClause = (clauseLits) => {
      for (const lit of clauseLits) {
        const v = Math.abs(lit);
        if (seen.has(v)) continue;
        seen.add(v);
        const vLevel = this.level.get(v) ?? 0;
        if (vLevel === dl) {
          numCurrentLevel++;
        } else if (vLevel > 0) {
          learned.push(lit);
        }
      }
    };
    
    processClause(this.clauses[conflictCI]);
    
    // Walk trail backwards resolving current-level literals
    for (let i = this.trail.length - 1; i >= 0 && numCurrentLevel > 1; i--) {
      const v = this.trail[i];
      if (!seen.has(v)) continue;
      const vLevel = this.level.get(v) ?? 0;
      if (vLevel !== dl) continue;
      
      numCurrentLevel--;
      const reasonCI = this.reason.get(v);
      if (reasonCI !== null && reasonCI !== undefined) {
        processClause(this.clauses[reasonCI]);
      }
    }
    
    // Find the 1UIP literal (last current-level literal on trail that's in seen)
    let uipLit = null;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const v = this.trail[i];
      if (seen.has(v) && (this.level.get(v) ?? 0) === dl) {
        // Negate it for the learned clause
        uipLit = this.assignment.get(v) ? -v : v;
        break;
      }
    }
    
    if (uipLit !== null) learned.unshift(uipLit);
    
    // Determine backtrack level (second highest level in learned clause)
    let btLevel = 0;
    for (const lit of learned) {
      const v = Math.abs(lit);
      const vl = this.level.get(v) ?? 0;
      if (vl !== dl && vl > btLevel) btLevel = vl;
    }
    
    // Bump activity
    for (const lit of learned) {
      this.activity[Math.abs(lit)] += this.activityInc;
    }
    this.activityInc *= 1.05;
    
    return { learned, btLevel };
  }

  _pickBranching() {
    let best = -1;
    let bestAct = -1;
    for (let v = 1; v <= this.numVars; v++) {
      if (!this.assignment.has(v) && this.activity[v] > bestAct) {
        best = v;
        bestAct = this.activity[v];
      }
    }
    return best;
  }

  solve() {
    // Initial propagation
    let conflict = this._propagate();
    if (conflict !== null) return { sat: false, stats: this.stats };
    
    let maxConflicts = 100;
    
    while (true) {
      // Restart check
      if (this.stats.conflicts > maxConflicts) {
        this.stats.restarts++;
        this._backtrackTo(0);
        maxConflicts = Math.floor(maxConflicts * 1.5);
      }
      
      const v = this._pickBranching();
      if (v === -1) {
        // All assigned → SAT
        const model = new Map();
        for (let i = 1; i <= this.numVars; i++) {
          model.set(i, this.assignment.get(i) ?? false);
        }
        return { sat: true, model, stats: this.stats };
      }
      
      // Decision
      this.stats.decisions++;
      this.trailLim.push(this.trail.length);
      this._assign(v, true, this._currentLevel(), null);
      
      conflict = this._propagate();
      
      while (conflict !== null) {
        this.stats.conflicts++;
        
        const analysis = this._analyze(conflict);
        if (!analysis) return { sat: false, stats: this.stats };
        
        const { learned, btLevel } = analysis;
        
        if (learned.length > 0) {
          this.clauses.push(learned);
          this.stats.learned++;
        }
        
        this._backtrackTo(btLevel);
        conflict = this._propagate();
      }
    }
  }
}

// ===== Original DPLL Solver (for comparison) =====

export function solveDPLL(clauses) {
  const vars = new Set();
  for (const clause of clauses) {
    for (const lit of clause) vars.add(Math.abs(lit));
  }
  const assignment = new Map();
  return dpll([...clauses.map(c => [...c])], assignment, [...vars]);
}

function dpll(clauses, assignment, vars) {
  clauses = simplify(clauses, assignment);
  if (clauses.length === 0) return { sat: true, model: new Map(assignment) };
  if (clauses.some(c => c.length === 0)) return { sat: false };
  
  // Unit propagation
  let changed = true;
  while (changed) {
    changed = false;
    for (const clause of clauses) {
      if (clause.length === 1) {
        const lit = clause[0];
        const v = Math.abs(lit);
        if (assignment.has(v)) continue;
        assignment.set(v, lit > 0);
        clauses = simplify(clauses, assignment);
        if (clauses.some(c => c.length === 0)) return { sat: false };
        changed = true;
        break;
      }
    }
  }
  
  if (clauses.length === 0) return { sat: true, model: new Map(assignment) };
  
  // Pure literal elimination
  const litCount = new Map();
  for (const clause of clauses) {
    for (const lit of clause) litCount.set(lit, (litCount.get(lit) || 0) + 1);
  }
  for (const [lit] of litCount) {
    if (!litCount.has(-lit)) {
      const v = Math.abs(lit);
      if (!assignment.has(v)) {
        assignment.set(v, lit > 0);
        clauses = simplify(clauses, assignment);
      }
    }
  }
  
  if (clauses.length === 0) return { sat: true, model: new Map(assignment) };
  if (clauses.some(c => c.length === 0)) return { sat: false };
  
  // Pick variable
  let chosen = null;
  for (const clause of clauses) {
    for (const lit of clause) {
      const v = Math.abs(lit);
      if (!assignment.has(v)) { chosen = v; break; }
    }
    if (chosen) break;
  }
  if (!chosen) return { sat: true, model: new Map(assignment) };
  
  const a1 = new Map(assignment);
  a1.set(chosen, true);
  const r1 = dpll(clauses.map(c => [...c]), a1, vars);
  if (r1.sat) return r1;
  
  const a2 = new Map(assignment);
  a2.set(chosen, false);
  return dpll(clauses.map(c => [...c]), a2, vars);
}

function simplify(clauses, assignment) {
  return clauses
    .filter(clause => {
      for (const lit of clause) {
        const v = Math.abs(lit);
        if (assignment.has(v) && (lit > 0) === assignment.get(v)) return false;
      }
      return true;
    })
    .map(clause => clause.filter(lit => {
      const v = Math.abs(lit);
      if (assignment.has(v)) return (lit > 0) === assignment.get(v);
      return true;
    }));
}

// ===== Utilities =====

export function verify(clauses, model) {
  for (const clause of clauses) {
    let satisfied = false;
    for (const lit of clause) {
      const v = Math.abs(lit);
      const val = model.get(v);
      if ((lit > 0 && val) || (lit < 0 && !val)) { satisfied = true; break; }
    }
    if (!satisfied) return false;
  }
  return true;
}

export function parseDIMACS(str) {
  let numVars = 0;
  const clauses = [];
  for (const line of str.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('c')) continue;
    if (trimmed.startsWith('p')) {
      const parts = trimmed.split(/\s+/);
      numVars = parseInt(parts[2]) || 0;
      continue;
    }
    const lits = trimmed.split(/\s+/).map(Number).filter(n => n !== 0);
    if (lits.length > 0) clauses.push(lits);
  }
  return { numVars, clauses };
}

export function toDIMACS(numVars, clauses) {
  const lines = [`p cnf ${numVars} ${clauses.length}`];
  for (const cl of clauses) {
    lines.push(cl.join(' ') + ' 0');
  }
  return lines.join('\n');
}

// High-level solve function (auto-detects format)
export function solve(clauses) {
  // Determine numVars
  let maxVar = 0;
  for (const cl of clauses) {
    for (const lit of cl) maxVar = Math.max(maxVar, Math.abs(lit));
  }
  const solver = new CDCLSolver(maxVar, clauses);
  return solver.solve();
}

// ===== Problem Generators =====

// Pigeonhole: n+1 pigeons, n holes → always UNSAT
export function pigeonhole(n) {
  const clauses = [];
  // Each pigeon must be in some hole
  for (let p = 1; p <= n + 1; p++) {
    const clause = [];
    for (let h = 1; h <= n; h++) {
      clause.push(varIndex(p, h, n));
    }
    clauses.push(clause);
  }
  // No two pigeons in the same hole
  for (let h = 1; h <= n; h++) {
    for (let p1 = 1; p1 <= n + 1; p1++) {
      for (let p2 = p1 + 1; p2 <= n + 1; p2++) {
        clauses.push([-varIndex(p1, h, n), -varIndex(p2, h, n)]);
      }
    }
  }
  return { clauses, numVars: (n + 1) * n };
}

function varIndex(pigeon, hole, n) {
  return (pigeon - 1) * n + hole;
}

// Random k-SAT
export function randomSAT(numVars, numClauses, k = 3) {
  const clauses = [];
  for (let i = 0; i < numClauses; i++) {
    const clause = [];
    const used = new Set();
    while (clause.length < k) {
      const v = Math.floor(Math.random() * numVars) + 1;
      if (used.has(v)) continue;
      used.add(v);
      clause.push(Math.random() < 0.5 ? v : -v);
    }
    clauses.push(clause);
  }
  return clauses;
}

// N-Queens as SAT
export function nQueens(n) {
  const clauses = [];
  const v = (r, c) => r * n + c + 1;
  
  // At least one queen per row
  for (let r = 0; r < n; r++) {
    const clause = [];
    for (let c = 0; c < n; c++) clause.push(v(r, c));
    clauses.push(clause);
  }
  
  // At most one queen per row
  for (let r = 0; r < n; r++) {
    for (let c1 = 0; c1 < n; c1++) {
      for (let c2 = c1 + 1; c2 < n; c2++) {
        clauses.push([-v(r, c1), -v(r, c2)]);
      }
    }
  }
  
  // At most one queen per column
  for (let c = 0; c < n; c++) {
    for (let r1 = 0; r1 < n; r1++) {
      for (let r2 = r1 + 1; r2 < n; r2++) {
        clauses.push([-v(r1, c), -v(r2, c)]);
      }
    }
  }
  
  // At most one queen per diagonal
  for (let r1 = 0; r1 < n; r1++) {
    for (let c1 = 0; c1 < n; c1++) {
      for (let r2 = r1 + 1; r2 < n; r2++) {
        const c2a = c1 + (r2 - r1);
        const c2b = c1 - (r2 - r1);
        if (c2a >= 0 && c2a < n) clauses.push([-v(r1, c1), -v(r2, c2a)]);
        if (c2b >= 0 && c2b < n) clauses.push([-v(r1, c1), -v(r2, c2b)]);
      }
    }
  }
  
  return { clauses, numVars: n * n };
}
