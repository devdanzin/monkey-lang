import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, format, compare, gt, lt, eq, sort, inc, satisfies, valid } from '../src/index.js';

describe('parse/format', () => {
  it('basic', () => { const v = parse('1.2.3'); assert.equal(v.major, 1); assert.equal(v.minor, 2); assert.equal(v.patch, 3); });
  it('prerelease', () => assert.equal(parse('1.0.0-alpha').prerelease, 'alpha'));
  it('build', () => assert.equal(parse('1.0.0+build.1').build, 'build.1'));
  it('format', () => assert.equal(format(parse('1.2.3-beta')), '1.2.3-beta'));
  it('invalid', () => assert.throws(() => parse('bad')));
});
describe('compare', () => {
  it('major', () => assert.ok(gt('2.0.0', '1.0.0')));
  it('minor', () => assert.ok(lt('1.0.0', '1.1.0')));
  it('patch', () => assert.ok(lt('1.0.0', '1.0.1')));
  it('prerelease < release', () => assert.ok(lt('1.0.0-alpha', '1.0.0')));
  it('equal', () => assert.ok(eq('1.0.0', '1.0.0')));
});
describe('sort', () => { it('sorts', () => { const sorted = sort(['1.2.0', '1.0.0', '2.0.0', '1.1.0']); assert.equal(sorted[0], '1.0.0'); assert.equal(sorted[3], '2.0.0'); }); });
describe('inc', () => { it('major', () => assert.equal(inc('1.2.3', 'major'), '2.0.0')); it('minor', () => assert.equal(inc('1.2.3', 'minor'), '1.3.0')); it('patch', () => assert.equal(inc('1.2.3', 'patch'), '1.2.4')); });
describe('satisfies', () => { it('^1.0.0', () => assert.ok(satisfies('1.5.0', '^1.0.0'))); it('~1.2.0', () => assert.ok(satisfies('1.2.5', '~1.2.0'))); it('exact', () => assert.ok(satisfies('1.0.0', '1.0.0'))); });
describe('valid', () => { it('yes', () => assert.ok(valid('1.0.0'))); it('no', () => assert.ok(!valid('bad'))); });
