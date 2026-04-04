# Garbage Collector Simulator

Three garbage collection algorithms implemented from scratch in JavaScript, sharing a common object/heap layout:

1. **Cheney Semi-Space** — copying collector with two semi-spaces
2. **Mark-Compact** — in-place compaction with mark + slide phases
3. **Generational** — nursery (semi-space) + tenured (mark-compact) with write barrier

## Architecture

### Object Layout

All three collectors share the same object representation:

```
[tag:1][size:1][field0][field1]...[fieldN-1]
```

Tags: INT, PAIR, ARRAY, STRING, NIL, SYMBOL, FORWARDING (used during GC)

### Cheney Semi-Space (`Heap`)

The classic copying collector:
- Two equally-sized semi-spaces (from-space and to-space)
- Allocation bumps a pointer in from-space
- When full: BFS copy reachable objects to to-space, swap spaces
- **O(live objects)** collection time — dead objects are free to skip

### Mark-Compact (`MarkCompactHeap`)

In-place compaction in three phases:
1. **Mark**: DFS from roots, mark all reachable objects in a bitmap
2. **Compute forwarding**: linear scan, assign new addresses to live objects
3. **Update + Compact**: update all pointers to new addresses, slide objects to front

Advantages over semi-space: no wasted half-space, better cache locality.

### Generational (`GenerationalHeap`)

The V8/HotSpot approach:
- **Nursery**: small semi-space for young objects (fast Cheney collection)
- **Tenured**: large space for long-lived objects (mark-compact collection)
- **Promotion**: objects surviving `promotionAge` nursery collections move to tenured
- **Write barrier**: tracks tenured→nursery pointers in a remembered set

Based on the generational hypothesis: most objects die young.

## Usage

```javascript
import { Heap } from './src/heap.js';
import { MarkCompactHeap } from './src/mark-compact.js';
import { GenerationalHeap } from './src/generational.js';

// Cheney Semi-Space
const heap = new Heap(1024);
const a = heap.allocInt(42);
const b = heap.allocPair(a, -1); // -1 = NIL
let root = b;
heap.addRoot(() => root, (addr) => { root = addr; });
heap.collect(); // Cheney collection
console.log(heap.getInt(heap.getCar(root))); // 42

// Mark-Compact
const mc = new MarkCompactHeap(2048);
// Same API as Heap

// Generational
const gen = new GenerationalHeap(256, 1024, 2);
// Objects start in nursery, get promoted after 2 collections
```

## Tests

```bash
npm test    # 82 tests across 3 collectors
```

Covers:
- Basic allocation: int, pair, array, string, nil, symbol
- Collection: garbage reclamation, root preservation, chain preservation
- Circular references
- Compaction (objects slide to front)
- Promotion (nursery → tenured after surviving N collections)
- Write barrier (tenured → nursery pointer tracking)
- Stress tests (many alloc/collect cycles)
- Stats tracking

## Collector Comparison

| Collector | Space Overhead | Collection Time | Fragmentation | Best For |
|-----------|---------------|-----------------|---------------|----------|
| Cheney Semi-Space | 2x (two semi-spaces) | O(live) | None (compacting) | Simple, predictable |
| Mark-Compact | 1x (bitmap + forwarding) | O(heap) | None (compacting) | Memory-constrained |
| Generational | ~1.5x | O(nursery) amortized | None | General purpose |

## References

- Cheney, C.J. (1970). "A Nonrecursive List Compacting Algorithm"
- Jones, Hosking, Moss. "The Garbage Collection Handbook" (2011)
- V8 Blog: "Trash talk: the Orinoco garbage collector"
