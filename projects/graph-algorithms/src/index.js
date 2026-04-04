// ===== Graph Algorithms =====

// ===== Graph representation =====

export class Graph {
  constructor(directed = false) {
    this.adj = new Map();    // node → [{to, weight}]
    this.directed = directed;
  }

  addNode(node) {
    if (!this.adj.has(node)) this.adj.set(node, []);
  }

  addEdge(from, to, weight = 1) {
    this.addNode(from);
    this.addNode(to);
    this.adj.get(from).push({ to, weight });
    if (!this.directed) {
      this.adj.get(to).push({ to: from, weight });
    }
  }

  neighbors(node) {
    return this.adj.get(node) || [];
  }

  get nodes() { return [...this.adj.keys()]; }
  get nodeCount() { return this.adj.size; }

  get edges() {
    const result = [];
    const seen = new Set();
    for (const [from, neighbors] of this.adj) {
      for (const { to, weight } of neighbors) {
        const key = this.directed ? `${from}->${to}` : [from, to].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ from, to, weight });
        }
      }
    }
    return result;
  }
}

// ===== BFS =====

export function bfs(graph, start) {
  const visited = new Set([start]);
  const queue = [start];
  const order = [];
  const parent = new Map();
  
  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);
    
    for (const { to } of graph.neighbors(node)) {
      if (!visited.has(to)) {
        visited.add(to);
        parent.set(to, node);
        queue.push(to);
      }
    }
  }
  
  return { order, parent };
}

// ===== DFS =====

export function dfs(graph, start) {
  const visited = new Set();
  const order = [];
  const parent = new Map();
  
  function visit(node) {
    visited.add(node);
    order.push(node);
    for (const { to } of graph.neighbors(node)) {
      if (!visited.has(to)) {
        parent.set(to, node);
        visit(to);
      }
    }
  }
  
  visit(start);
  return { order, parent };
}

// ===== Dijkstra's Shortest Path =====

export function dijkstra(graph, start) {
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  
  for (const node of graph.nodes) dist.set(node, Infinity);
  dist.set(start, 0);
  
  // Simple priority queue using array (fine for small graphs)
  const pq = [[0, start]];
  
  while (pq.length > 0) {
    // Find minimum
    let minIdx = 0;
    for (let i = 1; i < pq.length; i++) {
      if (pq[i][0] < pq[minIdx][0]) minIdx = i;
    }
    const [d, u] = pq.splice(minIdx, 1)[0];
    
    if (visited.has(u)) continue;
    visited.add(u);
    
    for (const { to, weight } of graph.neighbors(u)) {
      const alt = d + weight;
      if (alt < dist.get(to)) {
        dist.set(to, alt);
        prev.set(to, u);
        pq.push([alt, to]);
      }
    }
  }
  
  return { dist, prev };
}

// Reconstruct shortest path from Dijkstra result
export function shortestPath(prev, start, end) {
  const path = [];
  let current = end;
  while (current !== start) {
    path.unshift(current);
    current = prev.get(current);
    if (current === undefined) return null; // no path
  }
  path.unshift(start);
  return path;
}

// ===== Bellman-Ford =====

export function bellmanFord(graph, start) {
  const dist = new Map();
  const prev = new Map();
  
  for (const node of graph.nodes) dist.set(node, Infinity);
  dist.set(start, 0);
  
  const n = graph.nodeCount;
  const allEdges = [];
  for (const [from, neighbors] of graph.adj) {
    for (const { to, weight } of neighbors) {
      allEdges.push({ from, to, weight });
    }
  }
  
  // Relax n-1 times
  for (let i = 0; i < n - 1; i++) {
    let updated = false;
    for (const { from, to, weight } of allEdges) {
      if (dist.get(from) !== Infinity && dist.get(from) + weight < dist.get(to)) {
        dist.set(to, dist.get(from) + weight);
        prev.set(to, from);
        updated = true;
      }
    }
    if (!updated) break;
  }
  
  // Check for negative cycles
  let hasNegativeCycle = false;
  for (const { from, to, weight } of allEdges) {
    if (dist.get(from) !== Infinity && dist.get(from) + weight < dist.get(to)) {
      hasNegativeCycle = true;
      break;
    }
  }
  
  return { dist, prev, hasNegativeCycle };
}

// ===== Kruskal's MST =====

class UnionFind {
  constructor() { this.parent = new Map(); this.rank = new Map(); }
  find(x) {
    if (!this.parent.has(x)) { this.parent.set(x, x); this.rank.set(x, 0); }
    if (this.parent.get(x) !== x) this.parent.set(x, this.find(this.parent.get(x)));
    return this.parent.get(x);
  }
  union(x, y) {
    const rx = this.find(x), ry = this.find(y);
    if (rx === ry) return false;
    if (this.rank.get(rx) < this.rank.get(ry)) this.parent.set(rx, ry);
    else if (this.rank.get(rx) > this.rank.get(ry)) this.parent.set(ry, rx);
    else { this.parent.set(ry, rx); this.rank.set(rx, this.rank.get(rx) + 1); }
    return true;
  }
}

export function kruskal(graph) {
  const edges = graph.edges.sort((a, b) => a.weight - b.weight);
  const uf = new UnionFind();
  const mst = [];
  let totalWeight = 0;
  
  for (const edge of edges) {
    if (uf.union(edge.from, edge.to)) {
      mst.push(edge);
      totalWeight += edge.weight;
    }
  }
  
  return { edges: mst, totalWeight };
}

// ===== Topological Sort (Kahn's algorithm) =====

export function topologicalSort(graph) {
  if (!graph.directed) throw new Error('Topological sort requires directed graph');
  
  const inDegree = new Map();
  for (const node of graph.nodes) inDegree.set(node, 0);
  for (const [, neighbors] of graph.adj) {
    for (const { to } of neighbors) {
      inDegree.set(to, (inDegree.get(to) || 0) + 1);
    }
  }
  
  const queue = [];
  for (const [node, deg] of inDegree) {
    if (deg === 0) queue.push(node);
  }
  
  const order = [];
  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);
    
    for (const { to } of graph.neighbors(node)) {
      inDegree.set(to, inDegree.get(to) - 1);
      if (inDegree.get(to) === 0) queue.push(to);
    }
  }
  
  if (order.length !== graph.nodeCount) return null; // cycle detected
  return order;
}

// ===== Tarjan's SCC (Strongly Connected Components) =====

export function tarjanSCC(graph) {
  if (!graph.directed) throw new Error('SCC requires directed graph');
  
  let index = 0;
  const nodeIndex = new Map();
  const lowlink = new Map();
  const onStack = new Set();
  const stack = [];
  const components = [];
  
  function strongConnect(v) {
    nodeIndex.set(v, index);
    lowlink.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    
    for (const { to: w } of graph.neighbors(v)) {
      if (!nodeIndex.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v), nodeIndex.get(w)));
      }
    }
    
    // Root of SCC
    if (lowlink.get(v) === nodeIndex.get(v)) {
      const component = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      components.push(component);
    }
  }
  
  for (const node of graph.nodes) {
    if (!nodeIndex.has(node)) strongConnect(node);
  }
  
  return components;
}

// ===== Cycle Detection =====

export function hasCycle(graph) {
  if (graph.directed) {
    return topologicalSort(graph) === null;
  }
  
  // Undirected: DFS with parent tracking
  const visited = new Set();
  
  function dfs(node, parent) {
    visited.add(node);
    for (const { to } of graph.neighbors(node)) {
      if (!visited.has(to)) {
        if (dfs(to, node)) return true;
      } else if (to !== parent) {
        return true;
      }
    }
    return false;
  }
  
  for (const node of graph.nodes) {
    if (!visited.has(node)) {
      if (dfs(node, null)) return true;
    }
  }
  return false;
}
