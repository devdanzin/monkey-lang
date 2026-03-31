import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { format, timeAgo, isLeapYear, daysInMonth } from '../src/index.js';

const d = new Date(2026, 2, 30, 14, 5, 9); // Mar 30, 2026 14:05:09

describe('format', () => {
  it('YYYY-MM-DD', () => assert.equal(format(d, 'YYYY-MM-DD'), '2026-03-30'));
  it('HH:mm:ss', () => assert.equal(format(d, 'HH:mm:ss'), '14:05:09'));
  it('12-hour', () => assert.equal(format(d, 'hh:mm A'), '02:05 PM'));
  it('short', () => assert.equal(format(d, 'M/D/YY'), '3/30/26'));
});

describe('timeAgo', () => {
  it('just now', () => assert.equal(timeAgo(new Date(), new Date()), 'just now'));
  it('minutes', () => assert.equal(timeAgo(new Date(Date.now()-300000)), '5m ago'));
  it('hours', () => assert.equal(timeAgo(new Date(Date.now()-7200000)), '2h ago'));
});

describe('utils', () => {
  it('leap year', () => { assert.ok(isLeapYear(2024)); assert.ok(!isLeapYear(2023)); });
  it('days in month', () => { assert.equal(daysInMonth(2026, 2), 28); assert.equal(daysInMonth(2024, 2), 29); });
});
