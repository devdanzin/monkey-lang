// gc.js — Mark-Sweep Garbage Collector for Monkey VM
//
// Design:
//   - All heap objects get registered with the GC on creation
//   - Root set: VM stack, globals, frame closures, free variables
//   - Mark phase: traverse from roots, mark all reachable objects
//   - Sweep phase: free all unmarked objects
//   - Trigger: allocation count threshold (configurable)
//
// Object graph edges:
//   - MonkeyArray → elements[]
//   - MonkeyHash → pairs (keys + values)
//   - Closure → fn (constants), free[]
//   - Cell → value
//
// This is educational — JS has its own GC, but implementing mark-sweep
// teaches the concepts and gives us control over memory pressure.

import {
  MonkeyInteger, MonkeyFloat, MonkeyString, MonkeyBoolean,
  MonkeyArray, MonkeyHash, MonkeyNull, MonkeyError, MonkeyBuiltin,
  TRUE, FALSE, NULL,
} from './object.js';
import { Closure, Cell, CompiledFunction } from './compiler.js';

// Mark bit symbol — attached to objects during mark phase
const MARK = Symbol('gc_mark');

export class GarbageCollector {
  constructor(options = {}) {
    // All tracked heap objects (WeakRef to avoid preventing JS GC)
    this.heap = new Set();       // Set of live objects
    this.threshold = options.threshold || 1024;  // allocations before GC triggers
    this.allocationsSinceGC = 0;
    this.enabled = options.enabled !== false;
    this.verbose = options.verbose || false;
    
    // Statistics
    this.stats = {
      collections: 0,
      totalAllocated: 0,
      totalFreed: 0,
      currentLive: 0,
      peakLive: 0,
      markTime: 0,
      sweepTime: 0,
    };
    
    // VM reference (set when VM registers with GC)
    this.vm = null;
    
    // Immortal objects that should never be collected
    this.immortals = new Set([TRUE, FALSE, NULL]);
  }

  /**
   * Register the VM instance with the GC.
   */
  attach(vm) {
    this.vm = vm;
  }

  /**
   * Track a new heap allocation.
   * Called whenever the VM creates a new object.
   * Returns the object (for chaining).
   */
  track(obj) {
    if (!this.enabled) return obj;
    if (this.immortals.has(obj)) return obj;
    
    // Only track compound objects (not cached integers, singletons)
    if (obj instanceof MonkeyArray || obj instanceof MonkeyHash ||
        obj instanceof MonkeyString || obj instanceof MonkeyError ||
        obj instanceof Closure || obj instanceof Cell ||
        obj instanceof MonkeyInteger || obj instanceof MonkeyFloat) {
      this.heap.add(obj);
      this.stats.totalAllocated++;
      this.stats.currentLive = this.heap.size;
      if (this.heap.size > this.stats.peakLive) {
        this.stats.peakLive = this.heap.size;
      }
      
      this.allocationsSinceGC++;
      if (this.allocationsSinceGC >= this.threshold) {
        this.collect();
      }
    }
    
    return obj;
  }

  /**
   * Run a full mark-sweep collection.
   */
  collect() {
    if (!this.vm) return;
    
    const markStart = performance.now();
    
    // Mark phase
    this.mark();
    
    const markEnd = performance.now();
    
    // Sweep phase
    const freed = this.sweep();
    
    const sweepEnd = performance.now();
    
    this.stats.collections++;
    this.stats.totalFreed += freed;
    this.stats.currentLive = this.heap.size;
    this.stats.markTime += markEnd - markStart;
    this.stats.sweepTime += sweepEnd - markEnd;
    this.allocationsSinceGC = 0;
    
    if (this.verbose) {
      console.log(`[GC] Collection #${this.stats.collections}: freed ${freed} objects, ${this.heap.size} live (${(markEnd - markStart).toFixed(2)}ms mark, ${(sweepEnd - markEnd).toFixed(2)}ms sweep)`);
    }
  }

  /**
   * Mark phase: traverse from roots and mark all reachable objects.
   */
  mark() {
    // Clear all marks
    for (const obj of this.heap) {
      obj[MARK] = false;
    }
    
    // Mark from roots
    // 1. Stack
    for (let i = 0; i < this.vm.sp; i++) {
      this.markObject(this.vm.stack[i]);
    }
    
    // 2. Globals
    for (let i = 0; i < this.vm.globals.length; i++) {
      if (this.vm.globals[i] !== undefined) {
        this.markObject(this.vm.globals[i]);
      }
    }
    
    // 3. Call frames (closures and their free variables)
    for (let i = 0; i < this.vm.framesIndex; i++) {
      const frame = this.vm.frames[i];
      if (frame) {
        this.markObject(frame.closure);
      }
    }
    
    // 4. Constants pool
    for (const c of this.vm.constants) {
      this.markObject(c);
    }
  }

  /**
   * Recursively mark an object and all objects it references.
   */
  markObject(obj) {
    if (obj === null || obj === undefined) return;
    if (this.immortals.has(obj)) return;
    
    // Already marked? Skip (prevents infinite loops on circular refs)
    if (obj[MARK] === true) return;
    
    // Mark it
    obj[MARK] = true;
    
    // Trace references
    if (obj instanceof MonkeyArray) {
      for (const elem of obj.elements) {
        this.markObject(elem);
      }
    } else if (obj instanceof MonkeyHash) {
      for (const [key, value] of obj.pairs) {
        this.markObject(key);
        this.markObject(value);
      }
    } else if (obj instanceof Closure) {
      // Mark free variables
      if (obj.free) {
        for (const freeVar of obj.free) {
          this.markObject(freeVar);
        }
      }
      // Mark constants in the compiled function
      if (obj.fn && obj.fn.constants) {
        for (const c of obj.fn.constants) {
          this.markObject(c);
        }
      }
    } else if (obj instanceof Cell) {
      this.markObject(obj.value);
    }
    // MonkeyInteger, MonkeyFloat, MonkeyString, MonkeyBoolean, MonkeyNull,
    // MonkeyError, MonkeyBuiltin — no outgoing references
  }

  /**
   * Sweep phase: remove all unmarked objects from the heap.
   * Returns the number of objects freed.
   */
  sweep() {
    let freed = 0;
    for (const obj of this.heap) {
      if (!obj[MARK]) {
        this.heap.delete(obj);
        // Clean up the mark symbol
        delete obj[MARK];
        freed++;
      } else {
        // Clean up mark for next cycle
        delete obj[MARK];
      }
    }
    return freed;
  }

  /**
   * Force a collection regardless of threshold.
   */
  forceCollect() {
    this.collect();
  }

  /**
   * Get GC statistics.
   */
  getStats() {
    return {
      ...this.stats,
      heapSize: this.heap.size,
      allocationsSinceGC: this.allocationsSinceGC,
      threshold: this.threshold,
    };
  }

  /**
   * Reset GC state (for testing).
   */
  reset() {
    this.heap.clear();
    this.allocationsSinceGC = 0;
    this.stats = {
      collections: 0,
      totalAllocated: 0,
      totalFreed: 0,
      currentLive: 0,
      peakLive: 0,
      markTime: 0,
      sweepTime: 0,
    };
  }
}
