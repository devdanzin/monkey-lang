import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  Database, BTreeIndex, createTable, insert, select, update, deleteFrom,
  createIndex, explain,
  eq, neq, lt, gt, lte, gte, and, or, like, inList,
  count, sum, avg, min, max
} from '../src/index.js';

function seedDB() {
  const db = new Database();
  db.execute(createTable('users', [
    { name: 'id', type: 'int' },
    { name: 'name', type: 'string' },
    { name: 'age', type: 'int' },
    { name: 'city', type: 'string' },
  ]));
  db.execute(insert('users', ['name', 'age', 'city'], ['Alice', 30, 'NYC']));
  db.execute(insert('users', ['name', 'age', 'city'], ['Bob', 25, 'SF']));
  db.execute(insert('users', ['name', 'age', 'city'], ['Charlie', 35, 'NYC']));
  db.execute(insert('users', ['name', 'age', 'city'], ['Diana', 28, 'LA']));
  db.execute(insert('users', ['name', 'age', 'city'], ['Eve', 32, 'SF']));
  return db;
}

describe('B-Tree Index', () => {
  describe('BTreeIndex standalone', () => {
    it('inserts and looks up single keys', () => {
      const idx = new BTreeIndex('idx_age', 'age');
      idx.insert(30, 0);
      idx.insert(25, 1);
      idx.insert(35, 2);
      assert.deepEqual(idx.lookup(30), [0]);
      assert.deepEqual(idx.lookup(25), [1]);
      assert.deepEqual(idx.lookup(99), []);
    });

    it('handles duplicate keys', () => {
      const idx = new BTreeIndex('idx_city', 'city');
      idx.insert('NYC', 0);
      idx.insert('SF', 1);
      idx.insert('NYC', 2);
      const result = idx.lookup('NYC');
      assert.equal(result.length, 2);
      assert.ok(result.includes(0));
      assert.ok(result.includes(2));
    });

    it('range scan returns correct results', () => {
      const idx = new BTreeIndex('idx_age', 'age');
      for (let i = 0; i < 20; i++) idx.insert(i * 5, i);
      const result = idx.range(25, 50);
      assert.ok(result.includes(5));  // 25
      assert.ok(result.includes(10)); // 50
      assert.ok(!result.includes(11)); // 55 > 50
    });

    it('greater-than scan', () => {
      const idx = new BTreeIndex('idx_age', 'age');
      idx.insert(10, 0);
      idx.insert(20, 1);
      idx.insert(30, 2);
      idx.insert(40, 3);
      const result = idx.greaterThan(25);
      assert.equal(result.length, 2);
      assert.ok(result.includes(2)); // 30
      assert.ok(result.includes(3)); // 40
    });

    it('handles large number of insertions', () => {
      const idx = new BTreeIndex('idx_big', 'val', 4); // Small order to force splits
      for (let i = 0; i < 1000; i++) idx.insert(i, i);
      assert.equal(idx.size, 1000);
      assert.deepEqual(idx.lookup(500), [500]);
      assert.deepEqual(idx.lookup(999), [999]);
      assert.deepEqual(idx.lookup(1000), []);
    });
  });

  describe('CREATE INDEX', () => {
    it('creates an index on an existing table', () => {
      const db = seedDB();
      const r = db.execute(createIndex('idx_age', 'users', 'age'));
      assert.equal(r.type, 'ok');
      assert.ok(r.message.includes('idx_age'));
    });

    it('index is populated with existing rows', () => {
      const db = seedDB();
      db.execute(createIndex('idx_age', 'users', 'age'));
      const table = db.getTable('users');
      const index = table.getIndex('age');
      assert.ok(index);
      assert.deepEqual(index.lookup(30).length, 1);
      assert.deepEqual(index.lookup(25).length, 1);
    });

    it('index updated on new inserts', () => {
      const db = seedDB();
      db.execute(createIndex('idx_age', 'users', 'age'));
      db.execute(insert('users', ['name', 'age', 'city'], ['Frank', 30, 'LA']));
      const table = db.getTable('users');
      const index = table.getIndex('age');
      assert.equal(index.lookup(30).length, 2);
    });
  });

  describe('Index-accelerated queries', () => {
    it('uses index for equality lookup', () => {
      const db = seedDB();
      db.execute(createIndex('idx_age', 'users', 'age'));
      const r = db.execute(select('*').FROM('users').WHERE(eq('age', 30)));
      assert.equal(r.count, 1);
      assert.equal(r.rows[0].name, 'Alice');
    });

    it('uses index for city lookup', () => {
      const db = seedDB();
      db.execute(createIndex('idx_city', 'users', 'city'));
      const r = db.execute(select('*').FROM('users').WHERE(eq('city', 'NYC')));
      assert.equal(r.count, 2);
    });

    it('uses index for greater-than', () => {
      const db = seedDB();
      db.execute(createIndex('idx_age', 'users', 'age'));
      const r = db.execute(select('*').FROM('users').WHERE(gt('age', 30)));
      assert.equal(r.count, 2);
    });

    it('uses index with AND condition (index + residual)', () => {
      const db = seedDB();
      db.execute(createIndex('idx_age', 'users', 'age'));
      const r = db.execute(select('*').FROM('users').WHERE(
        and(gt('age', 25), eq('city', 'NYC'))
      ));
      assert.equal(r.count, 2); // Alice (30, NYC) and Charlie (35, NYC)
    });

    it('same results with and without index', () => {
      const db1 = seedDB();
      const db2 = seedDB();
      db2.execute(createIndex('idx_age', 'users', 'age'));
      
      const q1 = select('*').FROM('users').WHERE(gt('age', 28));
      const q2 = select('*').FROM('users').WHERE(gt('age', 28));
      const r1 = db1.execute(q1);
      const r2 = db2.execute(q2);
      assert.equal(r1.count, r2.count);
      assert.deepEqual(
        r1.rows.map(r => r.name).sort(),
        r2.rows.map(r => r.name).sort()
      );
    });
  });

  describe('EXPLAIN', () => {
    it('shows full_scan for query without index', () => {
      const db = seedDB();
      const r = db.execute(explain(select('*').FROM('users').WHERE(eq('age', 30))));
      assert.equal(r.type, 'plan');
      assert.equal(r.plan.type, 'full_scan');
    });

    it('shows index_scan for query with index', () => {
      const db = seedDB();
      db.execute(createIndex('idx_age', 'users', 'age'));
      const r = db.execute(explain(select('*').FROM('users').WHERE(eq('age', 30))));
      assert.equal(r.type, 'plan');
      assert.equal(r.plan.type, 'index_scan');
      assert.equal(r.plan.index, 'idx_age');
    });

    it('shows index_scan with residual for AND with partial index', () => {
      const db = seedDB();
      db.execute(createIndex('idx_age', 'users', 'age'));
      const r = db.execute(explain(select('*').FROM('users').WHERE(
        and(eq('age', 30), eq('city', 'NYC'))
      )));
      assert.equal(r.plan.type, 'index_scan');
      assert.equal(r.plan.residual, true);
    });

    it('includes estimatedCost and estimatedRows', () => {
      const db = seedDB();
      db.execute(createIndex('idx_age', 'users', 'age'));
      const r = db.execute(explain(select('*').FROM('users').WHERE(eq('age', 30))));
      assert.ok(typeof r.plan.estimatedCost === 'number');
      assert.ok(typeof r.plan.estimatedRows === 'number');
      assert.ok(r.plan.estimatedCost > 0);
    });

    it('shows steps in plan', () => {
      const db = seedDB();
      db.execute(createIndex('idx_age', 'users', 'age'));
      const r = db.execute(explain(select('*').FROM('users').WHERE(eq('age', 30))));
      assert.ok(Array.isArray(r.plan.steps));
      assert.ok(r.plan.steps.length >= 2); // scan + index_scan
    });

    it('shows sort step for ORDER BY', () => {
      const db = seedDB();
      const r = db.execute(explain(select('*').FROM('users').ORDER_BY('age')));
      assert.ok(r.plan.steps.some(s => s.op === 'sort'));
    });

    it('shows limit step', () => {
      const db = seedDB();
      const r = db.execute(explain(select('*').FROM('users').LIMIT(2)));
      assert.ok(r.plan.steps.some(s => s.op === 'limit' && s.count === 2));
    });

    it('index scan has lower cost than full scan', () => {
      const db = seedDB();
      // Without index
      const r1 = db.execute(explain(select('*').FROM('users').WHERE(eq('age', 30))));
      // Add index
      db.execute(createIndex('idx_age', 'users', 'age'));
      const r2 = db.execute(explain(select('*').FROM('users').WHERE(eq('age', 30))));
      assert.ok(r2.plan.estimatedCost < r1.plan.estimatedCost, 
        `Index cost ${r2.plan.estimatedCost} should be less than full scan ${r1.plan.estimatedCost}`);
    });
  });
});
