// testfw.js — Test framework

export function expect(actual) {
  return {
    toBe(expected) { if (actual !== expected) throw new AssertionError(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`); },
    toEqual(expected) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new AssertionError(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`); },
    toBeTruthy() { if (!actual) throw new AssertionError(`Expected ${JSON.stringify(actual)} to be truthy`); },
    toBeFalsy() { if (actual) throw new AssertionError(`Expected ${JSON.stringify(actual)} to be falsy`); },
    toBeNull() { if (actual !== null) throw new AssertionError(`Expected null, got ${JSON.stringify(actual)}`); },
    toBeUndefined() { if (actual !== undefined) throw new AssertionError(`Expected undefined`); },
    toBeGreaterThan(n) { if (actual <= n) throw new AssertionError(`Expected ${actual} > ${n}`); },
    toBeLessThan(n) { if (actual >= n) throw new AssertionError(`Expected ${actual} < ${n}`); },
    toContain(item) {
      if (typeof actual === 'string') { if (!actual.includes(item)) throw new AssertionError(`Expected "${actual}" to contain "${item}"`); }
      else if (Array.isArray(actual)) { if (!actual.includes(item)) throw new AssertionError(`Expected array to contain ${JSON.stringify(item)}`); }
    },
    toHaveLength(n) { if (actual.length !== n) throw new AssertionError(`Expected length ${n}, got ${actual.length}`); },
    toThrow(pattern) {
      let threw = false, error;
      try { actual(); } catch (e) { threw = true; error = e; }
      if (!threw) throw new AssertionError('Expected function to throw');
      if (pattern && !error.message.includes(pattern)) throw new AssertionError(`Expected error to match "${pattern}", got "${error.message}"`);
    },
    toBeInstanceOf(cls) { if (!(actual instanceof cls)) throw new AssertionError(`Expected instance of ${cls.name}`); },
    not: {
      toBe(expected) { if (actual === expected) throw new AssertionError(`Expected not to be ${JSON.stringify(expected)}`); },
      toEqual(expected) { if (JSON.stringify(actual) === JSON.stringify(expected)) throw new AssertionError('Expected values not to equal'); },
      toContain(item) { if ((typeof actual === 'string' && actual.includes(item)) || (Array.isArray(actual) && actual.includes(item))) throw new AssertionError('Expected not to contain'); },
      toThrow() { try { actual(); } catch { throw new AssertionError('Expected function not to throw'); } },
    },
  };
}

class AssertionError extends Error { constructor(msg) { super(msg); this.name = 'AssertionError'; } }

// ===== Suite =====
export class Suite {
  constructor() { this.suites = []; this.results = []; }

  describe(name, fn) {
    const suite = { name, tests: [], beforeEach: null, afterEach: null };
    const context = {
      it: (testName, testFn) => suite.tests.push({ name: testName, fn: testFn, skip: false, only: false }),
      xit: (testName, testFn) => suite.tests.push({ name: testName, fn: testFn, skip: true }),
      fit: (testName, testFn) => suite.tests.push({ name: testName, fn: testFn, only: true }),
      beforeEach: (fn) => { suite.beforeEach = fn; },
      afterEach: (fn) => { suite.afterEach = fn; },
    };
    fn(context);
    this.suites.push(suite);
  }

  async run() {
    this.results = [];
    for (const suite of this.suites) {
      const hasOnly = suite.tests.some(t => t.only);
      for (const test of suite.tests) {
        if (test.skip) { this.results.push({ suite: suite.name, test: test.name, status: 'skipped' }); continue; }
        if (hasOnly && !test.only) { this.results.push({ suite: suite.name, test: test.name, status: 'skipped' }); continue; }
        
        try {
          if (suite.beforeEach) await suite.beforeEach();
          await test.fn();
          if (suite.afterEach) await suite.afterEach();
          this.results.push({ suite: suite.name, test: test.name, status: 'passed' });
        } catch (error) {
          this.results.push({ suite: suite.name, test: test.name, status: 'failed', error: error.message });
        }
      }
    }
    return this.results;
  }

  get passed() { return this.results.filter(r => r.status === 'passed').length; }
  get failed() { return this.results.filter(r => r.status === 'failed').length; }
  get skipped() { return this.results.filter(r => r.status === 'skipped').length; }
  get total() { return this.results.length; }

  toTAP() {
    const lines = [`1..${this.total}`];
    this.results.forEach((r, i) => {
      const prefix = r.status === 'passed' ? 'ok' : r.status === 'skipped' ? 'ok' : 'not ok';
      const suffix = r.status === 'skipped' ? ' # SKIP' : '';
      lines.push(`${prefix} ${i + 1} - ${r.suite} > ${r.test}${suffix}`);
      if (r.error) lines.push(`  ---\n  message: ${r.error}\n  ...`);
    });
    return lines.join('\n');
  }
}

export { AssertionError };
