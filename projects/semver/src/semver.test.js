import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, valid, format, compare, gt, lt, eq, gte, lte, sort, increment, diff, coerce, satisfies } from './semver.js';

describe('parse', () => {
  it('simple', () => { const p = parse('1.2.3'); assert.equal(p.major, 1); assert.equal(p.minor, 2); assert.equal(p.patch, 3); });
  it('with v prefix', () => { const p = parse('v1.0.0'); assert.equal(p.major, 1); });
  it('prerelease', () => { const p = parse('1.0.0-alpha.1'); assert.deepStrictEqual(p.prerelease, ['alpha', '1']); });
  it('build metadata', () => { const p = parse('1.0.0+build.123'); assert.deepStrictEqual(p.build, ['build', '123']); });
  it('invalid returns null', () => { assert.equal(parse('not.a.version'), null); });
});

describe('valid', () => {
  it('valid', () => { assert.ok(valid('1.0.0')); });
  it('invalid', () => { assert.ok(!valid('abc')); });
});

describe('compare', () => {
  it('major diff', () => { assert.ok(compare('2.0.0', '1.0.0') > 0); });
  it('minor diff', () => { assert.ok(compare('1.1.0', '1.0.0') > 0); });
  it('patch diff', () => { assert.ok(compare('1.0.1', '1.0.0') > 0); });
  it('equal', () => { assert.equal(compare('1.0.0', '1.0.0'), 0); });
  it('prerelease < release', () => { assert.ok(compare('1.0.0-alpha', '1.0.0') < 0); });
  it('prerelease ordering', () => { assert.ok(compare('1.0.0-alpha', '1.0.0-beta') < 0); });
  it('numeric prerelease', () => { assert.ok(compare('1.0.0-1', '1.0.0-2') < 0); });
});

describe('comparison helpers', () => {
  it('gt', () => { assert.ok(gt('2.0.0', '1.0.0')); });
  it('lt', () => { assert.ok(lt('1.0.0', '2.0.0')); });
  it('eq', () => { assert.ok(eq('1.0.0', '1.0.0')); });
  it('gte', () => { assert.ok(gte('1.0.0', '1.0.0')); });
  it('lte', () => { assert.ok(lte('1.0.0', '1.0.0')); });
});

describe('sort', () => {
  it('sorts versions', () => {
    assert.deepStrictEqual(sort(['3.0.0', '1.0.0', '2.0.0']), ['1.0.0', '2.0.0', '3.0.0']);
  });
  it('sorts with prerelease', () => {
    assert.deepStrictEqual(sort(['1.0.0', '1.0.0-alpha', '1.0.0-beta']), ['1.0.0-alpha', '1.0.0-beta', '1.0.0']);
  });
});

describe('increment', () => {
  it('major', () => { assert.equal(increment('1.2.3', 'major'), '2.0.0'); });
  it('minor', () => { assert.equal(increment('1.2.3', 'minor'), '1.3.0'); });
  it('patch', () => { assert.equal(increment('1.2.3', 'patch'), '1.2.4'); });
  it('prerelease from release', () => { assert.equal(increment('1.2.3', 'prerelease'), '1.2.4-0'); });
  it('prerelease from prerelease', () => { assert.equal(increment('1.2.3-0', 'prerelease'), '1.2.3-1'); });
});

describe('diff', () => {
  it('major', () => { assert.equal(diff('1.0.0', '2.0.0'), 'major'); });
  it('minor', () => { assert.equal(diff('1.0.0', '1.1.0'), 'minor'); });
  it('patch', () => { assert.equal(diff('1.0.0', '1.0.1'), 'patch'); });
  it('same', () => { assert.equal(diff('1.0.0', '1.0.0'), null); });
  it('prerelease', () => { assert.equal(diff('1.0.0-alpha', '1.0.0-beta'), 'prerelease'); });
});

describe('coerce', () => {
  it('partial version', () => { assert.equal(coerce('1.2'), '1.2.0'); });
  it('just major', () => { assert.equal(coerce('1'), '1.0.0'); });
  it('embedded in string', () => { assert.equal(coerce('v2.3.4-rc'), '2.3.4'); });
});

describe('satisfies', () => {
  it('exact match', () => { assert.ok(satisfies('1.0.0', '1.0.0')); });
  it('caret range', () => { assert.ok(satisfies('1.2.3', '^1.0.0')); });
  it('caret rejects major bump', () => { assert.ok(!satisfies('2.0.0', '^1.0.0')); });
  it('tilde range', () => { assert.ok(satisfies('1.2.5', '~1.2.3')); });
  it('tilde rejects minor bump', () => { assert.ok(!satisfies('1.3.0', '~1.2.3')); });
  it('gte', () => { assert.ok(satisfies('2.0.0', '>=1.0.0')); });
  it('lt', () => { assert.ok(satisfies('0.9.0', '<1.0.0')); });
  it('AND range', () => { assert.ok(satisfies('1.5.0', '>=1.0.0 <2.0.0')); });
  it('OR range', () => { assert.ok(satisfies('2.0.0', '>=1.0.0 <1.5.0 || >=2.0.0')); });
});
