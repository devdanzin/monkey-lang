// ===== A* Pathfinding =====

// ===== Grid =====

export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.walls = new Set();
    this.weights = new Map(); // "x,y" → cost multiplier
  }

  setWall(x, y) { this.walls.add(`${x},${y}`); }
  removeWall(x, y) { this.walls.delete(`${x},${y}`); }
  isWall(x, y) { return this.walls.has(`${x},${y}`); }
  setWeight(x, y, w) { this.weights.set(`${x},${y}`, w); }
  getWeight(x, y) { return this.weights.get(`${x},${y}`) ?? 1; }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  passable(x, y) {
    return this.inBounds(x, y) && !this.isWall(x, y);
  }

  // Get walkable neighbors (4-directional)
  neighbors4(x, y) {
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    return dirs
      .map(([dx, dy]) => [x + dx, y + dy])
      .filter(([nx, ny]) => this.passable(nx, ny));
  }

  // 8-directional neighbors
  neighbors8(x, y) {
    const dirs = [
      [0, -1], [1, -1], [1, 0], [1, 1],
      [0, 1], [-1, 1], [-1, 0], [-1, -1],
    ];
    return dirs
      .map(([dx, dy]) => [x + dx, y + dy])
      .filter(([nx, ny]) => this.passable(nx, ny));
  }

  // Load from string (. = open, # = wall, S = start, E = end)
  static fromString(str) {
    const lines = str.trim().split('\n').map(l => l.trim());
    const height = lines.length;
    const width = lines[0].length;
    const grid = new Grid(width, height);
    let start = null, end = null;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ch = lines[y][x];
        if (ch === '#') grid.setWall(x, y);
        if (ch === 'S') start = [x, y];
        if (ch === 'E') end = [x, y];
      }
    }
    
    return { grid, start, end };
  }

  // Render grid with path
  render(path = []) {
    const pathSet = new Set(path.map(([x, y]) => `${x},${y}`));
    let result = '';
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.isWall(x, y)) result += '#';
        else if (pathSet.has(`${x},${y}`)) result += '*';
        else result += '.';
      }
      result += '\n';
    }
    return result;
  }
}

// ===== Heuristics =====

export const heuristics = {
  manhattan: ([ax, ay], [bx, by]) => Math.abs(ax - bx) + Math.abs(ay - by),
  euclidean: ([ax, ay], [bx, by]) => Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2),
  chebyshev: ([ax, ay], [bx, by]) => Math.max(Math.abs(ax - bx), Math.abs(ay - by)),
  zero: () => 0, // Dijkstra's (no heuristic)
};

// ===== A* Algorithm =====

export function astar(grid, start, end, {
  heuristic = heuristics.manhattan,
  diagonal = false,
} = {}) {
  const key = ([x, y]) => `${x},${y}`;
  const getNeighbors = diagonal ? (x, y) => grid.neighbors8(x, y) : (x, y) => grid.neighbors4(x, y);
  
  const openSet = new Map(); // key → {pos, f, g}
  const cameFrom = new Map();
  const gScore = new Map();
  
  const startKey = key(start);
  gScore.set(startKey, 0);
  openSet.set(startKey, { pos: start, f: heuristic(start, end), g: 0 });

  let nodesExplored = 0;

  while (openSet.size > 0) {
    // Find node with lowest f score
    let bestKey = null, bestF = Infinity;
    for (const [k, node] of openSet) {
      if (node.f < bestF) { bestF = node.f; bestKey = k; }
    }
    
    const current = openSet.get(bestKey);
    openSet.delete(bestKey);
    nodesExplored++;
    
    const [cx, cy] = current.pos;
    
    // Found the goal
    if (cx === end[0] && cy === end[1]) {
      const path = [end];
      let node = key(end);
      while (cameFrom.has(node)) {
        node = cameFrom.get(node);
        path.unshift(node.split(',').map(Number));
      }
      return { path, cost: current.g, nodesExplored };
    }
    
    // Explore neighbors
    for (const [nx, ny] of getNeighbors(cx, cy)) {
      const nKey = key([nx, ny]);
      const moveCost = diagonal && nx !== cx && ny !== cy
        ? Math.SQRT2 * grid.getWeight(nx, ny)
        : grid.getWeight(nx, ny);
      const tentativeG = current.g + moveCost;
      
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        gScore.set(nKey, tentativeG);
        cameFrom.set(nKey, key(current.pos));
        const f = tentativeG + heuristic([nx, ny], end);
        openSet.set(nKey, { pos: [nx, ny], f, g: tentativeG });
      }
    }
  }
  
  return { path: null, cost: Infinity, nodesExplored };
}

// ===== BFS (unweighted shortest path) =====

export function bfs(grid, start, end, { diagonal = false } = {}) {
  const key = ([x, y]) => `${x},${y}`;
  const getNeighbors = diagonal ? (x, y) => grid.neighbors8(x, y) : (x, y) => grid.neighbors4(x, y);
  
  const visited = new Set([key(start)]);
  const queue = [{ pos: start, path: [start] }];
  
  while (queue.length > 0) {
    const { pos: [cx, cy], path } = queue.shift();
    
    if (cx === end[0] && cy === end[1]) {
      return { path, cost: path.length - 1 };
    }
    
    for (const [nx, ny] of getNeighbors(cx, cy)) {
      const nKey = key([nx, ny]);
      if (!visited.has(nKey)) {
        visited.add(nKey);
        queue.push({ pos: [nx, ny], path: [...path, [nx, ny]] });
      }
    }
  }
  
  return { path: null, cost: Infinity };
}
