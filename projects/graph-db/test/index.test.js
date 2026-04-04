import { test } from 'node:test';
import assert from 'node:assert/strict';
import GraphDB from '../src/index.js';

test('creates nodes', () => {
  const db = new GraphDB();
  const id = db.addNode(['Person'], { name: 'Alice', age: 30 });
  assert.ok(id);
  const node = db.getNode(id);
  assert.equal(node.props.name, 'Alice');
});

test('creates edges', () => {
  const db = new GraphDB();
  const a = db.addNode(['Person'], { name: 'Alice' });
  const b = db.addNode(['Person'], { name: 'Bob' });
  const e = db.addEdge(a, b, 'KNOWS', { since: 2020 });
  assert.ok(e);
});

test('finds nodes by label', () => {
  const db = new GraphDB();
  db.addNode(['Person'], { name: 'Alice' });
  db.addNode(['City'], { name: 'NYC' });
  const people = db.findNodes('Person');
  assert.equal(people.length, 1);
});

test('BFS traversal', () => {
  const db = new GraphDB();
  const a = db.addNode([], { name: 'A' });
  const b = db.addNode([], { name: 'B' });
  const c = db.addNode([], { name: 'C' });
  db.addEdge(a, b, 'LINK');
  db.addEdge(b, c, 'LINK');
  const result = db.bfs(a);
  assert.equal(result.length, 3);
});

test('shortest path', () => {
  const db = new GraphDB();
  const a = db.addNode([], { name: 'A' });
  const b = db.addNode([], { name: 'B' });
  const c = db.addNode([], { name: 'C' });
  db.addEdge(a, b, 'LINK');
  db.addEdge(b, c, 'LINK');
  db.addEdge(a, c, 'LINK');
  const path = db.shortestPath(a, c);
  assert.equal(path.length, 2); // A -> C direct
});

test('pattern matching', () => {
  const db = new GraphDB();
  const a = db.addNode(['Person'], { name: 'Alice' });
  const b = db.addNode(['Person'], { name: 'Bob' });
  db.addEdge(a, b, 'KNOWS');
  const results = db.match({ type: 'KNOWS' });
  assert.equal(results.length, 1);
});

test('query by property', () => {
  const db = new GraphDB();
  db.addNode(['Person'], { name: 'Alice', age: 25 });
  db.addNode(['Person'], { name: 'Bob', age: 35 });
  const results = db.findNodes('Person', { age: 25 });
  assert.equal(results.length, 1);
  assert.equal(results[0].props.name, 'Alice');
});

test('delete node', () => {
  const db = new GraphDB();
  const id = db.addNode(['Person'], { name: 'Alice' });
  db.deleteNode(id);
  assert.equal(db.getNode(id), undefined);
});
