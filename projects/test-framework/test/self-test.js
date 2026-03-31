// Self-testing test framework — using itself to test itself!
import { describe, it, beforeEach, afterEach, assert, run } from '../src/index.js';

describe('assert.equal', () => {
  it('passes for equal values', () => { assert.equal(1, 1); });
  it('passes for equal strings', () => { assert.equal('hello', 'hello'); });
  it('fails for different values', () => { assert.throws(() => assert.equal(1, 2)); });
});

describe('assert.deepEqual', () => {
  it('passes for equal objects', () => { assert.deepEqual({ a: 1 }, { a: 1 }); });
  it('passes for equal arrays', () => { assert.deepEqual([1, 2, 3], [1, 2, 3]); });
  it('fails for different objects', () => { assert.throws(() => assert.deepEqual({ a: 1 }, { a: 2 })); });
});

describe('assert.ok', () => {
  it('passes for truthy', () => { assert.ok(true); assert.ok(1); assert.ok('yes'); });
  it('fails for falsy', () => { assert.throws(() => assert.ok(false)); });
});

describe('assert.throws', () => {
  it('passes when function throws', () => { assert.throws(() => { throw new Error('oops'); }); });
});

describe('assert.isType', () => {
  it('checks types', () => { assert.isType(42, 'number'); assert.isType('hi', 'string'); assert.isType(true, 'boolean'); });
});

describe('assert.match', () => {
  it('matches regex', () => { assert.match('hello world', /hello/); });
});

describe('hooks', () => {
  let counter = 0;
  beforeEach(() => { counter++; });
  afterEach(() => { counter--; });

  it('beforeEach runs before each test', () => { assert.equal(counter, 1); });
  it('afterEach resets after each test', () => { assert.equal(counter, 1); }); // Reset then incremented
});

describe('nested suites', () => {
  describe('inner', () => {
    it('works inside nested describe', () => { assert.ok(true); });
  });
});

// Run the tests
const results = await run({ verbose: true });
assert.equal(results.failed, 0);
console.log(`\n✅ Test framework tested itself: ${results.passed} assertions passed`);
