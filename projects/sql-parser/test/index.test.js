const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../src/index.js');

test('simple SELECT', () => {
  const ast = parse('SELECT name, age FROM users');
  assert.equal(ast.type, 'select');
  assert.equal(ast.columns.length, 2);
  assert.equal(ast.from.table, 'users');
});

test('SELECT *', () => {
  const ast = parse('SELECT * FROM orders');
  assert.equal(ast.columns[0].expr, '*');
});

test('WHERE clause', () => {
  const ast = parse("SELECT * FROM users WHERE age > 18");
  assert.ok(ast.where);
  assert.equal(ast.where.type, 'comparison');
  assert.equal(ast.where.op, '>');
});

test('AND/OR', () => {
  const ast = parse("SELECT * FROM t WHERE a = 1 AND b = 2");
  assert.equal(ast.where.op, 'AND');
});

test('ORDER BY', () => {
  const ast = parse('SELECT * FROM t ORDER BY name ASC, age DESC');
  assert.equal(ast.orderBy.length, 2);
  assert.equal(ast.orderBy[1].direction, 'DESC');
});

test('LIMIT OFFSET', () => {
  const ast = parse('SELECT * FROM t LIMIT 10 OFFSET 20');
  assert.equal(ast.limit, 10);
  assert.equal(ast.offset, 20);
});

test('JOIN', () => {
  const ast = parse('SELECT * FROM users JOIN orders ON users.id = orders.user_id');
  assert.equal(ast.joins.length, 1);
  assert.equal(ast.joins[0].table, 'orders');
});

test('LEFT JOIN', () => {
  const ast = parse('SELECT * FROM a LEFT JOIN b ON a.id = b.aid');
  assert.equal(ast.joins[0].type, 'LEFT');
});

test('INSERT', () => {
  const ast = parse("INSERT INTO users (name, age) VALUES ('Alice', 30)");
  assert.equal(ast.type, 'insert');
  assert.equal(ast.table, 'users');
  assert.equal(ast.columns.length, 2);
  assert.equal(ast.values.length, 2);
});

test('UPDATE', () => {
  const ast = parse("UPDATE users SET name = 'Bob' WHERE id = 1");
  assert.equal(ast.type, 'update');
  assert.equal(ast.set.length, 1);
  assert.ok(ast.where);
});

test('DELETE', () => {
  const ast = parse('DELETE FROM users WHERE id = 5');
  assert.equal(ast.type, 'delete');
  assert.equal(ast.table, 'users');
});

test('aggregate function', () => {
  const ast = parse('SELECT COUNT(*) FROM users');
  assert.equal(ast.columns[0].expr.type, 'aggregate');
  assert.equal(ast.columns[0].expr.fn, 'COUNT');
});

test('GROUP BY HAVING', () => {
  const ast = parse('SELECT city FROM users GROUP BY city HAVING COUNT(*) > 5');
  assert.ok(ast.groupBy);
  assert.ok(ast.having);
});
