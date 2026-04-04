const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { GraphDB } = require('./index.js');

describe('DFS', () => {
  it('traverses', () => {
    const db = new GraphDB();
    const a = db.addNode(['V'], { name: 'A' });
    const b = db.addNode(['V'], { name: 'B' });
    const c = db.addNode(['V'], { name: 'C' });
    db.addEdge(a, b, 'LINK'); db.addEdge(b, c, 'LINK'); db.addEdge(a, c, 'LINK');
    assert.equal(db.dfs(a).length, 3);
  });
  it('maxDepth', () => {
    const db = new GraphDB();
    const a = db.addNode([], { n: 'A' }); const b = db.addNode([], { n: 'B' }); const c = db.addNode([], { n: 'C' });
    db.addEdge(a, b, 'L'); db.addEdge(b, c, 'L');
    assert.equal(db.dfs(a, { maxDepth: 1 }).length, 2);
  });
});
describe('All Paths', () => {
  it('finds multiple paths', () => {
    const db = new GraphDB();
    const a = db.addNode([], {}); const b = db.addNode([], {}); const c = db.addNode([], {});
    db.addEdge(a, b, 'L'); db.addEdge(b, c, 'L'); db.addEdge(a, c, 'L');
    assert.equal(db.allPaths(a, c).length, 2);
  });
});
describe('Aggregations', () => {
  it('count', () => {
    const db = new GraphDB();
    db.addNode(['P'], { age: 25 }); db.addNode(['P'], { age: 30 });
    assert.equal(db.aggregate('P', 'age', 'count'), 2);
  });
  it('sum', () => {
    const db = new GraphDB();
    db.addNode(['P'], { age: 25 }); db.addNode(['P'], { age: 30 });
    assert.equal(db.aggregate('P', 'age', 'sum'), 55);
  });
  it('avg', () => {
    const db = new GraphDB();
    db.addNode(['P'], { age: 20 }); db.addNode(['P'], { age: 40 });
    assert.equal(db.aggregate('P', 'age', 'avg'), 30);
  });
  it('min/max', () => {
    const db = new GraphDB();
    db.addNode(['P'], { age: 20 }); db.addNode(['P'], { age: 30 }); db.addNode(['P'], { age: 25 });
    assert.equal(db.aggregate('P', 'age', 'min'), 20);
    assert.equal(db.aggregate('P', 'age', 'max'), 30);
  });
});
describe('Degree', () => {
  it('calculates', () => {
    const db = new GraphDB();
    const a = db.addNode([], {}); const b = db.addNode([], {}); const c = db.addNode([], {});
    db.addEdge(a, b, 'L'); db.addEdge(a, c, 'L'); db.addEdge(b, a, 'L');
    const d = db.degree(a); assert.equal(d.out, 2); assert.equal(d.in, 1);
  });
});
describe('GroupBy', () => {
  it('groups', () => {
    const db = new GraphDB();
    db.addNode(['P'], { city: 'NYC' }); db.addNode(['P'], { city: 'NYC' }); db.addNode(['P'], { city: 'LA' });
    const g = db.groupBy('P', 'city'); assert.equal(g['NYC'].length, 2); assert.equal(g['LA'].length, 1);
  });
});
describe('Cypher', () => {
  it('MATCH label', () => {
    const db = new GraphDB();
    db.addNode(['Person'], { name: 'Alice' }); db.addNode(['Person'], { name: 'Bob' }); db.addNode(['City'], {});
    assert.equal(db.cypher('MATCH (n:Person) RETURN n').length, 2);
  });
  it('WHERE', () => {
    const db = new GraphDB();
    db.addNode(['P'], { age: 25 }); db.addNode(['P'], { age: 35 });
    assert.equal(db.cypher('MATCH (n:P) WHERE n.age > 30 RETURN n').length, 1);
  });
  it('relationship', () => {
    const db = new GraphDB();
    const a = db.addNode(['P'], { name: 'A' }); const b = db.addNode(['P'], { name: 'B' });
    db.addEdge(a, b, 'KNOWS');
    const r = db.cypher('MATCH (a:P)-[:KNOWS]->(b:P) RETURN a, b');
    assert.equal(r.length, 1); assert.equal(r[0].a.props.name, 'A');
  });
  it('LIMIT', () => {
    const db = new GraphDB();
    for (let i = 0; i < 10; i++) db.addNode(['P'], { name: i });
    assert.equal(db.cypher('MATCH (n:P) RETURN n LIMIT 3').length, 3);
  });
  it('ORDER BY', () => {
    const db = new GraphDB();
    db.addNode(['P'], { name: 'C', age: 30 }); db.addNode(['P'], { name: 'A', age: 25 }); db.addNode(['P'], { name: 'B', age: 35 });
    const r = db.cypher('MATCH (n:P) RETURN n ORDER BY n.age ASC');
    assert.equal(r[0].props.name, 'A');
  });
});
describe('Stats', () => {
  it('returns stats', () => {
    const db = new GraphDB();
    db.addNode(['Person'], {}); db.addNode(['City'], {}); db.addEdge(1, 2, 'LIVES_IN');
    const s = db.stats();
    assert.equal(s.nodes, 2); assert.equal(s.edges, 1); assert.ok(s.labels.includes('Person'));
  });
});
