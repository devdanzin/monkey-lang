import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Graph, dijkstra, shortestPath, aStar, bellmanFord, floydWarshall, topologicalSort, tarjanSCC, kruskal, prim, maxFlow } from './graph.js';

function makeTestGraph() {
  const g = new Graph();
  g.addEdge('A', 'B', 4);
  g.addEdge('A', 'C', 2);
  g.addEdge('B', 'D', 3);
  g.addEdge('C', 'B', 1);
  g.addEdge('C', 'D', 5);
  g.addEdge('D', 'E', 1);
  return g;
}

describe('Dijkstra', () => {
  it('finds shortest distances', () => {
    const g = makeTestGraph();
    const { dist } = dijkstra(g, 'A');
    assert.equal(dist.get('A'), 0);
    assert.equal(dist.get('B'), 3); // A→C→B
    assert.equal(dist.get('D'), 6); // A→C→B→D
    assert.equal(dist.get('E'), 7);
  });

  it('finds shortest path', () => {
    const g = makeTestGraph();
    const result = shortestPath(g, 'A', 'E');
    assert.ok(result);
    assert.equal(result.distance, 7);
    assert.equal(result.path[0], 'A');
    assert.equal(result.path[result.path.length - 1], 'E');
  });

  it('returns null for unreachable', () => {
    const g = new Graph();
    g.addNode('A');
    g.addNode('B');
    assert.equal(shortestPath(g, 'A', 'B'), null);
  });
});

describe('A* Search', () => {
  it('finds path with heuristic', () => {
    const g = makeTestGraph();
    const h = () => 0; // trivial heuristic (degrades to Dijkstra)
    const result = aStar(g, 'A', 'E', h);
    assert.ok(result);
    assert.equal(result.distance, 7);
  });

  it('returns null when no path', () => {
    const g = new Graph();
    g.addNode('A');
    g.addNode('B');
    assert.equal(aStar(g, 'A', 'B', () => 0), null);
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
    g.addEdge('A', 'C', 4);
    const { dist } = bellmanFord(g, 'A');
    assert.equal(dist.get('C'), -1); // A→B→C = 1+(-2) = -1
  });

  it('detects negative cycles', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B', 1);
    g.addEdge('B', 'C', -3);
    g.addEdge('C', 'A', 1);
    assert.throws(() => bellmanFord(g, 'A'));
  });
});

describe('Floyd-Warshall', () => {
  it('all-pairs shortest paths', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 3);
    g.addEdge('B', 'C', 2);
    g.addEdge('A', 'C', 6);
    const { dist } = floydWarshall(g);
    assert.equal(dist.get('A').get('C'), 5); // A→B→C
    assert.equal(dist.get('B').get('A'), 3);
    assert.equal(dist.get('A').get('A'), 0);
  });
});

describe('Topological Sort', () => {
  it('sorts DAG', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('A', 'C');
    const order = topologicalSort(g);
    assert.ok(order.indexOf('A') < order.indexOf('B'));
    assert.ok(order.indexOf('B') < order.indexOf('C'));
  });
});

describe('Tarjan SCC', () => {
  it('finds strongly connected components', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A'); // cycle: A→B→C→A
    g.addEdge('C', 'D');
    const sccs = tarjanSCC(g);
    // One SCC with {A,B,C} and one with {D}
    assert.ok(sccs.some(s => s.length === 3));
    assert.ok(sccs.some(s => s.length === 1));
  });

  it('all singletons in DAG', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    const sccs = tarjanSCC(g);
    assert.ok(sccs.every(s => s.length === 1));
  });
});

describe('Kruskal MST', () => {
  it('finds minimum spanning tree', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 4);
    g.addEdge('A', 'C', 2);
    g.addEdge('B', 'C', 1);
    g.addEdge('B', 'D', 5);
    g.addEdge('C', 'D', 8);
    const { edges, totalWeight } = kruskal(g);
    assert.equal(edges.length, 3); // n-1 edges
    assert.equal(totalWeight, 8); // 1+2+5
  });
});

describe('Prim MST', () => {
  it('finds minimum spanning tree', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 4);
    g.addEdge('A', 'C', 2);
    g.addEdge('B', 'C', 1);
    g.addEdge('B', 'D', 5);
    g.addEdge('C', 'D', 8);
    const { edges, totalWeight } = prim(g);
    assert.equal(edges.length, 3);
    assert.equal(totalWeight, 8);
  });

  it('agrees with Kruskal', () => {
    const g = new Graph();
    g.addEdge(1, 2, 10);
    g.addEdge(1, 3, 6);
    g.addEdge(1, 4, 5);
    g.addEdge(2, 4, 15);
    g.addEdge(3, 4, 4);
    assert.equal(kruskal(g).totalWeight, prim(g).totalWeight);
  });
});

describe('Max Flow', () => {
  it('finds maximum flow', () => {
    const g = new Graph(true);
    g.addEdge('s', 'a', 10);
    g.addEdge('s', 'b', 5);
    g.addEdge('a', 'b', 15);
    g.addEdge('a', 't', 10);
    g.addEdge('b', 't', 10);
    const flow = maxFlow(g, 's', 't');
    assert.equal(flow, 15);
  });

  it('simple two-path flow', () => {
    const g = new Graph(true);
    g.addEdge('s', 'a', 3);
    g.addEdge('s', 'b', 2);
    g.addEdge('a', 't', 3);
    g.addEdge('b', 't', 2);
    assert.equal(maxFlow(g, 's', 't'), 5);
  });

  it('bottleneck flow', () => {
    const g = new Graph(true);
    g.addEdge('s', 'a', 100);
    g.addEdge('a', 'b', 1);
    g.addEdge('b', 't', 100);
    assert.equal(maxFlow(g, 's', 't'), 1);
  });
});
