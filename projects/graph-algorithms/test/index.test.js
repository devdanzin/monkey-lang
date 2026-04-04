import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Graph, bfs, dfs, dijkstra, shortestPath, bellmanFord, kruskal, topologicalSort, tarjanSCC, hasCycle } from '../src/index.js';

function simpleGraph() {
  const g = new Graph();
  g.addEdge('A', 'B', 4);
  g.addEdge('A', 'C', 2);
  g.addEdge('B', 'D', 3);
  g.addEdge('C', 'B', 1);
  g.addEdge('C', 'D', 5);
  return g;
}

describe('Graph — basic', () => {
  it('creates empty graph', () => { const g = new Graph(); assert.equal(g.nodeCount, 0); });
  it('adds nodes', () => { const g = new Graph(); g.addNode('A'); assert.equal(g.nodeCount, 1); });
  it('adds edges', () => { const g = simpleGraph(); assert.ok(g.nodeCount >= 4); });
  it('lists edges', () => { const g = simpleGraph(); assert.ok(g.edges.length > 0); });
});

describe('BFS', () => {
  it('visits all reachable nodes', () => {
    const { order } = bfs(simpleGraph(), 'A');
    assert.ok(order.includes('A'));
    assert.ok(order.includes('D'));
    assert.equal(order[0], 'A');
  });

  it('finds shortest path in unweighted graph', () => {
    const g = new Graph();
    g.addEdge(1, 2); g.addEdge(2, 3); g.addEdge(1, 3);
    const { parent } = bfs(g, 1);
    // Direct path 1→3 should exist
    assert.equal(parent.get(3), 1);
  });
});

describe('DFS', () => {
  it('visits all reachable nodes', () => {
    const { order } = dfs(simpleGraph(), 'A');
    assert.ok(order.includes('A'));
    assert.ok(order.includes('D'));
  });
});

describe('Dijkstra', () => {
  it('finds shortest paths', () => {
    const g = simpleGraph();
    const { dist } = dijkstra(g, 'A');
    assert.equal(dist.get('A'), 0);
    assert.equal(dist.get('C'), 2);
    assert.equal(dist.get('B'), 3); // A→C→B = 2+1 = 3
    assert.equal(dist.get('D'), 6); // A→C→B→D = 2+1+3 = 6
  });

  it('reconstructs path', () => {
    const { prev } = dijkstra(simpleGraph(), 'A');
    const path = shortestPath(prev, 'A', 'D');
    assert.equal(path[0], 'A');
    assert.equal(path[path.length - 1], 'D');
  });

  it('returns Infinity for unreachable', () => {
    const g = new Graph();
    g.addNode('A'); g.addNode('B');
    const { dist } = dijkstra(g, 'A');
    assert.equal(dist.get('B'), Infinity);
  });

  it('handles single node', () => {
    const g = new Graph();
    g.addNode('A');
    const { dist } = dijkstra(g, 'A');
    assert.equal(dist.get('A'), 0);
  });
});

describe('Bellman-Ford', () => {
  it('finds shortest paths', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B', 4);
    g.addEdge('A', 'C', 2);
    g.addEdge('C', 'B', 1);
    g.addEdge('B', 'D', 3);
    const { dist } = bellmanFord(g, 'A');
    assert.equal(dist.get('B'), 3);
    assert.equal(dist.get('D'), 6);
  });

  it('handles negative weights', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', -2);
    g.addEdge('A', 'C', 2);
    const { dist } = bellmanFord(g, 'A');
    assert.equal(dist.get('C'), -1); // A→B→C = 1+(-2) = -1
  });

  it('detects negative cycle', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', -3);
    g.addEdge('C', 'A', 1);
    const { hasNegativeCycle } = bellmanFord(g, 'A');
    assert.equal(hasNegativeCycle, true);
  });
});

describe('Kruskal MST', () => {
  it('finds minimum spanning tree', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 4);
    g.addEdge('A', 'C', 2);
    g.addEdge('B', 'C', 1);
    g.addEdge('B', 'D', 5);
    g.addEdge('C', 'D', 3);
    
    const { edges, totalWeight } = kruskal(g);
    assert.equal(edges.length, 3); // n-1 edges for 4 nodes
    assert.equal(totalWeight, 6); // 1+2+3
  });

  it('MST of single node', () => {
    const g = new Graph();
    g.addNode('A');
    const { edges, totalWeight } = kruskal(g);
    assert.equal(edges.length, 0);
    assert.equal(totalWeight, 0);
  });
});

describe('Topological Sort', () => {
  it('sorts DAG', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    g.addEdge('C', 'D');
    
    const order = topologicalSort(g);
    assert.ok(order);
    assert.equal(order.indexOf('A') < order.indexOf('B'), true);
    assert.equal(order.indexOf('A') < order.indexOf('C'), true);
    assert.equal(order.indexOf('B') < order.indexOf('D'), true);
  });

  it('detects cycle in directed graph', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    
    assert.equal(topologicalSort(g), null);
  });

  it('course scheduling', () => {
    const g = new Graph(true);
    g.addEdge('CS101', 'CS201');
    g.addEdge('CS101', 'CS202');
    g.addEdge('CS201', 'CS301');
    g.addEdge('CS202', 'CS301');
    g.addEdge('MATH101', 'CS201');
    
    const order = topologicalSort(g);
    assert.ok(order);
    assert.ok(order.indexOf('CS101') < order.indexOf('CS301'));
    assert.ok(order.indexOf('MATH101') < order.indexOf('CS201'));
  });
});

describe('Tarjan SCC', () => {
  it('finds SCCs in simple graph', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A'); // cycle A→B→C→A
    g.addEdge('C', 'D');
    
    const sccs = tarjanSCC(g);
    // Should have 2 SCCs: {A,B,C} and {D}
    assert.equal(sccs.length, 2);
    const big = sccs.find(c => c.length === 3);
    assert.ok(big);
    assert.ok(big.includes('A'));
    assert.ok(big.includes('B'));
    assert.ok(big.includes('C'));
  });

  it('DAG has all singleton SCCs', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    
    const sccs = tarjanSCC(g);
    assert.equal(sccs.length, 3);
    for (const scc of sccs) assert.equal(scc.length, 1);
  });
});

describe('Cycle Detection', () => {
  it('detects cycle in undirected graph', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    assert.equal(hasCycle(g), true);
  });

  it('no cycle in tree', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    assert.equal(hasCycle(g), false);
  });

  it('detects cycle in directed graph', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'A');
    assert.equal(hasCycle(g), true);
  });

  it('no cycle in DAG', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    assert.equal(hasCycle(g), false);
  });
});
