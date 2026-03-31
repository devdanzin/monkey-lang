// Tiny Test Framework — describe/it/assert/hooks, from scratch

const suites = [];
let currentSuite = null;

export function describe(name, fn) {
  const suite = { name, tests: [], hooks: { beforeEach: [], afterEach: [], beforeAll: [], afterAll: [] }, suites: [] };
  const parent = currentSuite;
  if (parent) parent.suites.push(suite);
  else suites.push(suite);
  currentSuite = suite;
  fn();
  currentSuite = parent;
}

export function it(name, fn) {
  if (!currentSuite) throw new Error('it() must be inside describe()');
  currentSuite.tests.push({ name, fn });
}

export const test = it;

export function beforeEach(fn) { if (currentSuite) currentSuite.hooks.beforeEach.push(fn); }
export function afterEach(fn) { if (currentSuite) currentSuite.hooks.afterEach.push(fn); }
export function beforeAll(fn) { if (currentSuite) currentSuite.hooks.beforeAll.push(fn); }
export function afterAll(fn) { if (currentSuite) currentSuite.hooks.afterAll.push(fn); }

// Assertions
export const assert = {
  equal(actual, expected) { if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); },
  notEqual(actual, expected) { if (actual === expected) throw new Error(`Expected not equal to ${JSON.stringify(expected)}`); },
  deepEqual(actual, expected) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); },
  ok(value, msg) { if (!value) throw new Error(msg || `Expected truthy, got ${JSON.stringify(value)}`); },
  throws(fn, msg) { try { fn(); throw new Error(msg || 'Expected function to throw'); } catch (e) { if (e.message === (msg || 'Expected function to throw')) throw e; } },
  doesNotThrow(fn) { try { fn(); } catch (e) { throw new Error(`Expected no throw, got: ${e.message}`); } },
  isType(value, type) { if (typeof value !== type) throw new Error(`Expected type ${type}, got ${typeof value}`); },
  match(str, regex) { if (!regex.test(str)) throw new Error(`Expected "${str}" to match ${regex}`); },
  fail(msg) { throw new Error(msg || 'Assertion failed'); },
};

// Runner
export async function run({ verbose = true } = {}) {
  let passed = 0, failed = 0, skipped = 0;
  const failures = [];

  async function runSuite(suite, indent = 0) {
    const prefix = '  '.repeat(indent);
    if (verbose) console.log(`${prefix}${suite.name}`);

    for (const hook of suite.hooks.beforeAll) await hook();

    for (const test of suite.tests) {
      try {
        for (const hook of suite.hooks.beforeEach) await hook();
        await test.fn();
        for (const hook of suite.hooks.afterEach) await hook();
        passed++;
        if (verbose) console.log(`${prefix}  ✓ ${test.name}`);
      } catch (err) {
        failed++;
        failures.push({ suite: suite.name, test: test.name, error: err });
        if (verbose) console.log(`${prefix}  ✗ ${test.name}: ${err.message}`);
      }
    }

    for (const child of suite.suites) await runSuite(child, indent + 1);
    for (const hook of suite.hooks.afterAll) await hook();
  }

  for (const suite of suites) await runSuite(suite);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  ${f.suite} > ${f.test}: ${f.error.message}`);
  }

  suites.length = 0; // Reset for next run
  return { passed, failed, failures };
}
