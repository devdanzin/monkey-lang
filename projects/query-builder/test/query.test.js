import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Query } from '../src/index.js';

describe('SELECT', () => {
  it('basic', () => {
    const { sql } = Query.from('users').build();
    assert.equal(sql, 'SELECT * FROM users');
  });
  it('columns', () => {
    const { sql } = Query.from('users').select('name', 'email').build();
    assert.equal(sql, 'SELECT name, email FROM users');
  });
  it('where', () => {
    const { sql, params } = Query.from('users').where('age', '>', 18).build();
    assert.equal(sql, 'SELECT * FROM users WHERE age > ?');
    assert.deepEqual(params, [18]);
  });
  it('multiple where', () => {
    const { sql, params } = Query.from('users').where('age', '>', 18).where('active', true).build();
    assert.equal(sql, 'SELECT * FROM users WHERE age > ? AND active = ?');
    assert.deepEqual(params, [18, true]);
  });
  it('orWhere', () => {
    const { sql } = Query.from('users').where('role', 'admin').orWhere('role', 'mod').build();
    assert.ok(sql.includes('OR role = ?'));
  });
  it('orderBy + limit', () => {
    const { sql } = Query.from('users').orderBy('name').limit(10).offset(20).build();
    assert.equal(sql, 'SELECT * FROM users ORDER BY name ASC LIMIT 10 OFFSET 20');
  });
  it('join', () => {
    const { sql } = Query.from('users').join('posts', 'users.id = posts.user_id').build();
    assert.ok(sql.includes('JOIN posts ON users.id = posts.user_id'));
  });
  it('groupBy + having', () => {
    const { sql } = Query.from('orders').select('status', 'COUNT(*)').groupBy('status').having('COUNT(*)', '>', 5).build();
    assert.ok(sql.includes('GROUP BY status'));
    assert.ok(sql.includes('HAVING COUNT(*) > ?'));
  });
});

describe('INSERT', () => {
  it('basic', () => {
    const { sql, params } = Query.insert('users').set({ name: 'Alice', age: 30 }).build();
    assert.equal(sql, 'INSERT INTO users (name, age) VALUES (?, ?)');
    assert.deepEqual(params, ['Alice', 30]);
  });
});

describe('UPDATE', () => {
  it('basic', () => {
    const { sql, params } = Query.update('users').set({ name: 'Bob' }).where('id', 1).build();
    assert.equal(sql, 'UPDATE users SET name = ? WHERE id = ?');
    assert.deepEqual(params, ['Bob', 1]);
  });
});

describe('DELETE', () => {
  it('basic', () => {
    const { sql, params } = Query.delete('users').where('id', 1).build();
    assert.equal(sql, 'DELETE FROM users WHERE id = ?');
    assert.deepEqual(params, [1]);
  });
});
