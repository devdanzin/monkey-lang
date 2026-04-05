// Minimal test runner
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
async function run() {
  let passed = 0, failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      passed++;
    } catch (e) {
      console.log(`  ✗ ${t.name}: ${e.message}`);
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total`);
  if (failed > 0) process.exit(1);
}
module.exports = { test, run };
