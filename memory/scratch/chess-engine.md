# Chess Engine Architecture

uses: 2
created: 2026-04-04

## Key Design Decisions

### Bitboards
- Use BigInt for 64-bit boards (one bit per square)
- Precompute knight and king attack tables at startup
- Sliding pieces (bishop/rook/queen) use on-the-fly ray generation
- `a1=0, b1=1, ..., h8=63` square mapping

### Move Generation
- Generate pseudo-legal moves, filter for legality (check if our king is still safe)
- Perft testing is THE validation method — count all leaf nodes at each depth
- Starting position: depth 1=20, 2=400, 3=8902, 4=197281, 5=4865609
- Kiwipete is the best test position — covers castling, en passant, promotions

### Search
- Alpha-beta negamax with iterative deepening
- MVV-LVA for move ordering (Most Valuable Victim - Least Valuable Attacker)
- Zobrist hashing for transposition table (O(1) lookup vs FEN string comparison)
- Null move pruning: skip turn, search at reduced depth, cut if score >= beta
- Late move reductions: reduce depth for late quiet moves in move list
- Quiescence search: resolve all captures before evaluating

### Performance Notes
- BigInt operations are ~5x slower than native int64
- FEN-based TT was fine for depth <5 but Zobrist is essential for deeper search
- ~15K NPS on M-series Mac at depth 5

## Lessons
- Always validate move generation with perft before adding search/eval
- En passant is the trickiest move to implement correctly
- Castling needs to check all squares between king and rook for attacks
- Position 5 from the perft wiki had wrong expected values in some sources — always verify
