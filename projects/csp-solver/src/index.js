// ===== Constraint Satisfaction Problem (CSP) Solver =====
//
// A CSP consists of:
//   - Variables, each with a domain of possible values
//   - Constraints between variables
//
// Solving techniques:
//   1. AC-3: Arc consistency — prune impossible values
//   2. Backtracking search with MRV (minimum remaining values) heuristic
//   3. Forward checking (propagate after each assignment)

export class CSP {
  constructor() {
    this.variables = new Map();   // name → Set of domain values
    this.constraints = [];         // list of { vars: [names], check: (assignment) => bool }
    this.neighbors = new Map();    // name → Set of neighboring variable names
  }

  // Add a variable with its domain
  addVariable(name, domain) {
    this.variables.set(name, new Set(domain));
    if (!this.neighbors.has(name)) this.neighbors.set(name, new Set());
  }

  // Add a binary constraint between two variables
  addConstraint(vars, check) {
    this.constraints.push({ vars, check });
    // Update neighbor map
    for (let i = 0; i < vars.length; i++) {
      for (let j = 0; j < vars.length; j++) {
        if (i !== j) {
          if (!this.neighbors.has(vars[i])) this.neighbors.set(vars[i], new Set());
          this.neighbors.get(vars[i]).add(vars[j]);
        }
      }
    }
  }

  // Shorthand: add "all different" constraint for a group of variables
  addAllDifferent(vars) {
    for (let i = 0; i < vars.length; i++) {
      for (let j = i + 1; j < vars.length; j++) {
        this.addConstraint([vars[i], vars[j]], (a) => a.get(vars[i]) !== a.get(vars[j]));
      }
    }
  }

  // Shorthand: fix a variable to a value
  fix(name, value) {
    this.variables.set(name, new Set([value]));
  }

  // ===== AC-3: Arc Consistency =====
  
  ac3() {
    // Queue of arcs to check: [xi, xj] means "revise xi's domain wrt xj"
    const queue = [];
    
    for (const constraint of this.constraints) {
      if (constraint.vars.length === 2) {
        queue.push([constraint.vars[0], constraint.vars[1], constraint]);
        queue.push([constraint.vars[1], constraint.vars[0], constraint]);
      }
    }
    
    while (queue.length > 0) {
      const [xi, xj, constraint] = queue.shift();
      
      if (this._revise(xi, xj, constraint)) {
        const domain = this.variables.get(xi);
        if (domain.size === 0) return false; // domain wipeout
        
        // Add all arcs (xk, xi) for neighbors of xi
        for (const xk of this.neighbors.get(xi) || []) {
          if (xk !== xj) {
            // Find constraint between xk and xi
            for (const c of this.constraints) {
              if (c.vars.length === 2 && c.vars.includes(xk) && c.vars.includes(xi)) {
                queue.push([xk, xi, c]);
              }
            }
          }
        }
      }
    }
    
    return true;
  }
  
  // Remove values from xi's domain that have no support in xj's domain
  _revise(xi, xj, constraint) {
    let revised = false;
    const domainI = this.variables.get(xi);
    const domainJ = this.variables.get(xj);
    
    for (const vi of [...domainI]) {
      let hasSupport = false;
      for (const vj of domainJ) {
        const assignment = new Map();
        assignment.set(xi, vi);
        assignment.set(xj, vj);
        if (constraint.check(assignment)) {
          hasSupport = true;
          break;
        }
      }
      if (!hasSupport) {
        domainI.delete(vi);
        revised = true;
      }
    }
    
    return revised;
  }

  // ===== Backtracking Search with MRV =====
  
  solve() {
    // Run AC-3 first
    if (!this.ac3()) return null;
    
    // Check if already solved
    const assignment = new Map();
    let allAssigned = true;
    for (const [name, domain] of this.variables) {
      if (domain.size === 1) {
        assignment.set(name, [...domain][0]);
      } else if (domain.size === 0) {
        return null;
      } else {
        allAssigned = false;
      }
    }
    if (allAssigned) return assignment;
    
    return this._backtrack(assignment);
  }
  
  _backtrack(assignment) {
    // Check if complete
    if (assignment.size === this.variables.size) {
      return this._isConsistent(assignment) ? new Map(assignment) : null;
    }
    
    // Select unassigned variable with MRV (minimum remaining values)
    const varName = this._selectVariable(assignment);
    if (!varName) return null;
    
    const domain = this.variables.get(varName);
    
    // Try each value in domain order
    for (const value of [...domain]) {
      assignment.set(varName, value);
      
      if (this._isPartiallyConsistent(assignment, varName)) {
        // Forward checking: temporarily prune neighbor domains
        const pruned = this._forwardCheck(assignment, varName, value);
        
        if (pruned !== null) {
          const result = this._backtrack(assignment);
          if (result) return result;
          
          // Undo pruning
          this._undoPruning(pruned);
        }
      }
      
      assignment.delete(varName);
    }
    
    return null;
  }
  
  // Select unassigned variable with smallest domain (MRV heuristic)
  _selectVariable(assignment) {
    let bestVar = null;
    let bestSize = Infinity;
    
    for (const [name, domain] of this.variables) {
      if (!assignment.has(name) && domain.size < bestSize) {
        bestSize = domain.size;
        bestVar = name;
      }
    }
    
    return bestVar;
  }
  
  // Check if assignment is consistent for the just-assigned variable
  _isPartiallyConsistent(assignment, varName) {
    for (const constraint of this.constraints) {
      if (!constraint.vars.includes(varName)) continue;
      
      // Check if all variables in constraint are assigned
      let allAssigned = true;
      for (const v of constraint.vars) {
        if (!assignment.has(v)) { allAssigned = false; break; }
      }
      
      if (allAssigned && !constraint.check(assignment)) return false;
    }
    return true;
  }
  
  // Check full assignment consistency
  _isConsistent(assignment) {
    for (const constraint of this.constraints) {
      let allAssigned = true;
      for (const v of constraint.vars) {
        if (!assignment.has(v)) { allAssigned = false; break; }
      }
      if (allAssigned && !constraint.check(assignment)) return false;
    }
    return true;
  }
  
  // Forward checking: prune values from unassigned neighbors
  _forwardCheck(assignment, varName, value) {
    const pruned = []; // list of { variable, values } to restore
    
    for (const neighbor of this.neighbors.get(varName) || []) {
      if (assignment.has(neighbor)) continue;
      
      const domain = this.variables.get(neighbor);
      const removed = [];
      
      for (const nValue of [...domain]) {
        const testAssign = new Map(assignment);
        testAssign.set(neighbor, nValue);
        
        let consistent = true;
        for (const constraint of this.constraints) {
          if (!constraint.vars.includes(varName) || !constraint.vars.includes(neighbor)) continue;
          let allAssigned = true;
          for (const v of constraint.vars) {
            if (!testAssign.has(v)) { allAssigned = false; break; }
          }
          if (allAssigned && !constraint.check(testAssign)) {
            consistent = false;
            break;
          }
        }
        
        if (!consistent) {
          domain.delete(nValue);
          removed.push(nValue);
        }
      }
      
      if (removed.length > 0) {
        pruned.push({ variable: neighbor, values: removed });
      }
      
      if (domain.size === 0) {
        // Domain wipeout — undo and return null
        this._undoPruning(pruned);
        return null;
      }
    }
    
    return pruned;
  }
  
  _undoPruning(pruned) {
    for (const { variable, values } of pruned) {
      const domain = this.variables.get(variable);
      for (const v of values) domain.add(v);
    }
  }
}

// ===== Problem Encodings =====

// Sudoku: 9x9 grid, values 1-9, row/col/box constraints
export function sudoku(grid) {
  const csp = new CSP();
  const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  
  // Variables
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const name = `r${r}c${c}`;
      if (grid[r][c] !== 0) {
        csp.addVariable(name, [grid[r][c]]);
      } else {
        csp.addVariable(name, vals);
      }
    }
  }
  
  // Row constraints
  for (let r = 0; r < 9; r++) {
    const rowVars = [];
    for (let c = 0; c < 9; c++) rowVars.push(`r${r}c${c}`);
    csp.addAllDifferent(rowVars);
  }
  
  // Column constraints
  for (let c = 0; c < 9; c++) {
    const colVars = [];
    for (let r = 0; r < 9; r++) colVars.push(`r${r}c${c}`);
    csp.addAllDifferent(colVars);
  }
  
  // Box constraints
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const boxVars = [];
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          boxVars.push(`r${br*3+dr}c${bc*3+dc}`);
        }
      }
      csp.addAllDifferent(boxVars);
    }
  }
  
  return csp;
}

// N-Queens
export function nQueens(n) {
  const csp = new CSP();
  const cols = Array.from({ length: n }, (_, i) => i);
  
  // Variable per row: queen_r = column of queen in row r
  for (let r = 0; r < n; r++) {
    csp.addVariable(`q${r}`, cols);
  }
  
  // All different columns
  const queenVars = Array.from({ length: n }, (_, i) => `q${i}`);
  csp.addAllDifferent(queenVars);
  
  // Diagonal constraints
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      csp.addConstraint([`q${i}`, `q${j}`], (a) => {
        const ci = a.get(`q${i}`);
        const cj = a.get(`q${j}`);
        return Math.abs(ci - cj) !== Math.abs(i - j);
      });
    }
  }
  
  return csp;
}

// Graph coloring
export function graphColoring(numNodes, edges, numColors) {
  const csp = new CSP();
  const colors = Array.from({ length: numColors }, (_, i) => i);
  
  for (let n = 0; n < numNodes; n++) {
    csp.addVariable(`n${n}`, colors);
  }
  
  for (const [a, b] of edges) {
    csp.addConstraint([`n${a}`, `n${b}`], (assign) => {
      return assign.get(`n${a}`) !== assign.get(`n${b}`);
    });
  }
  
  return csp;
}

// Map coloring (like graph coloring but with named regions)
export function mapColoring(regions, adjacency, colors) {
  const csp = new CSP();
  
  for (const region of regions) {
    csp.addVariable(region, colors);
  }
  
  for (const [a, b] of adjacency) {
    csp.addConstraint([a, b], (assign) => assign.get(a) !== assign.get(b));
  }
  
  return csp;
}
