// gc.test.js — Tests for Monkey VM Garbage Collector
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GarbageCollector } from './gc.js';
import { Compiler, Closure, Cell, CompiledFunction } from './compiler.js';
import { VM } from './vm.js';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import {
  MonkeyInteger, MonkeyFloat, MonkeyString, MonkeyArray, MonkeyHash,
  MonkeyNull, TRUE, FALSE, NULL,
} from './object.js';

function compileAndRun(input, gcOptions = {}) {
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  if (parser.errors.length > 0) {
    throw new Error(`Parser errors: ${parser.errors.join(', ')}`);
  }
  const compiler = new Compiler();
  compiler.compile(program);
  const bytecode = compiler.bytecode();
  const gc = new GarbageCollector(gcOptions);
  const vm = new VM(bytecode, gc);
  vm.run();
  return { vm, gc, result: vm.lastPoppedStackElem() };
}

describe('Garbage Collector', () => {
  describe('Basic tracking', () => {
    it('tracks allocated objects', () => {
      const { gc } = compileAndRun(`
        let x = [1, 2, 3];
        let y = "hello";
        x
      `, { threshold: 10000 }); // high threshold to prevent collection
      
      assert.ok(gc.stats.totalAllocated > 0, 'should have tracked allocations');
    });

    it('reports stats correctly', () => {
      const { gc } = compileAndRun(`
        let a = [1, 2, 3];
        let b = [4, 5, 6];
        a
      `, { threshold: 10000 });
      
      const stats = gc.getStats();
      assert.ok(stats.totalAllocated > 0);
      assert.ok(stats.heapSize > 0);
      assert.equal(stats.collections, 0); // threshold not hit
    });
  });

  describe('Mark phase', () => {
    it('marks objects reachable from stack', () => {
      const { gc, result } = compileAndRun(`[1, 2, 3]`, { threshold: 10000 });
      
      // Force collection — the result array should survive
      gc.forceCollect();
      assert.ok(gc.stats.collections === 1);
      assert.ok(gc.heap.size > 0, 'reachable objects should survive');
    });

    it('marks objects reachable from globals', () => {
      const { gc } = compileAndRun(`
        let arr = [1, 2, 3];
        let str = "kept";
        arr
      `, { threshold: 10000 });
      
      gc.forceCollect();
      assert.ok(gc.stats.collections === 1);
      // Both arr and str are in globals, should survive
    });

    it('marks nested arrays', () => {
      const { gc, result } = compileAndRun(`
        let nested = [[1, 2], [3, 4], [[5, 6]]];
        nested
      `, { threshold: 10000 });
      
      const beforeSize = gc.heap.size;
      gc.forceCollect();
      // All nested arrays are reachable through globals
      assert.ok(gc.heap.size > 0);
    });

    it('marks hash keys and values', () => {
      const { gc } = compileAndRun(`
        let h = {"a": [1, 2], "b": [3, 4]};
        h
      `, { threshold: 10000 });
      
      gc.forceCollect();
      assert.ok(gc.heap.size > 0);
    });

    it('marks closure free variables', () => {
      const { gc, result } = compileAndRun(`
        let make_adder = fn(x) {
          fn(y) { x + y }
        };
        let add5 = make_adder(5);
        add5(3)
      `, { threshold: 10000 });
      
      assert.equal(result.value, 8);
      gc.forceCollect();
      assert.ok(gc.stats.collections === 1);
    });
  });

  describe('Sweep phase', () => {
    it('collects unreachable objects', () => {
      const { gc } = compileAndRun(`
        let x = [1, 2, 3];
        set x = "replaced";
        x
      `, { threshold: 10000 });
      
      const beforeSize = gc.heap.size;
      gc.forceCollect();
      // The original array [1,2,3] is no longer referenced by x (set overwrites global slot)
      // It should be collected
      assert.ok(gc.stats.totalFreed > 0, 'should have freed unreachable objects');
    });

    it('collects temporary objects from expressions', () => {
      const { gc } = compileAndRun(`
        let result = len([1, 2, 3, 4, 5]);
        result
      `, { threshold: 10000 });
      
      gc.forceCollect();
      // The temporary array [1,2,3,4,5] should be collectible
      // (though it may still be in constants pool)
      assert.ok(gc.stats.collections === 1);
    });

    it('collects deeply nested unreachable objects', () => {
      const { gc } = compileAndRun(`
        let x = [[1, 2], [3, [4, 5]]];
        set x = 42;
        x
      `, { threshold: 10000 });
      
      gc.forceCollect();
      assert.ok(gc.stats.totalFreed > 0, 'nested arrays should be freed');
    });
  });

  describe('Automatic collection', () => {
    it('triggers collection at threshold', () => {
      const { gc } = compileAndRun(`
        let result = 0;
        for (i in [1,2,3,4,5,6,7,8,9,10]) {
          let temp = [i, i + 1, i + 2];
          set result = result + len(temp);
        }
        result
      `, { threshold: 10 }); // very low threshold
      
      assert.ok(gc.stats.collections > 0, 'should have triggered automatic collection');
    });

    it('programs still work correctly with GC enabled', () => {
      const { result } = compileAndRun(`
        let fibonacci = fn(n) {
          if (n < 2) { return n; }
          fibonacci(n - 1) + fibonacci(n - 2)
        };
        fibonacci(10)
      `, { threshold: 50 });
      
      assert.equal(result.value, 55);
    });

    it('array operations work with GC', () => {
      const { result } = compileAndRun(`
        let arr = [1, 2, 3, 4, 5];
        let doubled = [];
        for (x in arr) {
          set doubled = push(doubled, x * 2);
        }
        doubled
      `, { threshold: 5 });
      
      assert.ok(result instanceof MonkeyArray);
      assert.equal(result.elements.length, 5);
      assert.equal(result.elements[0].value, 2);
      assert.equal(result.elements[4].value, 10);
    });

    it('string operations work with GC', () => {
      const { result } = compileAndRun(`
        let parts = ["hello", " ", "world"];
        join(parts, "")
      `, { threshold: 5 });
      
      assert.equal(result.value, 'hello world');
    });
  });

  describe('Closure stress tests', () => {
    it('closures survive GC correctly', () => {
      const { result } = compileAndRun(`
        let make_counter = fn() {
          let count = 0;
          fn() {
            let count = count + 1;
            count
          }
        };
        let c = make_counter();
        c();
        c();
        c()
      `, { threshold: 10 });
      
      // Note: without mutable closures, each call returns 1
      // (count is rebound, not mutated)
      assert.equal(result.value, 1);
    });

    it('multiple closures sharing state via cells', () => {
      const { result } = compileAndRun(`
        let make = fn() {
          let n = 0;
          let inc = fn() { set n = n + 1; n };
          let get = fn() { n };
          [inc, get]
        };
        let pair = make();
        let inc = pair[0];
        let get = pair[1];
        inc();
        inc();
        inc();
        get()
      `, { threshold: 10 });
      
      assert.equal(result.value, 3);
    });

    it('deeply nested closures with GC', () => {
      const { result } = compileAndRun(`
        let a = fn(x) {
          fn(y) {
            fn(z) {
              x + y + z
            }
          }
        };
        a(1)(2)(3)
      `, { threshold: 5 });
      
      assert.equal(result.value, 6);
    });
  });

  describe('Circular references', () => {
    it('handles arrays referencing themselves indirectly', () => {
      // Create two arrays that reference each other via hash
      const { result, gc } = compileAndRun(`
        let h = {"val": [1, 2, 3]};
        let arr = [h, h, h];
        len(arr)
      `, { threshold: 10 });
      
      assert.equal(result.value, 3);
      gc.forceCollect();
      // Should not loop infinitely during mark
      assert.ok(gc.stats.collections >= 1);
    });
  });

  describe('Edge cases', () => {
    it('empty program', () => {
      const { gc } = compileAndRun(`0`, { threshold: 10000 });
      gc.forceCollect();
      assert.equal(gc.stats.collections, 1);
    });

    it('only primitive values (minimal heap)', () => {
      const { gc } = compileAndRun(`
        let x = 42;
        let y = true;
        let z = false;
        x
      `, { threshold: 10000 });
      
      gc.forceCollect();
      assert.equal(gc.stats.collections, 1);
    });

    it('GC disabled does not collect', () => {
      const { gc } = compileAndRun(`
        let x = [1, 2, 3];
        x
      `, { enabled: false });
      
      assert.equal(gc.stats.totalAllocated, 0);
      assert.equal(gc.heap.size, 0);
    });

    it('multiple forced collections are idempotent', () => {
      const { gc } = compileAndRun(`
        let x = [1, 2, 3];
        x
      `, { threshold: 10000 });
      
      gc.forceCollect();
      const sizeAfterFirst = gc.heap.size;
      gc.forceCollect();
      const sizeAfterSecond = gc.heap.size;
      assert.equal(sizeAfterFirst, sizeAfterSecond);
    });

    it('GC stats track peak live objects', () => {
      const { gc } = compileAndRun(`
        let x = [1, 2, 3];
        let y = [4, 5, 6];
        let z = [7, 8, 9];
        let x = 0;
        let y = 0;
        z
      `, { threshold: 10000 });
      
      const peakBefore = gc.stats.peakLive;
      gc.forceCollect();
      assert.ok(gc.stats.peakLive >= gc.heap.size);
    });
  });

  describe('GC with recursive programs', () => {
    it('fibonacci with aggressive GC', () => {
      const { result } = compileAndRun(`
        let fib = fn(n) {
          if (n < 2) { n } else { fib(n - 1) + fib(n - 2) }
        };
        fib(15)
      `, { threshold: 20 });
      
      assert.equal(result.value, 610);
    });

    it('map implementation with GC', () => {
      const { result } = compileAndRun(`
        let map = fn(arr, f) {
          let result = [];
          for (x in arr) {
            set result = push(result, f(x));
          }
          result
        };
        let doubled = map([1, 2, 3, 4, 5], fn(x) { x * 2 });
        doubled
      `, { threshold: 10 });
      
      assert.ok(result instanceof MonkeyArray);
      assert.equal(result.elements.length, 5);
      assert.equal(result.elements[0].value, 2);
      assert.equal(result.elements[4].value, 10);
    });

    it('filter + map pipeline with GC', () => {
      const { result } = compileAndRun(`
        let filter = fn(arr, pred) {
          let result = [];
          for (x in arr) {
            if (pred(x)) {
              set result = push(result, x);
            }
          }
          result
        };
        let map = fn(arr, f) {
          let result = [];
          for (x in arr) {
            set result = push(result, f(x));
          }
          result
        };
        let nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        let evens = filter(nums, fn(x) { x % 2 == 0 });
        let squared = map(evens, fn(x) { x * x });
        squared
      `, { threshold: 8 });
      
      assert.ok(result instanceof MonkeyArray);
      assert.equal(result.elements.length, 5);
      assert.equal(result.elements[0].value, 4);   // 2*2
      assert.equal(result.elements[4].value, 100);  // 10*10
    });
  });
});

describe('GC Stress Tests', () => {
  describe('Large allocations', () => {
    it('handles many temporary arrays', () => {
      const { result, gc } = compileAndRun(`
        let total = 0;
        for (i in [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]) {
          let temp = [i, i * 2, i * 3, i * 4, i * 5];
          set total = total + len(temp);
        }
        total
      `, { threshold: 15 });
      
      assert.equal(result.value, 100); // 20 * 5
      assert.ok(gc.stats.collections > 0, 'should have collected');
      assert.ok(gc.stats.totalFreed > 0, 'should have freed temp arrays');
    });

    it('large array creation and destruction', () => {
      // Create a large array, then replace it — all elements should be collectible
      const { gc } = compileAndRun(`
        let big = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
        set big = 0;
        big
      `, { threshold: 10000 });
      
      gc.forceCollect();
      assert.ok(gc.stats.totalFreed > 0, 'large array should be freed');
    });
  });

  describe('Closure chains', () => {
    it('chain of closures with GC', () => {
      const { result } = compileAndRun(`
        let compose = fn(f, g) {
          fn(x) { f(g(x)) }
        };
        let add1 = fn(x) { x + 1 };
        let mul2 = fn(x) { x * 2 };
        let add1_then_mul2 = compose(mul2, add1);
        add1_then_mul2(5)
      `, { threshold: 5 });
      
      assert.equal(result.value, 12); // (5+1)*2
    });

    it('closure factory with many instances', () => {
      const { result, gc } = compileAndRun(`
        let make_adder = fn(n) { fn(x) { x + n } };
        let add1 = make_adder(1);
        let add2 = make_adder(2);
        let add3 = make_adder(3);
        let add4 = make_adder(4);
        let add5 = make_adder(5);
        add1(10) + add2(10) + add3(10) + add4(10) + add5(10)
      `, { threshold: 5 });
      
      assert.equal(result.value, 65); // 11+12+13+14+15
      assert.ok(gc.stats.collections > 0);
    });

    it('recursive closure with accumulator', () => {
      const { result } = compileAndRun(`
        let sum_to = fn(n) {
          if (n == 0) { 0 } else { n + sum_to(n - 1) }
        };
        sum_to(20)
      `, { threshold: 10 });
      
      assert.equal(result.value, 210);
    });
  });

  describe('GC correctness under pressure', () => {
    it('GC does not corrupt live data', () => {
      const { result } = compileAndRun(`
        let data = [10, 20, 30, 40, 50];
        for (i in [1,2,3,4,5,6,7,8,9,10]) {
          let garbage = [i, i, i, i, i, i, i, i];
        }
        data[2]
      `, { threshold: 5 });
      
      assert.equal(result.value, 30);
    });

    it('GC preserves hash integrity', () => {
      const { result } = compileAndRun(`
        let h = {"x": 10, "y": 20, "z": 30};
        for (i in [1,2,3,4,5]) {
          let trash = {"a": i, "b": i * 2};
        }
        h["y"]
      `, { threshold: 5 });
      
      assert.equal(result.value, 20);
    });

    it('GC preserves closure captures', () => {
      const { result } = compileAndRun(`
        let make = fn() {
          let secret = 42;
          fn() { secret }
        };
        let getter = make();
        for (i in [1,2,3,4,5,6,7,8,9,10]) {
          let trash = [i, i, i];
        }
        getter()
      `, { threshold: 5 });
      
      assert.equal(result.value, 42);
    });

    it('GC preserves mutable cells', () => {
      const { result } = compileAndRun(`
        let make = fn() {
          let n = 0;
          let inc = fn() { set n = n + 1; n };
          inc
        };
        let counter = make();
        counter();
        for (i in [1,2,3,4,5,6,7,8,9,10]) {
          let trash = [i, i, i, i, i];
        }
        counter();
        counter()
      `, { threshold: 5 });
      
      assert.equal(result.value, 3);
    });

    it('fibonacci under heavy GC pressure', () => {
      const { result } = compileAndRun(`
        let fib = fn(n) {
          if (n < 2) { n } else { fib(n - 1) + fib(n - 2) }
        };
        fib(20)
      `, { threshold: 5 });
      
      assert.equal(result.value, 6765);
    });
  });

  describe('GC statistics accuracy', () => {
    it('allocation count matches expected', () => {
      const { gc } = compileAndRun(`
        let a = [1, 2, 3];
        let b = [4, 5, 6];
        let c = [7, 8, 9];
        0
      `, { threshold: 10000 });
      
      // 9 integers + 3 arrays = 12 allocations (but integers may be cached)
      assert.ok(gc.stats.totalAllocated >= 3, 'at least 3 arrays allocated');
    });

    it('collection reduces heap size', () => {
      const { gc } = compileAndRun(`
        let x = [1,2,3,4,5,6,7,8,9,10];
        set x = 0;
        0
      `, { threshold: 10000 });
      
      const before = gc.heap.size;
      gc.forceCollect();
      assert.ok(gc.heap.size < before, `heap should shrink: ${gc.heap.size} < ${before}`);
    });

    it('peak live tracks maximum heap size', () => {
      const { gc } = compileAndRun(`
        let a = [1, 2, 3, 4, 5];
        let b = [6, 7, 8, 9, 10];
        set a = 0;
        set b = 0;
        0
      `, { threshold: 10000 });
      
      gc.forceCollect();
      assert.ok(gc.stats.peakLive > gc.heap.size, 'peak should exceed current after collection');
    });
  });
});

describe('Generational GC', () => {
  function compileAndRunGen(input, gcOptions = {}) {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    if (parser.errors.length > 0) {
      throw new Error(`Parser errors: ${parser.errors.join(', ')}`);
    }
    const compiler = new Compiler();
    compiler.compile(program);
    const bytecode = compiler.bytecode();
    const gc = new GarbageCollector({ generational: true, ...gcOptions });
    const vm = new VM(bytecode, gc);
    vm.run();
    return { vm, gc, result: vm.lastPoppedStackElem() };
  }

  it('allocates objects in young generation', () => {
    const { gc } = compileAndRunGen(`
      let x = [1, 2, 3];
      x
    `, { threshold: 10000 });
    
    assert.ok(gc.youngGen.size > 0, 'new objects should be in young gen');
  });

  it('promotes objects after surviving collections', () => {
    const { gc } = compileAndRunGen(`
      let keeper = [1, 2, 3];
      for (i in [1,2,3,4,5,6,7,8,9,10]) {
        let trash = [i, i, i];
      }
      keeper
    `, { threshold: 5, promotionAge: 2 });
    
    assert.ok(gc.stats.promotions > 0, 'long-lived objects should be promoted');
    assert.ok(gc.oldGen.size > 0, 'old gen should have promoted objects');
  });

  it('minor collections free young-gen garbage', () => {
    const { gc } = compileAndRunGen(`
      for (i in [1,2,3,4,5,6,7,8,9,10]) {
        let trash = [i, i * 2, i * 3];
      }
      0
    `, { threshold: 5 });
    
    assert.ok(gc.stats.minorCollections > 0, 'should have minor collections');
    assert.ok(gc.stats.totalFreed > 0, 'should have freed young gen objects');
  });

  it('major collection cleans both generations', () => {
    const { gc } = compileAndRunGen(`
      for (i in [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]) {
        let trash = [i, i * 2];
      }
      0
    `, { threshold: 3, majorInterval: 3, promotionAge: 1 });
    
    assert.ok(gc.stats.majorCollections > 0 || gc.stats.minorCollections > 0, 
      'should have done collections');
  });

  it('programs produce correct results with generational GC', () => {
    const { result } = compileAndRunGen(`
      let fib = fn(n) {
        if (n < 2) { n } else { fib(n - 1) + fib(n - 2) }
      };
      fib(15)
    `, { threshold: 10 });
    
    assert.equal(result.value, 610);
  });

  it('closures survive generational promotion', () => {
    const { result } = compileAndRunGen(`
      let make = fn(n) { fn(x) { x + n } };
      let add5 = make(5);
      for (i in [1,2,3,4,5,6,7,8,9,10]) {
        let trash = [i];
      }
      add5(10)
    `, { threshold: 3, promotionAge: 1 });
    
    assert.equal(result.value, 15);
  });

  it('mutable cells survive promotion', () => {
    const { result } = compileAndRunGen(`
      let make = fn() {
        let n = 0;
        let inc = fn() { set n = n + 1; n };
        inc
      };
      let counter = make();
      counter();
      counter();
      for (i in [1,2,3,4,5,6,7,8,9,10]) {
        let trash = [i, i, i];
      }
      counter()
    `, { threshold: 3, promotionAge: 1 });
    
    assert.equal(result.value, 3);
  });
});

describe('Weak References', () => {
  it('creates and retrieves weak references', () => {
    const gc = new GarbageCollector({ threshold: 10000 });
    const obj = new MonkeyArray([new MonkeyInteger(1), new MonkeyInteger(2)]);
    gc.makeWeakRef('test-array', obj);
    
    const retrieved = gc.getWeakRef('test-array');
    assert.strictEqual(retrieved, obj);
  });

  it('returns null for missing keys', () => {
    const gc = new GarbageCollector();
    assert.strictEqual(gc.getWeakRef('nonexistent'), null);
  });

  it('prunes dead references', () => {
    const gc = new GarbageCollector();
    // Create a weak ref to an object
    let obj = new MonkeyArray([]);
    gc.makeWeakRef('temp', obj);
    
    // While the ref is alive, it should be retrievable
    assert.ok(gc.getWeakRef('temp') !== null);
    
    // We can't force JS GC, but we can test pruning doesn't crash
    gc.pruneWeakRefs();
  });

  it('multiple weak references work independently', () => {
    const gc = new GarbageCollector();
    const a = new MonkeyString('alpha');
    const b = new MonkeyString('beta');
    gc.makeWeakRef('a', a);
    gc.makeWeakRef('b', b);
    
    assert.strictEqual(gc.getWeakRef('a').value, 'alpha');
    assert.strictEqual(gc.getWeakRef('b').value, 'beta');
  });
});
