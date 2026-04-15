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
