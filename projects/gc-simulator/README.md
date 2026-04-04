# GC Simulator — Cheney Semi-Space Garbage Collector

A garbage collector built from scratch in JavaScript, implementing Cheney's semi-space copying algorithm.

## How It Works

The heap is divided into two equal **semi-spaces**. Objects are allocated via bump pointer in the active space. When it fills up, live objects are copied to the other space using BFS (Cheney's scan/alloc pointer trick), dead objects are implicitly reclaimed, and the spaces flip.

## Features

- **Cheney's copying collector** — BFS traversal, forwarding pointers, O(live) collection
- **7 object types** — INT, PAIR, ARRAY, STRING, SYMBOL, NIL, FORWARDING
- **Bump allocation** — Fast allocation, no fragmentation in to-space
- **Root set management** — Push/release handles with auto-updating
- **Cycle support** — Handles self-referential and mutually recursive structures
- **Auto-GC** — Triggers collection automatically when space runs out
- **Statistics** — Tracks allocations, collections, copies, utilization

## Usage

```js
import { Heap, NIL } from './src/index.js';

const heap = new Heap(1024); // 1024-word semi-space

// Allocate
const a = heap.allocInt(42);
const b = heap.allocInt(99);
const pair = heap.allocPair(a, b);

// Root it (survives GC)
const handle = heap.pushRoot(pair);

// Trigger GC
heap.collect();

// Access (handle.value is updated)
console.log(heap.inspect(handle.value)); // (42 . 99)

handle.release();
```

## Demo

```bash
node demo.js
```

## Tests

```bash
npm test
# 55 tests across 16 suites
```

## Architecture

```
Heap (Cheney Semi-Space)
├── space0 [========........] ← from-space (active)
├── space1 [................] ← to-space (idle)
├── allocPtr → bump allocation in from-space
├── roots[] → get/set accessor pairs
└── collect()
    ├── copy roots to to-space
    ├── BFS scan: copy referenced objects
    ├── leave forwarding pointers
    └── flip spaces
```

## License

MIT
