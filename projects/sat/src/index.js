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
    
    // Trail (with propagation queue pointer)
    this.trail = [];
    this.trailLim = []; // trail.length at start of each decision level
    this.qhead = 0;     // next trail position to propagate
    
    // All clauses (original + learned)
    this.clauses = clauses.map(c => [...c]);
    
    // Two-watched literal scheme: watches[lit] = list of clause indices
    // Literal encoding: positive lit l → index 2*l, negative lit -l → index 2*l+1
    this.watches = new Map(); // lit → [clause indices]
    
    // VSIDS
    this.activity = new Float64Array(numVars + 1);
    this.activityInc = 1.0;
    this.activityDecay = 0.95; // Decay factor
    this.phaseSaving = new Int8Array(numVars + 1); // 0=unset, 1=true, -1=false
    
    // Stats
    this.stats = { decisions: 0, propagations: 0, conflicts: 0, learned: 0, restarts: 0 };
    this.proofTrace = []; // Resolution proof trace for UNSAT proofs
    this.restartBase = 100; // Base restart interval
    this.restartIdx = 0;    // Luby sequence index
    
    // Init activity and watches
    for (const cl of this.clauses) {
      for (const lit of cl) this.activity[Math.abs(lit)] += 1;
    }
    this._initWatches();
  }

  _initWatches() {
    this.watches = new Map();
    for (let ci = 0; ci < this.clauses.length; ci++) {
      const cl = this.clauses[ci];
      if (cl.length >= 2) {
        this._addWatch(cl[0], ci);
        this._addWatch(cl[1], ci);
      } else if (cl.length === 1) {
        // Unit clauses handled directly during initial propagation
        this._addWatch(cl[0], ci);
      }
    }
  }

  _addWatch(lit, ci) {
    if (!this.watches.has(lit)) this.watches.set(lit, []);
    this.watches.get(lit).push(ci);
  }

  _watchClause(ci) {
    const cl = this.clauses[ci];
    if (cl.length >= 2) {
      this._addWatch(cl[0], ci);
      this._addWatch(cl[1], ci);
    } else if (cl.length === 1) {
      this._addWatch(cl[0], ci);
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
      // Save phase for phase-saving heuristic
      this.phaseSaving[v] = this.assignment.get(v) ? 1 : -1;
      this.assignment.delete(v);
      this.level.delete(v);
      this.reason.delete(v);
    }
    this.trailLim.length = level;
    this.qhead = this.trail.length;
  }

  // Two-watched literal unit propagation
  // Returns conflicting clause index or null
  _propagate() {
    while (this.qhead < this.trail.length) {
      const v = this.trail[this.qhead++];
      // The falsified literal is the opposite of what was assigned
      const falseLit = this.assignment.get(v) ? -v : v;
      
      const watchList = this.watches.get(falseLit);
      if (!watchList) continue;
      
      const newWatchList = [];
      
      for (let wi = 0; wi < watchList.length; wi++) {
        const ci = watchList[wi];
        const cl = this.clauses[ci];
        
        // Handle unit clauses
        if (cl.length === 1) {
          if (this._litValue(cl[0]) === -1) {
            // Conflict — keep remaining watches
            for (let j = wi + 1; j < watchList.length; j++) newWatchList.push(watchList[j]);
            this.watches.set(falseLit, newWatchList);
            return ci;
          }
          newWatchList.push(ci);
          continue;
        }
        
        // Make sure falseLit is at position 1 (swap if at 0)
        if (cl[0] === falseLit) {
          cl[0] = cl[1];
          cl[1] = falseLit;
        }
        
        // If the other watched literal (cl[0]) is true, clause is satisfied
        if (this._litValue(cl[0]) === 1) {
          newWatchList.push(ci);
          continue;
        }
        
        // Try to find a new literal to watch (not false, not cl[0])
        let found = false;
        for (let k = 2; k < cl.length; k++) {
          if (this._litValue(cl[k]) !== -1) {
            // Swap cl[k] with cl[1] and watch cl[k]
            cl[1] = cl[k];
            cl[k] = falseLit;
            this._addWatch(cl[1], ci);
            found = true;
            break;
          }
        }
        
        if (found) continue; // Don't add back to falseLit's watch list
        
        // No replacement found — cl[0] is the only non-false literal
        newWatchList.push(ci);
        
        if (this._litValue(cl[0]) === -1) {
          // Conflict — keep remaining watches
          for (let j = wi + 1; j < watchList.length; j++) newWatchList.push(watchList[j]);
          this.watches.set(falseLit, newWatchList);
          return ci;
        }
        
        if (this._litValue(cl[0]) === 0) {
          // Unit propagation
          const uv = Math.abs(cl[0]);
          this._assign(uv, cl[0] > 0, this._currentLevel(), ci);
          this.stats.propagations++;
        }
      }
      
      this.watches.set(falseLit, newWatchList);
    }
    return null;
  }

  // 1UIP conflict analysis (MiniSat-style single-pass)
  _analyze(conflictCI) {
    const dl = this._currentLevel();
    if (dl === 0) {
      // UNSAT at decision level 0 — record empty clause derivation
      this.proofTrace.push({
        type: 'unsat',
        conflictClause: conflictCI,
        derivedEmpty: true,
      });
      return null;
    }
    
    const seen = new Set();
    const learned = [];
    let counter = 0;
    const resolutionSteps = []; // Track resolution chain

    const processLits = (clauseLits) => {
      for (const lit of clauseLits) {
        const v = Math.abs(lit);
        if (seen.has(v)) continue;
        seen.add(v);
        const vLevel = this.level.get(v) ?? 0;
        if (vLevel === dl) {
          counter++;
        } else if (vLevel > 0) {
          learned.push(lit);
        }
      }
    };

    processLits(this.clauses[conflictCI]);
    resolutionSteps.push({ step: 'start', clauseIdx: conflictCI, clause: [...this.clauses[conflictCI]] });

    let trailIdx = this.trail.length - 1;
    let uipVar = -1;

    while (counter > 0) {
      while (trailIdx >= 0) {
        const v = this.trail[trailIdx];
        if (seen.has(v) && (this.level.get(v) ?? 0) === dl) break;
        trailIdx--;
      }

      uipVar = this.trail[trailIdx];
      counter--;

      if (counter === 0) break;

      const reasonCI = this.reason.get(uipVar);
      if (reasonCI !== null && reasonCI !== undefined) {
        processLits(this.clauses[reasonCI]);
        resolutionSteps.push({
          step: 'resolve',
          variable: uipVar,
          reasonClauseIdx: reasonCI,
          reasonClause: [...this.clauses[reasonCI]],
        });
      }
      trailIdx--;
    }
    
    // Build learned clause: negated UIP first, then side literals
    const uipLit = this.assignment.get(uipVar) ? -uipVar : uipVar;
    learned.unshift(uipLit);
    
    // Determine backtrack level (second highest level in learned clause)
    let btLevel = 0;
    for (let i = 1; i < learned.length; i++) {
      const vl = this.level.get(Math.abs(learned[i])) ?? 0;
      if (vl > btLevel) btLevel = vl;
    }
    
    // Bump VSIDS activity for all variables in learned clause
    for (const lit of learned) {
      this.activity[Math.abs(lit)] += this.activityInc;
    }
    this.activityInc *= 1.0 / this.activityDecay; // Equivalent to decaying all activities

    // Rescale if activity values get too large
    if (this.activityInc > 1e100) {
      for (let i = 1; i <= this.numVars; i++) {
        this.activity[i] *= 1e-100;
      }
      this.activityInc *= 1e-100;
    }

    // Record in proof trace
    this.proofTrace.push({
      type: 'learn',
      learnedClause: [...learned],
      clauseIdx: this.clauses.length, // Will be added as this index
      uip: uipVar,
      btLevel,
      resolutionSteps,
    });

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
    // Initial unit clause propagation (level 0)
    for (let ci = 0; ci < this.clauses.length; ci++) {
      const cl = this.clauses[ci];
      if (cl.length === 1) {
        const v = Math.abs(cl[0]);
        if (!this.assignment.has(v)) {
          this._assign(v, cl[0] > 0, 0, ci);
          this.stats.propagations++;
        } else if (this._litValue(cl[0]) === -1) {
          return { sat: false, stats: this.stats, proof: this.proofTrace };
        }
      }
    }
    
    let conflict = this._propagate();
    if (conflict !== null) return { sat: false, stats: this.stats, proof: this.proofTrace };
    
    let nextRestart = this.restartBase * luby(++this.restartIdx);
    let conflictsAtRestart = this.stats.conflicts + nextRestart;
    
    while (true) {
      // Restart check (Luby schedule)
      if (this.stats.conflicts >= conflictsAtRestart) {
        this.stats.restarts++;
        this._backtrackTo(0);
        nextRestart = this.restartBase * luby(++this.restartIdx);
        conflictsAtRestart = this.stats.conflicts + nextRestart;
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
      // Phase saving: prefer the last assignment direction
      const phase = this.phaseSaving[v] === -1 ? false : true;
      this._assign(v, phase, this._currentLevel(), null);
      
      conflict = this._propagate();
      
      while (conflict !== null) {
        this.stats.conflicts++;
        
        const analysis = this._analyze(conflict);
        if (!analysis) return { sat: false, stats: this.stats, proof: this.proofTrace };
        
        const { learned, btLevel } = analysis;
        
        this._backtrackTo(btLevel);
        
        if (learned.length > 0) {
          const ci = this.clauses.length;
          this.clauses.push(learned);
          this._watchClause(ci);
          this.stats.learned++;
          
          // Assert the UIP literal (first lit in learned clause)
          // After backtracking, all other lits are false at btLevel, so learned[0] is unit
          if (learned.length === 1) {
            // Unit learned clause — assert at level 0
            const v = Math.abs(learned[0]);
            if (!this.assignment.has(v)) {
              this._assign(v, learned[0] > 0, 0, ci);
              this.stats.propagations++;
            }
          } else {
            const uipLit = learned[0];
            const v = Math.abs(uipLit);
            this._assign(v, uipLit > 0, this._currentLevel(), ci);
            this.stats.propagations++;
          }
        }
        
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
// Luby sequence: 1, 1, 2, 1, 1, 2, 4, 1, 1, 2, 1, 1, 2, 4, 8, ...
// Uses the Knuth iterative computation
export function luby(i) {
  let u = 1, v = 1;
  for (let n = 0; n < i; n++) {
    if ((u & -u) === v) {
      u++;
      v = 1;
    } else {
      v *= 2;
    }
  }
  return v;
}

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
