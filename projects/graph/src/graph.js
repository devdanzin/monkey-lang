// Graph — adjacency list with BFS, DFS, Dijkstra, topological sort, cycle detection

export class Graph {
  constructor(directed = false) {
    this.adjacency = new Map();
    this.directed = directed;
  }

  addVertex(v) { if (!this.adjacency.has(v)) this.adjacency.set(v, []); return this; }
  removeVertex(v) { this.adjacency.delete(v); for (const [, edges] of this.adjacency) { const idx = edges.findIndex(e => e.to === v); while (idx >= 0) { edges.splice(edges.findIndex(e => e.to === v), 1); } } return this; }

  addEdge(from, to, weight = 1) {
    this.addVertex(from).addVertex(to);
    this.adjacency.get(from).push({ to, weight });
    if (!this.directed) this.adjacency.get(to).push({ to: from, weight });
    return this;
  }

  removeEdge(from, to) {
    const edges = this.adjacency.get(from);
    if (edges) { const idx = edges.findIndex(e => e.to === to); if (idx >= 0) edges.splice(idx, 1); }
    if (!this.directed) { const edges2 = this.adjacency.get(to); if (edges2) { const idx = edges2.findIndex(e => e.to === from); if (idx >= 0) edges2.splice(idx, 1); } }
    return this;
  }

  hasVertex(v) { return this.adjacency.has(v); }
  hasEdge(from, to) { const edges = this.adjacency.get(from); return edges ? edges.some(e => e.to === to) : false; }
  neighbors(v) { return (this.adjacency.get(v) || []).map(e => e.to); }
  get vertices() { return [...this.adjacency.keys()]; }
  get vertexCount() { return this.adjacency.size; }
  get edgeCount() { let c = 0; for (const [, e] of this.adjacency) c += e.length; return this.directed ? c : c / 2; }

  // BFS
  bfs(start, visit) {
    const visited = new Set([start]);
    const queue = [start];
    const order = [];
    while (queue.length) {
      const v = queue.shift();
      order.push(v);
      if (visit) visit(v);
      for (const { to } of this.adjacency.get(v) || []) {
        if (!visited.has(to)) { visited.add(to); queue.push(to); }
      }
    }
    return order;
  }

  // DFS
  dfs(start, visit) {
    const visited = new Set();
    const order = [];
    const stack = [start];
    while (stack.length) {
      const v = stack.pop();
      if (visited.has(v)) continue;
      visited.add(v);
      order.push(v);
      if (visit) visit(v);
      for (const { to } of (this.adjacency.get(v) || []).slice().reverse()) {
        if (!visited.has(to)) stack.push(to);
      }
    }
    return order;
  }

  // Dijkstra (shortest path)
  dijkstra(start) {
    const dist = new Map();
    const prev = new Map();
    const visited = new Set();

    for (const v of this.adjacency.keys()) dist.set(v, Infinity);
    dist.set(start, 0);

    while (true) {
      let u = null, minDist = Infinity;
      for (const [v, d] of dist) {
        if (!visited.has(v) && d < minDist) { u = v; minDist = d; }
      }
      if (u === null) break;
      visited.add(u);

      for (const { to, weight } of this.adjacency.get(u) || []) {
        const alt = dist.get(u) + weight;
        if (alt < dist.get(to)) { dist.set(to, alt); prev.set(to, u); }
      }
    }

    return { dist, prev, pathTo: (target) => {
      const path = [];
      let cur = target;
      while (cur !== undefined) { path.unshift(cur); cur = prev.get(cur); }
      return path[0] === start ? path : [];
    }};
  }

  // Topological sort (directed only)
  topologicalSort() {
    if (!this.directed) throw new Error('Topological sort requires directed graph');
    const visited = new Set();
    const stack = [];

    const dfs = (v) => {
      visited.add(v);
      for (const { to } of this.adjacency.get(v) || []) {
        if (!visited.has(to)) dfs(to);
      }
      stack.push(v);
    };

    for (const v of this.adjacency.keys()) {
      if (!visited.has(v)) dfs(v);
    }

    return stack.reverse();
  }

  // Detect cycle
  hasCycle() {
    if (this.directed) {
      const white = new Set(this.adjacency.keys());
      const gray = new Set();
      const dfs = (v) => {
        white.delete(v); gray.add(v);
        for (const { to } of this.adjacency.get(v) || []) {
          if (gray.has(to)) return true;
          if (white.has(to) && dfs(to)) return true;
        }
        gray.delete(v);
        return false;
      };
      for (const v of [...white]) { if (dfs(v)) return true; }
      return false;
    } else {
      const visited = new Set();
      const dfs = (v, parent) => {
        visited.add(v);
        for (const { to } of this.adjacency.get(v) || []) {
          if (!visited.has(to)) { if (dfs(to, v)) return true; }
          else if (to !== parent) return true;
        }
        return false;
      };
      for (const v of this.adjacency.keys()) {
        if (!visited.has(v) && dfs(v, null)) return true;
      }
      return false;
    }
  }

  // Connected components (undirected)
  connectedComponents() {
    const visited = new Set();
    const components = [];
    for (const v of this.adjacency.keys()) {
      if (!visited.has(v)) {
        const component = this.bfs(v);
        component.forEach(n => visited.add(n));
        components.push(component);
      }
    }
    return components;
  }
}
