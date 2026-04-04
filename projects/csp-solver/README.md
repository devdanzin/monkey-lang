# CSP Solver

A constraint satisfaction problem (CSP) solver implementing AC-3 arc consistency and backtracking search with MRV heuristic and forward checking.

## Features

- **AC-3 Arc Consistency**: Prune impossible values before search
- **Backtracking Search**: Systematic exploration with MRV variable ordering
- **Forward Checking**: Propagate constraints after each assignment
- **Problem Encodings**: Sudoku, N-Queens, graph coloring, map coloring

## Usage

```javascript
import { CSP, sudoku, nQueens, graphColoring, mapColoring } from './src/index.js';

// Sudoku
const grid = [
  [5,3,0, 0,7,0, 0,0,0],
  [6,0,0, 1,9,5, 0,0,0],
  // ... (0 = empty cell)
];
const sol = sudoku(grid).solve();

// N-Queens
const queens = nQueens(8).solve();
// queens.get('q0') = column of queen in row 0, etc.

// Graph coloring
const coloring = graphColoring(4, [[0,1],[1,2],[2,3],[3,0]], 3).solve();

// Map coloring (Australia)
const map = mapColoring(
  ['WA','NT','SA','Q','NSW','V','T'],
  [['WA','NT'],['WA','SA'],['NT','SA'],['NT','Q'],['SA','Q'],['SA','NSW'],['SA','V'],['Q','NSW'],['NSW','V']],
  ['red','green','blue']
).solve();

// Custom CSP
const csp = new CSP();
csp.addVariable('x', [1, 2, 3, 4, 5]);
csp.addVariable('y', [1, 2, 3, 4, 5]);
csp.addConstraint(['x', 'y'], (a) => a.get('x') + a.get('y') === 7);
csp.solve(); // { x: 2, y: 5 } or similar
```

## Architecture

### AC-3 Arc Consistency

Maintains a queue of arcs (variable pairs). For each arc (Xi, Xj), removes values from Xi's domain that have no consistent value in Xj's domain. Propagates changes to all affected neighbors.

### MRV Heuristic

Selects the unassigned variable with the smallest remaining domain (Minimum Remaining Values). This focuses search on the most constrained variables first, leading to earlier failure detection.

### Forward Checking

After assigning a value to a variable, immediately prunes incompatible values from unassigned neighbors' domains. If any domain becomes empty, the assignment is rejected immediately (avoiding deep backtracking).

## Tests

```bash
npm test    # 22 tests
```

## References

- Russell & Norvig. "Artificial Intelligence: A Modern Approach" — Chapter 6
- Mackworth, A. (1977). "Consistency in Networks of Relations"
