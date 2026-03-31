/**
 * Tiny Constraint Solver
 *
 * Solves constraint satisfaction problems (CSPs) using:
 * - Arc consistency (AC-3) for domain pruning
 * - Backtracking search with MRV (minimum remaining values) heuristic
 * - Forward checking to detect failures early
 * - Built-in constraint types: allDiff, equals, notEquals, lessThan, etc.
 *
 * Classic CSP problems: Sudoku, N-Queens, map coloring, cryptarithmetic
 */

class CSP {
  constructor() {
    this.variables = new Map();   // name -> Set of domain values
    this.constraints = [];         // [{vars, check}]
    this.arcs = new Map();         // var -> Set of constraint indices
  }

  /**
   * Add a variable with its domain
   * @param {string} name
   * @param {any[]} domain
   */
  addVariable(name, domain) {
    this.variables.set(name, new Set(domain));
    if (!this.arcs.has(name)) this.arcs.set(name, new Set());
    return this;
  }

  /**
   * Add a constraint between variables
   * @param {string[]} vars - Variable names involved
   * @param {Function} check - (assignment) => boolean
   */
  addConstraint(vars, check) {
    const idx = this.constraints.length;
    this.constraints.push({ vars, check });
    for (const v of vars) {
      if (!this.arcs.has(v)) this.arcs.set(v, new Set());
      this.arcs.get(v).add(idx);
    }
    return this;
  }

  /**
   * AC-3 arc consistency algorithm
   * Prunes domains to maintain arc consistency
   * @returns {boolean} false if any domain becomes empty (unsolvable)
   */
  ac3(domains = null) {
    domains = domains || this.variables;
    const queue = [];

    // Initialize queue with all arcs
    for (const c of this.constraints) {
      if (c.vars.length === 2) {
        queue.push([c.vars[0], c.vars[1], c]);
        queue.push([c.vars[1], c.vars[0], c]);
      }
    }

    while (queue.length > 0) {
      const [xi, xj, constraint] = queue.shift();
      if (this._revise(domains, xi, xj, constraint)) {
        if (domains.get(xi).size === 0) return false;
        // Add all arcs involving xi (except xi-xj)
        for (const ci of this.arcs.get(xi)) {
          const c = this.constraints[ci];
          if (c === constraint) continue;
          for (const v of c.vars) {
            if (v !== xi && c.vars.length === 2) {
              queue.push([v, xi, c]);
            }
          }
        }
      }
    }
    return true;
  }

  _revise(domains, xi, xj, constraint) {
    let revised = false;
    const toRemove = [];
    for (const vi of domains.get(xi)) {
      let satisfiable = false;
      for (const vj of domains.get(xj)) {
        const assignment = {};
        assignment[xi] = vi;
        assignment[xj] = vj;
        if (constraint.check(assignment)) {
          satisfiable = true;
          break;
        }
      }
      if (!satisfiable) toRemove.push(vi);
    }
    for (const v of toRemove) {
      domains.get(xi).delete(v);
      revised = true;
    }
    return revised;
  }

  /**
   * Solve the CSP using backtracking with MRV heuristic
   * @param {boolean} findAll - If true, find all solutions
   * @returns {Object|Object[]|null}
   */
  solve(findAll = false) {
    // Clone domains
    const domains = new Map();
    for (const [k, v] of this.variables) {
      domains.set(k, new Set(v));
    }

    // Run AC-3 first
    if (!this.ac3(domains)) return findAll ? [] : null;

    const solutions = [];
    const assignment = {};

    const backtrack = () => {
      // Check if complete
      if (Object.keys(assignment).length === this.variables.size) {
        if (findAll) {
          solutions.push({ ...assignment });
          return false; // keep searching
        }
        return true;
      }

      // MRV: pick variable with smallest domain
      let minVar = null, minSize = Infinity;
      for (const [name, domain] of domains) {
        if (name in assignment) continue;
        if (domain.size < minSize) {
          minSize = domain.size;
          minVar = name;
        }
      }

      if (!minVar || minSize === 0) return false;

      // Try each value in domain
      const values = [...domains.get(minVar)];
      for (const value of values) {
        assignment[minVar] = value;

        if (this._isConsistent(assignment, minVar)) {
          // Forward checking: save and prune domains
          const saved = this._forwardCheck(domains, assignment, minVar, value);
          if (saved !== null) {
            if (backtrack()) return true;
            // Restore domains
            this._restoreDomains(domains, saved);
          }
        }

        delete assignment[minVar];
      }

      return false;
    };

    backtrack();
    return findAll ? solutions : (Object.keys(assignment).length === this.variables.size ? { ...assignment } : (solutions[0] || null));
  }

  _isConsistent(assignment, justAssigned) {
    for (const ci of this.arcs.get(justAssigned)) {
      const c = this.constraints[ci];
      // Only check if all variables in the constraint are assigned
      if (c.vars.every(v => v in assignment)) {
        if (!c.check(assignment)) return false;
      }
    }
    return true;
  }

  _forwardCheck(domains, assignment, variable, value) {
    const saved = new Map();
    for (const ci of this.arcs.get(variable)) {
      const c = this.constraints[ci];
      for (const neighbor of c.vars) {
        if (neighbor === variable || neighbor in assignment) continue;
        const toRemove = [];
        for (const nv of domains.get(neighbor)) {
          const testAssignment = { ...assignment, [neighbor]: nv };
          if (c.vars.every(v => v in testAssignment) && !c.check(testAssignment)) {
            toRemove.push(nv);
          }
        }
        if (toRemove.length > 0) {
          if (!saved.has(neighbor)) saved.set(neighbor, new Set(domains.get(neighbor)));
          for (const r of toRemove) domains.get(neighbor).delete(r);
          if (domains.get(neighbor).size === 0) {
            this._restoreDomains(domains, saved);
            return null;
          }
        }
      }
    }
    return saved;
  }

  _restoreDomains(domains, saved) {
    for (const [name, domain] of saved) {
      domains.set(name, domain);
    }
  }
}

// ==================== Built-in Constraints ====================

/** All variables must have different values */
const allDiff = (...vars) => ({
  vars,
  check: (a) => {
    const vals = vars.filter(v => v in a).map(v => a[v]);
    return new Set(vals).size === vals.length;
  }
});

/** Two variables must be equal */
const equals = (a, b) => ({
  vars: [a, b],
  check: (assignment) => assignment[a] === assignment[b]
});

/** Two variables must not be equal */
const notEquals = (a, b) => ({
  vars: [a, b],
  check: (assignment) => assignment[a] !== assignment[b]
});

/** a < b */
const lessThan = (a, b) => ({
  vars: [a, b],
  check: (assignment) => assignment[a] < assignment[b]
});

/** a + b = c (or a + b = constant) */
const sum = (a, b, c) => ({
  vars: typeof c === 'string' ? [a, b, c] : [a, b],
  check: typeof c === 'string'
    ? (assignment) => assignment[a] + assignment[b] === assignment[c]
    : (assignment) => assignment[a] + assignment[b] === c
});

/** Custom constraint */
const constraint = (vars, check) => ({ vars, check });

// ==================== Problem Builders ====================

/** Create an N-Queens problem */
function nQueens(n) {
  const csp = new CSP();
  const cols = Array.from({ length: n }, (_, i) => i);

  for (let row = 0; row < n; row++) {
    csp.addVariable(`Q${row}`, cols);
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const qi = `Q${i}`, qj = `Q${j}`;
      csp.addConstraint([qi, qj], (a) => {
        if (!(qi in a) || !(qj in a)) return true;
        const ci = a[qi], cj = a[qj];
        return ci !== cj && Math.abs(ci - cj) !== Math.abs(i - j);
      });
    }
  }

  return csp;
}

/** Create a map coloring problem */
function mapColoring(regions, neighbors, colors) {
  const csp = new CSP();
  for (const r of regions) {
    csp.addVariable(r, colors);
  }
  for (const [a, b] of neighbors) {
    const c = notEquals(a, b);
    csp.addConstraint(c.vars, c.check);
  }
  return csp;
}

/** Create a Sudoku puzzle (values is a 2D 9x9 array, 0 = empty) */
function sudoku(grid) {
  const csp = new CSP();
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Variables
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const name = `R${r}C${c}`;
      if (grid[r][c] !== 0) {
        csp.addVariable(name, [grid[r][c]]);
      } else {
        csp.addVariable(name, digits);
      }
    }
  }

  // Row constraints
  for (let r = 0; r < 9; r++) {
    const vars = Array.from({ length: 9 }, (_, c) => `R${r}C${c}`);
    const ad = allDiff(...vars);
    csp.addConstraint(ad.vars, ad.check);
    // Also add pairwise for AC-3
    for (let i = 0; i < 9; i++) {
      for (let j = i + 1; j < 9; j++) {
        const ne = notEquals(vars[i], vars[j]);
        csp.addConstraint(ne.vars, ne.check);
      }
    }
  }

  // Column constraints
  for (let c = 0; c < 9; c++) {
    const vars = Array.from({ length: 9 }, (_, r) => `R${r}C${c}`);
    for (let i = 0; i < 9; i++) {
      for (let j = i + 1; j < 9; j++) {
        const ne = notEquals(vars[i], vars[j]);
        csp.addConstraint(ne.vars, ne.check);
      }
    }
  }

  // Box constraints
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const vars = [];
      for (let r = br * 3; r < br * 3 + 3; r++) {
        for (let c = bc * 3; c < bc * 3 + 3; c++) {
          vars.push(`R${r}C${c}`);
        }
      }
      for (let i = 0; i < 9; i++) {
        for (let j = i + 1; j < 9; j++) {
          const ne = notEquals(vars[i], vars[j]);
          csp.addConstraint(ne.vars, ne.check);
        }
      }
    }
  }

  return csp;
}

module.exports = {
  CSP,
  allDiff, equals, notEquals, lessThan, sum, constraint,
  nQueens, mapColoring, sudoku,
};
