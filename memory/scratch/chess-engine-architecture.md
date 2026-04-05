# Chess Engine Architecture

uses: 1
created: 2026-04-05
status: active

## Key Insights

### Bitboard Representation
- Use BigInt for 64-bit bitboards (one per piece type per color)
- Move generation: compute attack masks, then filter for legality
- Immutable board: `makeMove()` returns new board (simpler, no undo needed)

### Search Stack
1. Iterative deepening (progressive depth)
2. Aspiration windows (±50cp from depth 4)
3. Principal Variation Search (PVS) — zero-window for non-PV moves
4. Late Move Reductions (graduated: 1-3 ply for late quiet moves)
5. Null move pruning (R=2-3 based on depth)
6. Check extensions (+1 ply)

### Move Ordering (critical for pruning efficiency)
1. TT best move
2. Captures (MVV-LVA scoring)
3. Killer moves (2 per ply)
4. History heuristic (color/from/to, cumulative across depths)

### Quiescence Search
- Only search captures + promotions at depth 0
- Delta pruning: skip if even best capture can't raise alpha
- Stand-pat evaluation as baseline

### Opening Book Design
- Store as Map: Zobrist hash → array of moves
- `addBookLine(['e2e4', 'e7e5', ...])` populates all positions in the line
- Random selection from book moves for variety

### UCI Protocol
- Stateless command processing: parse command → return response array
- Time management: allocate 1/30th of remaining time + increment
- Info output: depth, score (cp or mate), nodes, nps, pv

### Perft Testing
- Gold standard for move generator correctness
- Compare node counts at each depth against known values
- Divide perft helps isolate bugs (shows per-move counts)
