const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Money } = require('../src/index.js');

test('create and access', () => {
  const m = Money.of(10.50);
  assert.equal(m.amount, 10.50);
  assert.equal(m.cents, 1050);
  assert.equal(m.currency, 'USD');
});

test('parse', () => {
  assert.equal(Money.parse('$10.50').cents, 1050);
  assert.equal(Money.parse('EUR 25.00').currency, 'EUR');
  assert.equal(Money.parse('1,234.56').cents, 123456);
});

test('arithmetic', () => {
  const a = Money.of(10.00);
  const b = Money.of(3.50);
  assert.equal(a.add(b).amount, 13.50);
  assert.equal(a.subtract(b).amount, 6.50);
  assert.equal(a.multiply(3).amount, 30.00);
  assert.equal(a.divide(4).amount, 2.50);
});

test('no floating-point errors', () => {
  const a = Money.of(0.10);
  const b = Money.of(0.20);
  assert.equal(a.add(b).amount, 0.30); // Not 0.30000000000000004
});

test('currency mismatch throws', () => {
  const usd = Money.of(10, 'USD');
  const eur = Money.of(10, 'EUR');
  assert.throws(() => usd.add(eur), /Currency mismatch/);
});

test('comparison', () => {
  const a = Money.of(10);
  const b = Money.of(20);
  assert.ok(a.lt(b));
  assert.ok(b.gt(a));
  assert.ok(a.equals(Money.of(10)));
});

test('allocate evenly', () => {
  const m = Money.of(10.00);
  const parts = m.allocate(3);
  assert.equal(parts.length, 3);
  // Total should still be 10.00
  assert.equal(parts.reduce((s, p) => s + p.cents, 0), 1000);
  // Each should be 3.33 or 3.34
  assert.ok(parts.every(p => p.cents === 333 || p.cents === 334));
});

test('split by ratio', () => {
  const m = Money.of(100);
  const parts = m.splitByRatio([1, 2, 3]);
  assert.equal(parts.reduce((s, p) => s + p.cents, 0), 10000);
});

test('percentage', () => {
  const m = Money.of(200);
  assert.equal(m.percentage(15).amount, 30);
});

test('convert currency', () => {
  const usd = Money.of(100, 'USD');
  const eur = usd.convert('EUR', 0.85);
  assert.equal(eur.currency, 'EUR');
  assert.equal(eur.amount, 85);
});

test('format', () => {
  assert.equal(Money.of(1234.56).format(), '$1,234.56');
  assert.equal(Money.of(-50).format(), '-$50.00');
  assert.equal(Money.of(10, 'EUR').format(), '€10.00');
});

test('zero / positive / negative', () => {
  assert.ok(Money.zero().isZero());
  assert.ok(Money.of(5).isPositive());
  assert.ok(Money.of(-5).isNegative());
  assert.equal(Money.of(-5).abs().amount, 5);
});
