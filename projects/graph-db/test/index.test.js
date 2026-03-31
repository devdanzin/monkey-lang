const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GraphDB } = require('../src/index.js');

test('add nodes and edges', () => {
  const db = new GraphDB();
  const alice = db.addNode('Person', { name: 'Alice', age: 30 });
  const bob = db.addNode('Person', { name: 'Bob', age: 25 });
  db.addEdge(alice, bob, 'KNOWS');
  assert.equal(db.nodeCount, 2);
  assert.equal(db.edgeCount, 1);
});

test('find nodes', () => {
  const db = new GraphDB();
  db.addNode('Person', { name: 'Alice' });
  db.addNode('Person', { name: 'Bob' });
  db.addNode('City', { name: 'Denver' });
  
  const people = db.findNodes('Person');
  assert.equal(people.length, 2);
  
  const alice = db.findNodes('Person', { name: 'Alice' });
  assert.equal(alice.length, 1);
});

test('neighbors', () => {
  const db = new GraphDB();
  const a = db.addNode('Person', { name: 'A' });
  const b = db.addNode('Person', { name: 'B' });
  const c = db.addNode('Person', { name: 'C' });
  db.addEdge(a, b, 'KNOWS');
  db.addEdge(a, c, 'LIKES');
  
  const all = db.neighbors(a, 'out');
  assert.equal(all.length, 2);
  
  const knows = db.neighbors(a, 'out', 'KNOWS');
  assert.equal(knows.length, 1);
  assert.equal(knows[0].node.props.name, 'B');
});

test('delete node', () => {
  const db = new GraphDB();
  const a = db.addNode('X');
  const b = db.addNode('Y');
  db.addEdge(a, b, 'R');
  db.deleteNode(a);
  assert.equal(db.nodeCount, 1);
  assert.equal(db.edgeCount, 0);
});

test('BFS traversal', () => {
  const db = new GraphDB();
  const a = db.addNode('N', { name: 'A' });
  const b = db.addNode('N', { name: 'B' });
  const c = db.addNode('N', { name: 'C' });
  const d = db.addNode('N', { name: 'D' });
  db.addEdge(a, b, 'E');
  db.addEdge(b, c, 'E');
  db.addEdge(c, d, 'E');
  
  const result = db.bfs(a);
  assert.equal(result.length, 4);
  assert.equal(result[0].depth, 0);
});

test('BFS max depth', () => {
  const db = new GraphDB();
  const a = db.addNode('N');
  const b = db.addNode('N');
  const c = db.addNode('N');
  db.addEdge(a, b, 'E');
  db.addEdge(b, c, 'E');
  
  const result = db.bfs(a, { maxDepth: 1 });
  assert.equal(result.length, 2);
});

test('shortest path', () => {
  const db = new GraphDB();
  const a = db.addNode('N', { name: 'A' });
  const b = db.addNode('N', { name: 'B' });
  const c = db.addNode('N', { name: 'C' });
  const d = db.addNode('N', { name: 'D' });
  db.addEdge(a, b, 'E');
  db.addEdge(b, d, 'E');
  db.addEdge(a, c, 'E');
  db.addEdge(c, d, 'E');
  
  const path = db.shortestPath(a, d);
  assert.equal(path.length, 3); // A -> B -> D or A -> C -> D
});

test('pattern match', () => {
  const db = new GraphDB();
  const alice = db.addNode('Person', { name: 'Alice' });
  const bob = db.addNode('Person', { name: 'Bob' });
  const denver = db.addNode('City', { name: 'Denver' });
  db.addEdge(alice, bob, 'KNOWS');
  db.addEdge(alice, denver, 'LIVES_IN');
  
  const results = db.match({
    from: { label: 'Person' },
    edge: 'LIVES_IN',
    to: { label: 'City' },
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].from.props.name, 'Alice');
  assert.equal(results[0].to.props.name, 'Denver');
});
