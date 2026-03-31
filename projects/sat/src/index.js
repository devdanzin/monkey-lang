/**
 * Tiny SAT Solver — DPLL Algorithm
 * 
 * Boolean satisfiability:
 * - CNF (Conjunctive Normal Form) input
 * - Unit propagation
 * - Pure literal elimination
 * - DPLL backtracking search
 * - Model extraction
 */

// Literal: positive int = variable true, negative = variable false
// Clause: array of literals
// Formula: array of clauses (CNF)

function solve(clauses) {
  const vars = new Set();
  for (const clause of clauses) {
    for (const lit of clause) vars.add(Math.abs(lit));
  }
  const assignment = new Map();
  return dpll([...clauses.map(c => [...c])], assignment, [...vars]);
}

function dpll(clauses, assignment, vars) {
  // Simplify
  clauses = simplify(clauses, assignment);
  
  // Check if all clauses satisfied
  if (clauses.length === 0) return { sat: true, model: new Map(assignment) };
  
  // Check for empty clause (conflict)
  if (clauses.some(c => c.length === 0)) return { sat: false };
  
  // Unit propagation
  let changed = true;
  while (changed) {
    changed = false;
    for (const clause of clauses) {
      if (clause.length === 1) {
        const lit = clause[0];
        const v = Math.abs(lit);
        const val = lit > 0;
        if (assignment.has(v)) continue;
        assignment.set(v, val);
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
    for (const lit of clause) {
      litCount.set(lit, (litCount.get(lit) || 0) + 1);
    }
  }
  for (const [lit] of litCount) {
    const neg = -lit;
    if (!litCount.has(neg)) {
      const v = Math.abs(lit);
      if (!assignment.has(v)) {
        assignment.set(v, lit > 0);
        clauses = simplify(clauses, assignment);
      }
    }
  }
  
  if (clauses.length === 0) return { sat: true, model: new Map(assignment) };
  if (clauses.some(c => c.length === 0)) return { sat: false };
  
  // Choose a variable to branch on
  let chosen = null;
  for (const clause of clauses) {
    for (const lit of clause) {
      const v = Math.abs(lit);
      if (!assignment.has(v)) { chosen = v; break; }
    }
    if (chosen) break;
  }
  
  if (!chosen) return { sat: true, model: new Map(assignment) };
  
  // Try true
  const a1 = new Map(assignment);
  a1.set(chosen, true);
  const r1 = dpll(clauses.map(c => [...c]), a1, vars);
  if (r1.sat) return r1;
  
  // Try false
  const a2 = new Map(assignment);
  a2.set(chosen, false);
  return dpll(clauses.map(c => [...c]), a2, vars);
}

function simplify(clauses, assignment) {
  return clauses
    .filter(clause => {
      // Remove clause if any literal is satisfied
      for (const lit of clause) {
        const v = Math.abs(lit);
        if (assignment.has(v)) {
          if ((lit > 0) === assignment.get(v)) return false; // clause satisfied
        }
      }
      return true;
    })
    .map(clause => {
      // Remove falsified literals
      return clause.filter(lit => {
        const v = Math.abs(lit);
        if (assignment.has(v)) {
          return (lit > 0) === assignment.get(v); // keep only possibly true
        }
        return true;
      });
    });
}

/**
 * Check if a model satisfies the formula
 */
function verify(clauses, model) {
  for (const clause of clauses) {
    let satisfied = false;
    for (const lit of clause) {
      const v = Math.abs(lit);
      const val = model.get(v);
      if ((lit > 0 && val) || (lit < 0 && !val)) {
        satisfied = true;
        break;
      }
    }
    if (!satisfied) return false;
  }
  return true;
}

/**
 * Parse DIMACS format
 */
function parseDIMACS(str) {
  const clauses = [];
  for (const line of str.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('c') || trimmed.startsWith('p')) continue;
    const lits = trimmed.split(/\s+/).map(Number).filter(n => n !== 0);
    if (lits.length > 0) clauses.push(lits);
  }
  return clauses;
}

module.exports = { solve, verify, parseDIMACS };
