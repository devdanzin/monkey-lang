import { strict as assert } from 'assert';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { CFGBuilder, CFG } from './cfg.js';

let passed = 0, failed = 0, total = 0;

function test(name, fn) {
  total++;
  try { fn(); passed++; } catch (e) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`    ${e.message}`);
  }
}

function parse(source) {
  const lexer = new Lexer(source);
  const parser = new Parser(lexer);
  return parser.parseProgram();
}

function buildCFG(source) {
  const program = parse(source);
  const builder = new CFGBuilder();
  return builder.build(program);
}

// ============================================================
// Basic blocks
// ============================================================

test('empty program: entry → exit', () => {
  const cfg = buildCFG('');
  assert.equal(cfg.blocks.size, 2); // entry + exit
  const entry = cfg.blocks.get(cfg.entry);
  assert.ok(entry.succs.includes(cfg.exit));
});

test('sequential statements: single block', () => {
  const cfg = buildCFG('let x = 1; let y = 2; let z = 3;');
  const entry = cfg.blocks.get(cfg.entry);
  assert.equal(entry.stmts.length, 3);
});

test('return terminates block', () => {
  const cfg = buildCFG('let x = 1; return x;');
  const entry = cfg.blocks.get(cfg.entry);
  assert.equal(entry.stmts.length, 2);
  assert.ok(entry.succs.includes(cfg.exit)); // return → exit
});

// ============================================================
// If/else branching
// ============================================================

test('if creates branch: entry → then + merge', () => {
  const cfg = buildCFG('if (true) { let x = 1; }');
  assert.ok(cfg.blocks.size >= 4); // entry, then, merge, exit
});

test('if/else creates diamond', () => {
  const cfg = buildCFG('if (true) { let x = 1; } else { let x = 2; }');
  // entry → then, entry → else, then → merge, else → merge
  const entry = cfg.blocks.get(cfg.entry);
  assert.equal(entry.succs.length, 2); // then and else
});

test('nested if/else', () => {
  const cfg = buildCFG(`
    if (true) { 
      if (false) { let a = 1; } else { let b = 2; }
    } else { 
      let c = 3; 
    }
  `);
  // Should have: entry, then1, if2-then, if2-else, merge2, else1, merge1, exit
  assert.ok(cfg.blocks.size >= 6);
});

// ============================================================
// While loops
// ============================================================

test('while creates loop structure', () => {
  const cfg = buildCFG('while (x > 0) { let x = x - 1; }');
  // entry → while-cond → while-body → while-cond (back edge)
  // while-cond → while-exit → exit
  assert.ok(cfg.blocks.size >= 5);
  
  // Find the while-cond block
  let condBlock = null;
  for (const [, block] of cfg.blocks) {
    if (block.label === 'while-cond') condBlock = block;
  }
  assert.ok(condBlock);
  assert.equal(condBlock.succs.length, 2); // body + exit
});

test('while loop has back edge', () => {
  const cfg = buildCFG('while (true) { let x = 1; }');
  let condBlock = null, bodyBlock = null;
  for (const [, block] of cfg.blocks) {
    if (block.label === 'while-cond') condBlock = block;
    if (block.label === 'while-body') bodyBlock = block;
  }
  assert.ok(condBlock && bodyBlock);
  // Body should have back edge to cond
  assert.ok(bodyBlock.succs.includes(condBlock.id));
});

// ============================================================
// Dominators
// ============================================================

test('entry dominates all blocks', () => {
  const cfg = buildCFG('if (true) { let x = 1; } else { let y = 2; }');
  const dom = cfg.computeDominators();
  for (const [id, domSet] of dom) {
    assert.ok(domSet.has(cfg.entry), `Entry should dominate BB${id}`);
  }
});

test('entry has no dominator except itself', () => {
  const cfg = buildCFG('let x = 1;');
  const dom = cfg.computeDominators();
  const entryDom = dom.get(cfg.entry);
  assert.equal(entryDom.size, 1);
  assert.ok(entryDom.has(cfg.entry));
});

test('immediate dominators: diamond pattern', () => {
  const cfg = buildCFG('if (true) { let x = 1; } else { let y = 2; }');
  const idom = cfg.computeImmediateDominators();
  assert.equal(idom.get(cfg.entry), null); // entry has no idom
});

// ============================================================
// Loop detection
// ============================================================

test('while loop detected as natural loop', () => {
  const cfg = buildCFG('while (x > 0) { let x = x - 1; }');
  const loops = cfg.detectLoops();
  assert.ok(loops.length >= 1);
  assert.ok(loops[0].body.size >= 2); // At least header + body
});

test('no loops in straight-line code', () => {
  const cfg = buildCFG('let x = 1; let y = 2;');
  const loops = cfg.detectLoops();
  assert.equal(loops.length, 0);
});

// ============================================================
// DOT export
// ============================================================

test('DOT export generates valid format', () => {
  const cfg = buildCFG('if (true) { let x = 1; }');
  const dot = cfg.toDot();
  assert.ok(dot.startsWith('digraph CFG'));
  assert.ok(dot.includes('->'));
  assert.ok(dot.endsWith('}\n'));
});

// ============================================================
// Complex programs
// ============================================================

test('function with if and return', () => {
  const cfg = buildCFG(`
    let x = 5;
    if (x > 3) {
      return x;
    }
    let y = x + 1;
  `);
  // Return in then-branch should connect to exit
  const exitBlock = cfg.blocks.get(cfg.exit);
  assert.ok(exitBlock.preds.length >= 1);
});

test('for-in loop creates loop structure', () => {
  const cfg = buildCFG('for (x in [1,2,3]) { puts(x); }');
  let condBlock = null;
  for (const [, block] of cfg.blocks) {
    if (block.label === 'for-cond') condBlock = block;
  }
  assert.ok(condBlock);
});

// ============================================================
// Report
// ============================================================

console.log(`\nCFG tests: ${passed}/${total} passed` + (failed ? ` (${failed} failed)` : ''));
if (failed) process.exit(1);
