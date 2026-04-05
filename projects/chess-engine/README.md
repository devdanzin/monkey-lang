# HenryChess ♔

A chess engine built from scratch in JavaScript. No dependencies. No chess libraries. Just bitboards, alpha-beta search, and determination.

## Features

### Board Representation
- **Bitboard-based** — 64-bit BigInt bitboards for each piece type and color
- Full FEN parsing and generation
- Legal move generation with pin detection and check evasion
- En passant, castling, promotion (all 4 piece types)

### Search
- **Iterative deepening** with aspiration windows
- **Alpha-beta pruning** with Principal Variation Search (PVS)
- **Transposition table** with Zobrist hashing
- **Null move pruning** (R=2/3 adaptive)
- **Late Move Reductions** (graduated, 1-3 ply)
- **Quiescence search** with delta pruning and SEE-like capture filtering
- **Killer move heuristic** (2 per ply)
- **History heuristic** (color/from/to, cumulative)
- **Move ordering**: TT move → captures (MVV-LVA) → killers → history
- **Check extensions** (+1 ply when in check)

### Evaluation
- Material counting with standard piece values
- Piece-square tables (opening + endgame)
- Mobility evaluation
- King safety
- Pawn structure (doubled, isolated, passed pawns)

### Opening Book
- 12-line ECO book (Italian, Ruy Lopez, Sicilian, French, Queen's Gambit, King's Indian, English, Caro-Kann, Scotch, Pirc, London, Nimzo-Indian)
- Randomized selection for variety

### Notation & PGN
- Standard Algebraic Notation (SAN) with disambiguation
- PGN export and import
- Game history with undo
- Checkmate and stalemate detection

## Architecture

```
src/
├── board.js         — Bitboard representation, move generation
├── eval.js          — Position evaluation
├── search.js        — Alpha-beta search engine
├── zobrist.js       — Zobrist hashing for transposition table
├── pgn.js           — SAN notation, PGN export/import, Game class
├── uci.js           — UCI protocol (use with any chess GUI)
├── play.js          — Interactive CLI game
├── selfplay.js      — Engine self-play and benchmarking
└── *.test.js        — 186 tests
```

## Usage

### Play Against the Engine
```bash
node src/play.js                    # Play as white
node src/play.js --black            # Play as black
node src/play.js --depth 6          # Stronger (slower)
node src/play.js --time 5000        # 5 seconds per move
node src/play.js --ascii            # ASCII pieces instead of Unicode
```

**Commands during play:**
- Type moves in SAN (`Nf3`, `e4`, `O-O`) or UCI (`g1f3`, `e2e4`)
- `hint` — get engine suggestion
- `moves` — show all legal moves
- `undo` — take back last move pair
- `pgn` — show PGN of current game
- `new` — start a new game
- `quit` — exit

### UCI Protocol (for GUIs)
```bash
node src/uci.js
```
Compatible with Arena, CuteChess, Lucas Chess, and other UCI GUIs.

### Self-Play
```bash
node src/selfplay.js game           # Watch one game
node src/selfplay.js tournament 10  # 10-game match
node src/selfplay.js bench          # Performance benchmark
```

### Programmatic API
```javascript
import { Board, STARTING_FEN } from './src/board.js';
import { SearchEngine } from './src/search.js';
import { Game, moveToSAN } from './src/pgn.js';

// Search for best move
const engine = new SearchEngine();
const board = Board.fromFEN(STARTING_FEN);
const result = engine.search(board, { depth: 6, timeLimit: 5000 });
console.log(`Best: ${Board.moveToUCI(result.move)} (${result.score}cp, depth ${result.depth})`);

// Play a game
const game = new Game();
game.play('e4');
game.play('e5');
game.play('Nf3');
console.log(game.toPGN());
```

## Move Generation Correctness (Perft)

All perft positions verified to depth 4-5:

| Position | Depth | Nodes | Expected | ✓ |
|----------|-------|-------|----------|---|
| Starting | 4 | 197,281 | 197,281 | ✅ |
| Starting | 5 | 4,865,609 | 4,865,609 | ✅ |
| Kiwipete | 4 | 4,085,603 | 4,085,603 | ✅ |
| Position 3 | 5 | 674,624 | 674,624 | ✅ |
| Position 4 | 4 | 422,333 | 422,333 | ✅ |
| Position 5 | 4 | 2,103,487 | 2,103,487 | ✅ |

## Tests

```bash
node --test src/*.test.js
```

186 tests across 7 test files:
- **board.test.js** (31) — Board representation, move generation, FEN
- **eval.test.js** (19) — Evaluation function
- **search.test.js** (30) — Search, TT, opening book, PV
- **perft.test.js** (34) — Move generation correctness
- **pgn.test.js** (30) — SAN, PGN, Game class
- **uci.test.js** (20) — UCI protocol
- **play.test.js** (13) — Interactive game, board display
- **selfplay.test.js** (9) — Self-play, tournament

## Design Decisions

- **Pure JavaScript, no dependencies** — Everything from scratch for learning
- **Bitboards over mailbox** — More complex but much faster for move generation
- **Immutable board** — `makeMove` returns a new board (simpler, no undo needed)
- **Generator-less search** — Simple recursive alpha-beta rather than iterators
- **Separate evaluation** — Easy to experiment with different eval functions

## What's Missing (Future Work)

- [ ] Endgame tablebases (Syzygy)
- [ ] NNUE evaluation
- [ ] Multi-PV analysis
- [ ] Pondering (think on opponent's time)
- [ ] Extended opening book (polyglot format)
- [ ] Time management improvements
- [ ] Razoring and futility pruning
- [ ] SEE (Static Exchange Evaluation) for capture pruning

## License

MIT
