# GC Algorithms Research

uses: 1
created: 2026-04-03
topic: garbage-collection

## Algorithms Surveyed

### 1. Cheney Semi-Space (Copying GC)
- Divides heap into 2 equal semi-spaces (from-space, to-space)
- Copies live objects breadth-first from from-space to to-space
- Uses forwarding pointers to update references
- **Pro:** No fragmentation, bump allocation, pause proportional to live objects only
- **Con:** 50% memory overhead (half always empty)
- **Use case:** Young generation in generational GCs (V8, HotSpot)
- **Implementation notes:** BFS traversal using scan/alloc pointers = Cheney's trick. No stack needed.

### 2. Mark-Compact
- Mark phase (trace from roots), then compact (slide objects together)
- Operates on a single heap — no 50% overhead
- Must update ALL references after moving objects
- **Pro:** No fragmentation, full heap utilization
- **Con:** Expensive compaction, typically 2-3 passes over heap
- **Use case:** Old generation in JVM, CLR, GHC

### 3. Immix (Mark-Region)
- Heap → blocks (32KB) → lines (128 bytes)
- Objects bump-allocated within blocks, can span lines but not blocks
- **Mark phase:** trace roots, mark lines containing live objects
- **Reclamation:** free blocks with no live lines; recycle partially-free blocks
- **Defragmentation:** opportunistic evacuation — copies objects out of fragmented blocks DURING mark phase
- **Pro:** Fast allocation (bump pointer), no free-list overhead, handles fragmentation
- **Con:** Some internal fragmentation from line granularity
- **Key insight:** Conservative line marking (mark current + next line) simplifies boundary checks
- Paper: Blackburn & McKinley, PLDI 2008

### 4. Boehm Conservative GC
- Treats all pointer-sized values as potential pointers
- No type information needed — works with C/C++
- Can't move objects (might mistake integers for pointers)
- Mark-sweep only
- **Pro:** Drop-in for C/C++, no compiler cooperation needed
- **Con:** Memory leaks from false positives, can't compact, higher overhead

### 5. WASM GC Proposal
- Status: Phase 4, shipped in WASM 3.0 (Sep 2025)
- Browser support: Chrome 119+, Firefox 120+, Safari 18.2+
- Key idea: Let the host (browser) manage GC'd objects
- New types: struct, array, i31ref, externref
- Languages compile to WASM GC types → host GC handles them
- Avoids shipping language runtime + GC in WASM binary
- **Impact:** Kotlin/Wasm, Dart, Java can compile to much smaller WASM

## Comparison Matrix

| Algorithm | Memory Overhead | Fragmentation | Allocation Speed | Collection Cost | Moves Objects |
|-----------|----------------|---------------|-----------------|----------------|---------------|
| Cheney | 50% | None | Fast (bump) | O(live) | Yes |
| Mark-Compact | Low | None | Fast (bump) | O(heap) | Yes |
| Immix | Low | Low (lines) | Fast (bump) | O(live) | Optionally |
| Boehm | Low | High | Moderate (free-list) | O(heap) | No |
| WASM GC | N/A (host) | N/A (host) | Host-dependent | Host-dependent | Host-dependent |

## Implementation Ideas
- Cheney semi-space is simplest to implement (~200 LOC) — good first project
- Immix would be more interesting but needs careful memory layout
- Could build a mini-runtime with Cheney GC for the Monkey lang interpreter
- WASM GC is more of an integration exercise than algorithm implementation
