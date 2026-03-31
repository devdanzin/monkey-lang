// A* Search — generic graph search with heuristic

export function astar({ start, goal, neighbors, heuristic, cost = () => 1, hash = String }) {
  const open = new Map(); // hash → { node, g, f, parent }
  const closed = new Set();

  const startH = hash(start);
  const h = heuristic(start);
  open.set(startH, { node: start, g: 0, f: h, parent: null });

  while (open.size > 0) {
    // Find lowest f in open set
    let bestKey = null, bestF = Infinity;
    for (const [key, entry] of open) {
      if (entry.f < bestF) { bestF = entry.f; bestKey = key; }
    }

    const current = open.get(bestKey);
    open.delete(bestKey);

    if (goal(current.node)) {
      // Reconstruct path
      const path = [];
      let entry = current;
      while (entry) { path.unshift(entry.node); entry = entry.parent; }
      return { path, cost: current.g, explored: closed.size };
    }

    closed.add(bestKey);

    for (const neighbor of neighbors(current.node)) {
      const nh = hash(neighbor);
      if (closed.has(nh)) continue;

      const g = current.g + cost(current.node, neighbor);
      const existing = open.get(nh);

      if (!existing || g < existing.g) {
        open.set(nh, { node: neighbor, g, f: g + heuristic(neighbor), parent: current });
      }
    }
  }

  return { path: null, cost: Infinity, explored: closed.size };
}

// Grid helpers
export function gridSearch(grid, startPos, goalPos) {
  const [rows, cols] = [grid.length, grid[0].length];
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];

  return astar({
    start: startPos,
    goal: ([r, c]) => r === goalPos[0] && c === goalPos[1],
    neighbors: ([r, c]) => {
      const n = [];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc] !== 1) n.push([nr, nc]);
      }
      return n;
    },
    heuristic: ([r, c]) => Math.abs(r - goalPos[0]) + Math.abs(c - goalPos[1]),
    hash: ([r, c]) => `${r},${c}`,
  });
}
