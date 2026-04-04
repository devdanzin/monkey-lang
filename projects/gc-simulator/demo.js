#!/usr/bin/env node
// Interactive Cheney GC Demo
// Run: node demo.js

import { Heap, TAG, NIL } from './src/index.js';

function demo() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Cheney Semi-Space Garbage Collector Demo');
  console.log('═══════════════════════════════════════════════════\n');

  const h = new Heap(64);
  
  // Phase 1: Allocate some objects
  console.log('Phase 1: Allocating objects...\n');
  
  const int1 = h.allocInt(42);
  console.log(`  INT 42      → addr ${int1}`);
  
  const int2 = h.allocInt(99);
  console.log(`  INT 99      → addr ${int2}`);
  
  const str1 = h.allocString('hello');
  console.log(`  STR "hello" → addr ${str1}`);
  
  const pair1 = h.allocPair(int1, int2);
  console.log(`  PAIR(42,99) → addr ${pair1}`);
  
  const list = h.buildList([h.allocInt(1), h.allocInt(2), h.allocInt(3)]);
  console.log(`  LIST [1,2,3]→ addr ${list}`);
  
  console.log(`\n  Heap: ${h.usedWords}/${h.semiSpaceSize} words used (${(h.utilization * 100).toFixed(0)}%)`);
  console.log(`  Objects allocated: ${h.totalAllocated}`);

  // Phase 2: Root only some objects
  console.log('\nPhase 2: Setting roots...\n');
  
  const handle1 = h.pushRoot(pair1);
  console.log(`  Rooted: PAIR(42,99) at addr ${pair1}`);
  
  const handle2 = h.pushRoot(list);
  console.log(`  Rooted: LIST [1,2,3] at addr ${list}`);
  
  console.log(`  NOT rooted: STR "hello" at addr ${str1} (will be garbage)`);
  
  // Phase 3: Trigger GC
  console.log('\nPhase 3: Triggering garbage collection...\n');
  
  const usedBefore = h.usedWords;
  h.collect();
  const usedAfter = h.usedWords;
  
  console.log(`  GC complete!`);
  console.log(`  Before: ${usedBefore} words → After: ${usedAfter} words`);
  console.log(`  Reclaimed: ${usedBefore - usedAfter} words`);
  console.log(`  Objects copied: ${h.totalCopied}`);
  
  // Phase 4: Verify survivors
  console.log('\nPhase 4: Verifying survivors...\n');
  
  console.log(`  Pair moved: addr ${pair1} → addr ${handle1.value}`);
  console.log(`  Pair car: ${h.inspect(h.car(handle1.value))} (was 42)`);
  console.log(`  Pair cdr: ${h.inspect(h.cdr(handle1.value))} (was 99)`);
  
  console.log(`  List moved: addr ${list} → addr ${handle2.value}`);
  const arr = h.listToArray(handle2.value);
  console.log(`  List values: [${arr.map(a => h.intValue(a)).join(', ')}]`);
  
  // Phase 5: Cycle demo
  console.log('\nPhase 5: Cyclic structure demo...\n');
  
  const cycleNode = h.allocPair(h.allocInt(777), NIL);
  h.setCdr(cycleNode, cycleNode); // self-referential!
  const cycleHandle = h.pushRoot(cycleNode);
  
  console.log(`  Created cyclic pair: (777 . <self>)`);
  h.collect();
  console.log(`  Survived GC! cdr still points to self: ${h.cdr(cycleHandle.value) === cycleHandle.value}`);
  console.log(`  Value preserved: ${h.intValue(h.car(cycleHandle.value))}`);
  
  // Final stats
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Total allocations: ${h.totalAllocated}`);
  console.log(`  Total collections: ${h.totalCollections}`);
  console.log(`  Total copied:      ${h.totalCopied}`);
  console.log(`  Final heap usage:  ${h.usedWords}/${h.semiSpaceSize} words`);
  console.log('═══════════════════════════════════════════════════\n');
  
  handle1.release();
  handle2.release();
  cycleHandle.release();
}

demo();
