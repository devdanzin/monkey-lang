import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../src/index.js';

describe('Basic operations', () => {
  it('add vertices and edges', () => {
    const g = new Graph();
    g.addEdge('A', 'B').addEdge('B', 'C');
    assert.equal(g.vertexCount, 3);
    assert.equal(g.edgeCount, 2);
    assert.equal(g.hasVertex('A'), true);
    assert.equal(g.hasEdge('A', 'B'), true);
    assert.equal(g.hasEdge('B', 'A'), true); // Undirected
  });

  it('directed graph', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B');
    assert.equal(g.hasEdge('A', 'B'), true);
    assert.equal(g.hasEdge('B', 'A'), false);
  });

  it('neighbors', () => {
    const g = new Graph();
    g.addEdge('A', 'B').addEdge('A', 'C');
    assert.deepEqual(g.neighbors('A').sort(), ['B', 'C']);
  });

  it('removeEdge', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.removeEdge('A', 'B');
    assert.equal(g.hasEdge('A', 'B'), false);
  });
});

describe('BFS', () => {
  it('traverses breadth-first', () => {
    const g = new Graph();
    g.addEdge('A', 'B').addEdge('A', 'C').addEdge('B', 'D').addEdge('C', 'D');
    const order = g.bfs('A');
    assert.equal(order[0], 'A');
    assert.equal(order.length, 4);
    // B and C should come before D
    assert.ok(order.indexOf('B') < order.indexOf('D'));
    assert.ok(order.indexOf('C') < order.indexOf('D'));
  });
});

describe('DFS', () => {
  it('traverses depth-first', () => {
    const g = new Graph();
    g.addEdge('A', 'B').addEdge('A', 'C').addEdge('B', 'D');
    const order = g.dfs('A');
    assert.equal(order[0], 'A');
    assert.equal(order.length, 4);
  });
});

describe('Dijkstra', () => {
  it('finds shortest path', () => {
    const g = new Graph();
    g.addEdge('A', 'B', 1).addEdge('A', 'C', 4).addEdge('B', 'C', 2).addEdge('B', 'D', 5).addEdge('C', 'D', 1);
    const { dist, pathTo } = g.dijkstra('A');
    assert.equal(dist.get('A'), 0);
    assert.equal(dist.get('B'), 1);
    assert.equal(dist.get('C'), 3); // A→B→C
    assert.equal(dist.get('D'), 4); // A→B→C→D
    assert.deepEqual(pathTo('D'), ['A', 'B', 'C', 'D']);
  });

  it('unreachable returns Infinity', () => {
    const g = new Graph();
    g.addVertex('A').addVertex('B');
    const { dist } = g.dijkstra('A');
    assert.equal(dist.get('B'), Infinity);
  });
});

describe('Topological sort', () => {
  it('sorts DAG', () => {
    const g = new Graph(true);
    g.addEdge('A', 'C').addEdge('B', 'C').addEdge('C', 'D');
    const sorted = g.topologicalSort();
    assert.ok(sorted.indexOf('A') < sorted.indexOf('C'));
    assert.ok(sorted.indexOf('B') < sorted.indexOf('C'));
    assert.ok(sorted.indexOf('C') < sorted.indexOf('D'));
  });

  it('throws for undirected', () => {
    const g = new Graph(false);
    assert.throws(() => g.topologicalSort());
  });
});

describe('Cycle detection', () => {
  it('detects cycle in directed graph', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B').addEdge('B', 'C').addEdge('C', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('no cycle in DAG', () => {
    const g = new Graph(true);
    g.addEdge('A', 'B').addEdge('B', 'C');
    assert.equal(g.hasCycle(), false);
  });

  it('detects cycle in undirected graph', () => {
    const g = new Graph(false);
    g.addEdge('A', 'B').addEdge('B', 'C').addEdge('C', 'A');
    assert.equal(g.hasCycle(), true);
  });

  it('no cycle in tree', () => {
    const g = new Graph(false);
    g.addEdge('A', 'B').addEdge('A', 'C');
    assert.equal(g.hasCycle(), false);
  });
});

describe('Connected components', () => {
  it('finds components', () => {
    const g = new Graph();
    g.addEdge('A', 'B').addEdge('C', 'D');
    const components = g.connectedComponents();
    assert.equal(components.length, 2);
  });
});
