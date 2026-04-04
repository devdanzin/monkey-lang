// graph.js — Classic graph algorithms

// ===== Graph representation =====
export class Graph {
  constructor(directed = false) {
    this.adj = new Map();    // node -> [{node, weight}]
    this.directed = directed;
  }

  addNode(node) { if (!this.adj.has(node)) this.adj.set(node, []); }

  addEdge(from, to, weight = 1) {
    this.addNode(from); this.addNode(to);
    this.adj.get(from).push({ node: to, weight });
    if (!this.directed) this.adj.get(to).push({ node: from, weight });
  }

  neighbors(node) { return this.adj.get(node) || []; }
  get nodes() { return [...this.adj.keys()]; }
  get nodeCount() { return this.adj.size; }
}

// ===== Dijkstra's Algorithm =====
export function dijkstra(graph, start) {
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();

  for (const node of graph.nodes) dist.set(node, Infinity);
  dist.set(start, 0);

  while (visited.size < graph.nodeCount) {
    // Find unvisited node with minimum distance
    let u = null, minDist = Infinity;
    for (const [node, d] of dist) {
      if (!visited.has(node) && d < minDist) { u = node; minDist = d; }
    }
    if (u === null) break;
    visited.add(u);

    for (const { node: v, weight } of graph.neighbors(u)) {
      const alt = dist.get(u) + weight;
      if (alt < dist.get(v)) { dist.set(v, alt); prev.set(v, u); }
    }
  }

  return { dist, prev };
}

export function shortestPath(graph, start, end) {
  const { dist, prev } = dijkstra(graph, start);
  if (dist.get(end) === Infinity) return null;
  const path = [];
  let current = end;
  while (current !== undefined) { path.unshift(current); current = prev.get(current); }
  return { path, distance: dist.get(end) };
}

// ===== A* Search =====
export function aStar(graph, start, goal, heuristic) {
  const gScore = new Map();
  const fScore = new Map();
  const prev = new Map();
  const open = new Set([start]);
  const closed = new Set();

  gScore.set(start, 0);
  fScore.set(start, heuristic(start, goal));

  while (open.size > 0) {
    // Find node in open with lowest fScore
    let current = null, minF = Infinity;
    for (const node of open) {
      const f = fScore.get(node) ?? Infinity;
      if (f < minF) { current = node; minF = f; }
    }

    if (current === goal) {
      const path = [];
      let c = goal;
      while (c !== undefined) { path.unshift(c); c = prev.get(c); }
      return { path, distance: gScore.get(goal) };
    }

    open.delete(current);
    closed.add(current);

    for (const { node: neighbor, weight } of graph.neighbors(current)) {
      if (closed.has(neighbor)) continue;
      const tentG = gScore.get(current) + weight;
      if (tentG < (gScore.get(neighbor) ?? Infinity)) {
        prev.set(neighbor, current);
        gScore.set(neighbor, tentG);
        fScore.set(neighbor, tentG + heuristic(neighbor, goal));
        open.add(neighbor);
      }
    }
  }

  return null; // no path
}

// ===== Bellman-Ford =====
export function bellmanFord(graph, start) {
  const dist = new Map();
  const prev = new Map();
  for (const node of graph.nodes) dist.set(node, Infinity);
  dist.set(start, 0);

  const edges = [];
  for (const u of graph.nodes) {
    for (const { node: v, weight } of graph.neighbors(u)) {
      edges.push({ u, v, weight });
    }
  }

  for (let i = 0; i < graph.nodeCount - 1; i++) {
    for (const { u, v, weight } of edges) {
      if (dist.get(u) + weight < dist.get(v)) {
        dist.set(v, dist.get(u) + weight);
        prev.set(v, u);
      }
    }
  }

  // Check for negative cycles
  for (const { u, v, weight } of edges) {
    if (dist.get(u) + weight < dist.get(v)) {
      throw new Error('Graph contains negative cycle');
    }
  }

  return { dist, prev };
}

// ===== Floyd-Warshall =====
export function floydWarshall(graph) {
  const nodes = graph.nodes;
  const dist = new Map();
  const next = new Map();

  for (const u of nodes) {
    dist.set(u, new Map());
    next.set(u, new Map());
    for (const v of nodes) {
      dist.get(u).set(v, u === v ? 0 : Infinity);
    }
    for (const { node: v, weight } of graph.neighbors(u)) {
      dist.get(u).set(v, weight);
      next.get(u).set(v, v);
    }
  }

  for (const k of nodes) {
    for (const i of nodes) {
      for (const j of nodes) {
        const through = dist.get(i).get(k) + dist.get(k).get(j);
        if (through < dist.get(i).get(j)) {
          dist.get(i).set(j, through);
          next.get(i).set(j, next.get(i).get(k));
        }
      }
    }
  }

  return { dist, next };
}

// ===== Topological Sort =====
export function topologicalSort(graph) {
  const visited = new Set();
  const result = [];

  function dfs(node) {
    if (visited.has(node)) return;
    visited.add(node);
    for (const { node: neighbor } of graph.neighbors(node)) dfs(neighbor);
    result.unshift(node);
  }

  for (const node of graph.nodes) dfs(node);
  return result;
}

// ===== Strongly Connected Components (Tarjan) =====
export function tarjanSCC(graph) {
  let index = 0;
  const stack = [];
  const onStack = new Set();
  const indices = new Map();
  const lowlinks = new Map();
  const sccs = [];

  function strongconnect(v) {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    for (const { node: w } of graph.neighbors(v)) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v), lowlinks.get(w)));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v), indices.get(w)));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const v of graph.nodes) {
    if (!indices.has(v)) strongconnect(v);
  }

  return sccs;
}

// ===== Minimum Spanning Tree (Kruskal) =====
export function kruskal(graph) {
  const edges = [];
  const seen = new Set();
  for (const u of graph.nodes) {
    for (const { node: v, weight } of graph.neighbors(u)) {
      const key = [u, v].sort().join('-');
      if (!seen.has(key)) { edges.push({ u, v, weight }); seen.add(key); }
    }
  }
  edges.sort((a, b) => a.weight - b.weight);

  // Union-Find
  const parent = new Map();
  const rank = new Map();
  for (const n of graph.nodes) { parent.set(n, n); rank.set(n, 0); }

  function find(x) {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
    return parent.get(x);
  }
  function union(x, y) {
    const px = find(x), py = find(y);
    if (px === py) return false;
    if (rank.get(px) < rank.get(py)) parent.set(px, py);
    else if (rank.get(px) > rank.get(py)) parent.set(py, px);
    else { parent.set(py, px); rank.set(px, rank.get(px) + 1); }
    return true;
  }

  const mst = [];
  let totalWeight = 0;
  for (const edge of edges) {
    if (union(edge.u, edge.v)) {
      mst.push(edge);
      totalWeight += edge.weight;
    }
  }

  return { edges: mst, totalWeight };
}

// ===== Prim's MST =====
export function prim(graph) {
  const start = graph.nodes[0];
  const inMST = new Set([start]);
  const mst = [];
  let totalWeight = 0;

  while (inMST.size < graph.nodeCount) {
    let minEdge = null, minWeight = Infinity;
    for (const u of inMST) {
      for (const { node: v, weight } of graph.neighbors(u)) {
        if (!inMST.has(v) && weight < minWeight) {
          minEdge = { u, v, weight };
          minWeight = weight;
        }
      }
    }
    if (!minEdge) break;
    inMST.add(minEdge.v);
    mst.push(minEdge);
    totalWeight += minEdge.weight;
  }

  return { edges: mst, totalWeight };
}

// ===== Max Flow (Ford-Fulkerson with BFS) =====
export function maxFlow(graph, source, sink) {
  // Build residual graph
  const capacity = new Map();
  for (const u of graph.nodes) {
    for (const { node: v, weight } of graph.neighbors(u)) {
      if (!capacity.has(u)) capacity.set(u, new Map());
      capacity.get(u).set(v, weight);
      if (!capacity.has(v)) capacity.set(v, new Map());
      if (!capacity.get(v).has(u)) capacity.get(v).set(u, 0);
    }
  }

  function bfs() {
    const parent = new Map();
    const visited = new Set([source]);
    const queue = [source];
    while (queue.length > 0) {
      const u = queue.shift();
      const neighbors = capacity.get(u);
      if (!neighbors) continue;
      for (const [v, cap] of neighbors) {
        if (!visited.has(v) && cap > 0) {
          visited.add(v);
          parent.set(v, u);
          if (v === sink) return parent;
          queue.push(v);
        }
      }
    }
    return null;
  }

  let flow = 0;
  let parent;
  while ((parent = bfs()) !== null) {
    // Find min capacity along path
    let pathFlow = Infinity;
    let v = sink;
    while (v !== source) {
      const u = parent.get(v);
      pathFlow = Math.min(pathFlow, capacity.get(u).get(v));
      v = u;
    }

    // Update residual capacities
    v = sink;
    while (v !== source) {
      const u = parent.get(v);
      capacity.get(u).set(v, capacity.get(u).get(v) - pathFlow);
      capacity.get(v).set(u, capacity.get(v).get(u) + pathFlow);
      v = u;
    }

    flow += pathFlow;
  }

  return flow;
}
