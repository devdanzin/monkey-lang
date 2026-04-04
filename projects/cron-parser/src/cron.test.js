import { describe as desc, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCron, matches, nextOccurrence, prevOccurrence, describe as describeCron, presets } from './cron.js';

desc('parseCron', () => {
  it('every minute', () => {
    const p = parseCron('* * * * *');
    assert.equal(p.minute.length, 60);
    assert.equal(p.hour.length, 24);
  });
  it('specific time', () => {
    const p = parseCron('30 9 * * *');
    assert.deepStrictEqual(p.minute, [30]);
    assert.deepStrictEqual(p.hour, [9]);
  });
  it('range', () => {
    const p = parseCron('0 9-17 * * *');
    assert.deepStrictEqual(p.hour, [9,10,11,12,13,14,15,16,17]);
  });
  it('step', () => {
    const p = parseCron('*/15 * * * *');
    assert.deepStrictEqual(p.minute, [0, 15, 30, 45]);
  });
  it('list', () => {
    const p = parseCron('0 8,12,18 * * *');
    assert.deepStrictEqual(p.hour, [8, 12, 18]);
  });
  it('named months', () => {
    const p = parseCron('0 0 1 jan,feb,mar *');
    assert.deepStrictEqual(p.month, [1, 2, 3]);
  });
  it('named days', () => {
    const p = parseCron('0 0 * * mon-fri');
    assert.deepStrictEqual(p.dayOfWeek, [1, 2, 3, 4, 5]);
  });
  it('range with step', () => {
    const p = parseCron('0-30/10 * * * *');
    assert.deepStrictEqual(p.minute, [0, 10, 20, 30]);
  });
  it('rejects wrong field count', () => {
    assert.throws(() => parseCron('* * *'));
  });
});

desc('matches', () => {
  it('matches specific time', () => {
    const date = new Date(2026, 3, 4, 9, 30); // Apr 4, 2026 9:30 (Saturday=6)
    assert.ok(matches('30 9 * * *', date));
  });
  it('no match', () => {
    const date = new Date(2026, 3, 4, 10, 0);
    assert.ok(!matches('30 9 * * *', date));
  });
  it('every minute matches any time', () => {
    assert.ok(matches('* * * * *', new Date()));
  });
  it('day of week match', () => {
    const sat = new Date(2026, 3, 4, 0, 0); // Saturday
    assert.ok(matches('0 0 * * 6', sat));
  });
});

desc('nextOccurrence', () => {
  it('finds next minute', () => {
    const from = new Date(2026, 3, 4, 9, 0);
    const next = nextOccurrence('* * * * *', from);
    assert.equal(next.getMinutes(), 1);
  });
  it('finds next specific time', () => {
    const from = new Date(2026, 3, 4, 8, 0);
    const next = nextOccurrence('30 9 * * *', from);
    assert.equal(next.getHours(), 9);
    assert.equal(next.getMinutes(), 30);
  });
  it('wraps to next day', () => {
    const from = new Date(2026, 3, 4, 23, 59);
    const next = nextOccurrence('0 0 * * *', from);
    assert.equal(next.getDate(), 5);
    assert.equal(next.getHours(), 0);
  });
});

desc('prevOccurrence', () => {
  it('finds previous occurrence', () => {
    const from = new Date(2026, 3, 4, 10, 0);
    const prev = prevOccurrence('30 9 * * *', from);
    assert.equal(prev.getHours(), 9);
    assert.equal(prev.getMinutes(), 30);
  });
});

desc('describe', () => {
  it('every minute', () => {
    const d = describeCron('* * * * *');
    assert.ok(d.includes('Every minute'));
  });
  it('specific time', () => {
    const d = describeCron('30 9 * * *');
    assert.ok(d.includes('30'));
    assert.ok(d.includes('9'));
  });
  it('weekdays', () => {
    const d = describeCron('0 9 * * mon-fri');
    assert.ok(d.includes('mon'));
  });
});

desc('presets', () => {
  it('daily', () => {
    const p = parseCron(presets.daily);
    assert.deepStrictEqual(p.minute, [0]);
    assert.deepStrictEqual(p.hour, [0]);
  });
  it('hourly', () => {
    const p = parseCron(presets.hourly);
    assert.deepStrictEqual(p.minute, [0]);
    assert.equal(p.hour.length, 24);
  });
});
