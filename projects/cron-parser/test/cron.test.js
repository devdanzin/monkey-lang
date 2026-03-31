import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, isValid, nextOccurrence, nextN, matches } from '../src/index.js';

describe('parse', () => {
  it('* * * * *', () => { const c = parse('* * * * *'); assert.equal(c.minute.length, 60); assert.equal(c.hour.length, 24); });
  it('specific values', () => { const c = parse('30 9 * * 1'); assert.deepEqual(c.minute, [30]); assert.deepEqual(c.hour, [9]); assert.deepEqual(c.dayOfWeek, [1]); });
  it('ranges', () => { const c = parse('0 9-17 * * *'); assert.deepEqual(c.hour, [9,10,11,12,13,14,15,16,17]); });
  it('steps', () => { const c = parse('*/15 * * * *'); assert.deepEqual(c.minute, [0,15,30,45]); });
  it('lists', () => { const c = parse('0 8,12,18 * * *'); assert.deepEqual(c.hour, [8,12,18]); });
});

describe('isValid', () => {
  it('valid', () => assert.equal(isValid('0 9 * * 1-5'), true));
  it('invalid', () => assert.equal(isValid('bad'), false));
});

describe('matches', () => {
  it('matches correct time', () => {
    const date = new Date(2026, 2, 30, 9, 0); // Mon Mar 30 2026 9:00
    assert.equal(matches('0 9 30 3 *', date), true);
  });
  it('rejects wrong time', () => {
    const date = new Date(2026, 2, 30, 10, 0);
    assert.equal(matches('0 9 * * *', date), false);
  });
});

describe('nextOccurrence', () => {
  it('finds next', () => {
    const from = new Date(2026, 2, 30, 8, 55);
    const next = nextOccurrence('0 9 * * *', from);
    assert.equal(next.getHours(), 9);
    assert.equal(next.getMinutes(), 0);
  });
});

describe('nextN', () => {
  it('finds multiple', () => {
    const from = new Date(2026, 0, 1, 0, 0);
    const results = nextN('0 12 * * *', 3, from);
    assert.equal(results.length, 3);
    assert.equal(results[0].getHours(), 12);
  });
});
