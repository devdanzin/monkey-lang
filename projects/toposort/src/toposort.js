// Topological Sort — Kahn's + DFS

export function topoSort(edges) {
  const adj = new Map();
  const inDeg = new Map();
  const nodes = new Set();

  for (const [from, to] of edges) {
    nodes.add(from); nodes.add(to);
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push(to);
    inDeg.set(to, (inDeg.get(to) || 0) + 1);
    if (!inDeg.has(from)) inDeg.set(from, 0);
  }

  // Kahn's algorithm
  const queue = [];
  for (const n of nodes) { if (!inDeg.has(n) || inDeg.get(n) === 0) queue.push(n); }
  queue.sort(); // deterministic

  const result = [];
  while (queue.length > 0) {
    const node = queue.shift();
    result.push(node);
    for (const next of (adj.get(node) || [])) {
      inDeg.set(next, inDeg.get(next) - 1);
      if (inDeg.get(next) === 0) queue.push(next);
    }
    queue.sort(); // keep deterministic
  }

  if (result.length !== nodes.size) throw new Error('Cycle detected');
  return result;
}

// DFS-based topological sort
export function topoSortDFS(edges) {
  const adj = new Map();
  const nodes = new Set();
  for (const [from, to] of edges) {
    nodes.add(from); nodes.add(to);
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push(to);
  }

  const visited = new Set();
  const temp = new Set();
  const result = [];

  function visit(node) {
    if (temp.has(node)) throw new Error('Cycle detected');
    if (visited.has(node)) return;
    temp.add(node);
    for (const next of (adj.get(node) || [])) visit(next);
    temp.delete(node);
    visited.add(node);
    result.unshift(node);
  }

  for (const n of [...nodes].sort()) visit(n);
  return result;
}

// Find all valid orderings (for small graphs)
export function allTopoOrders(edges) {
  const adj = new Map();
  const inDeg = new Map();
  const nodes = new Set();
  for (const [from, to] of edges) {
    nodes.add(from); nodes.add(to);
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push(to);
    inDeg.set(to, (inDeg.get(to) || 0) + 1);
    if (!inDeg.has(from)) inDeg.set(from, 0);
  }

  const results = [];
  const current = [];
  const visited = new Set();

  function backtrack() {
    let found = false;
    for (const n of nodes) {
      if (!visited.has(n) && (!inDeg.has(n) || inDeg.get(n) === 0)) {
        found = true;
        visited.add(n);
        current.push(n);
        for (const next of (adj.get(n) || [])) inDeg.set(next, inDeg.get(next) - 1);
        backtrack();
        for (const next of (adj.get(n) || [])) inDeg.set(next, inDeg.get(next) + 1);
        current.pop();
        visited.delete(n);
      }
    }
    if (!found && current.length === nodes.size) results.push([...current]);
  }

  backtrack();
  return results;
}

// Detect cycle
export function hasCycle(edges) {
  try { topoSort(edges); return false; } catch { return true; }
}
