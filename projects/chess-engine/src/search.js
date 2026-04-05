// search.js — Alpha-beta search with iterative deepening
// Features: TT, quiescence, null move pruning, LMR, killer moves,
// history heuristic, aspiration windows, check extensions, PV tracking

import { Board, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, iterBits } from './board.js';
import { evaluate } from './eval.js';
import { computeHash } from './zobrist.js';

const INFINITY = 1000000;
const MATE_SCORE = 100000;

// ===== Piece Values for MVV-LVA =====
const PIECE_VALUES = [100, 320, 330, 500, 900, 20000]; // P, N, B, R, Q, K

function mvvLva(move) {
  if (move.capture !== undefined) {
    return PIECE_VALUES[move.capture] * 10 - PIECE_VALUES[move.piece];
  }
  if (move.promotion !== undefined) return PIECE_VALUES[move.promotion];
  return 0;
}

// ===== Transposition Table =====
class TTable {
  constructor(size = 1 << 20) {
    this.size = size;
    this.table = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  hash(board) { return computeHash(board); }

  get(board) {
    const entry = this.table.get(this.hash(board));
    if (entry) { this.hits++; return entry; }
    this.misses++;
    return null;
  }

  set(board, entry) {
    const key = this.hash(board);
    const existing = this.table.get(key);
    // Replace if deeper or same depth
    if (!existing || entry.depth >= existing.depth) {
      if (this.table.size >= this.size) {
        // Evict oldest entries
        const keys = [...this.table.keys()];
        for (let i = 0; i < keys.length / 4; i++) this.table.delete(keys[i]);
      }
      this.table.set(key, entry);
    }
  }

  clear() { this.table.clear(); this.hits = 0; this.misses = 0; }
}

const TT_EXACT = 0;
const TT_ALPHA = 1;
const TT_BETA = 2;

// ===== Opening Book =====
// Small ECO-based opening book: FEN hash → [move, ...]
const OPENING_BOOK = new Map();
function addBookLine(moves) {
  let board = Board.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const bookMoves = [];
  for (const uci of moves) {
    const move = board.findMoveFromUCI(uci);
    if (!move) break;
    const hash = computeHash(board);
    if (!OPENING_BOOK.has(hash)) OPENING_BOOK.set(hash, []);
    const entry = OPENING_BOOK.get(hash);
    if (!entry.some(m => m.from === move.from && m.to === move.to))
      entry.push(move);
    board = board.makeMove(move);
  }
}

// Italian Game
addBookLine(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5']);
// Ruy Lopez
addBookLine(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6']);
// Sicilian Defense
addBookLine(['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3']);
// French Defense
addBookLine(['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6']);
// Queen's Gambit
addBookLine(['d2d4', 'd7d5', 'c2c4', 'e7e6', 'b1c3', 'g8f6', 'c4d5', 'e6d5']);
// King's Indian
addBookLine(['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6']);
// English Opening
addBookLine(['c2c4', 'e7e5', 'b1c3', 'g8f6']);
// Caro-Kann
addBookLine(['e2e4', 'c7c6', 'd2d4', 'd7d5', 'b1c3', 'd5e4', 'c3e4']);
// Scotch Game
addBookLine(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4', 'e5d4', 'f3d4']);
// Pirc Defense
addBookLine(['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6']);
// London System
addBookLine(['d2d4', 'g8f6', 'c1f4', 'd7d5', 'e2e3', 'e7e6', 'g1f3']);
// Nimzo-Indian
addBookLine(['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4']);

// ===== Search Engine =====
export class SearchEngine {
  constructor() {
    this.tt = new TTable();
    this.nodes = 0;
    this.qNodes = 0;
    this.maxDepth = 0;
    this.startTime = 0;
    this.timeLimit = 0;
    this.stopped = false;
    this.useBook = true;

    // Killer moves: [ply][slot] — two per ply
    this.killers = Array.from({ length: 128 }, () => [null, null]);

    // History heuristic: [color][from][to]
    this.history = [
      Array.from({ length: 64 }, () => new Int32Array(64)),
      Array.from({ length: 64 }, () => new Int32Array(64)),
    ];

    // PV table
    this.pvTable = Array.from({ length: 128 }, () => []);
    this.pvLength = new Int32Array(128);
  }

  _isEndgame(board) {
    return board.pieces[0][QUEEN] === 0n && board.pieces[1][QUEEN] === 0n;
  }

  _clearHistory() {
    for (let c = 0; c < 2; c++)
      for (let f = 0; f < 64; f++)
        this.history[c][f].fill(0);
  }

  _clearKillers() {
    for (let i = 0; i < 128; i++) this.killers[i] = [null, null];
  }

  _storeKiller(ply, move) {
    if (move.capture !== undefined) return; // only quiet moves
    if (this.killers[ply][0] &&
        this.killers[ply][0].from === move.from &&
        this.killers[ply][0].to === move.to) return;
    this.killers[ply][1] = this.killers[ply][0];
    this.killers[ply][0] = move;
  }

  _updateHistory(color, move, depth) {
    if (move.capture !== undefined) return;
    this.history[color][move.from][move.to] += depth * depth;
    // Prevent overflow
    if (this.history[color][move.from][move.to] > 1000000) {
      for (let f = 0; f < 64; f++)
        for (let t = 0; t < 64; t++)
          this.history[color][f][t] >>= 1;
    }
  }

  // Enhanced move ordering: TT > captures (MVV-LVA) > killers > history
  _orderMoves(moves, ttMove, ply, color) {
    const scored = moves.map(m => {
      let score = 0;
      if (ttMove && m.from === ttMove.from && m.to === ttMove.to &&
          m.promotion === ttMove.promotion) {
        score = 10000000;
      } else if (m.capture !== undefined) {
        score = 5000000 + mvvLva(m);
      } else if (m.promotion !== undefined) {
        score = 4000000 + PIECE_VALUES[m.promotion];
      } else if (this.killers[ply]?.[0] &&
                 this.killers[ply][0].from === m.from &&
                 this.killers[ply][0].to === m.to) {
        score = 3000000;
      } else if (this.killers[ply]?.[1] &&
                 this.killers[ply][1].from === m.from &&
                 this.killers[ply][1].to === m.to) {
        score = 2000000;
      } else {
        score = this.history[color][m.from][m.to];
      }
      return { move: m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.move);
  }

  // Quiescence search — resolve captures to avoid horizon effect
  quiescence(board, alpha, beta, ply) {
    this.nodes++;
    this.qNodes++;

    const standPat = evaluate(board);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    // Delta pruning: if even capturing the best piece can't raise alpha, skip
    const DELTA = 975; // queen value + margin
    if (standPat + DELTA < alpha) return alpha;

    const moves = board.generateLegalMoves();
    const captures = moves.filter(m => m.capture !== undefined || m.promotion !== undefined);

    // Sort by MVV-LVA
    captures.sort((a, b) => mvvLva(b) - mvvLva(a));

    for (const move of captures) {
      // SEE pruning: skip captures that lose material (simplified)
      if (move.capture !== undefined && PIECE_VALUES[move.capture] + 200 < PIECE_VALUES[move.piece] &&
          move.promotion === undefined) {
        // Likely bad capture (e.g., queen takes defended pawn)
        // Only skip if it's clearly bad
        if (PIECE_VALUES[move.capture] + 400 < PIECE_VALUES[move.piece]) continue;
      }

      const newBoard = board.makeMove(move);
      const score = -this.quiescence(newBoard, -beta, -alpha, ply + 1);

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }

    return alpha;
  }

  // Alpha-beta negamax with PV tracking
  alphaBeta(board, depth, alpha, beta, ply, canNull = true) {
    // Time check every 4096 nodes
    if ((this.nodes & 4095) === 0 && this.timeLimit && Date.now() - this.startTime > this.timeLimit) {
      this.stopped = true;
      return 0;
    }

    this.nodes++;
    this.pvLength[ply] = ply;

    const isPV = beta - alpha > 1;

    // TT lookup
    const ttEntry = this.tt.get(board);
    if (ttEntry && ttEntry.depth >= depth && !isPV) {
      if (ttEntry.type === TT_EXACT) return ttEntry.score;
      if (ttEntry.type === TT_ALPHA && ttEntry.score <= alpha) return alpha;
      if (ttEntry.type === TT_BETA && ttEntry.score >= beta) return beta;
    }

    if (depth <= 0) return this.quiescence(board, alpha, beta, ply);

    const inCheck = board.inCheck();

    // Check extension: search one more ply when in check
    if (inCheck) depth++;

    // Null move pruning
    if (canNull && !isPV && !inCheck && depth >= 3 && !this._isEndgame(board)) {
      const nullBoard = board.clone();
      nullBoard.side = 1 - nullBoard.side;
      nullBoard.epSquare = -1;
      const R = depth >= 6 ? 3 : 2;
      const nullScore = -this.alphaBeta(nullBoard, depth - 1 - R, -beta, -beta + 1, ply + 1, false);
      if (this.stopped) return 0;
      if (nullScore >= beta) return beta;
    }

    const moves = board.generateLegalMoves();

    if (moves.length === 0) {
      if (inCheck) return -MATE_SCORE + ply;
      return 0;
    }

    const ttMove = ttEntry?.bestMove;
    const orderedMoves = this._orderMoves(moves, ttMove, ply, board.side);

    let bestScore = -INFINITY;
    let bestMove = null;
    let ttType = TT_ALPHA;
    let movesSearched = 0;

    for (const move of orderedMoves) {
      const newBoard = board.makeMove(move);

      let score;

      if (movesSearched === 0) {
        // Full window search for first move (likely best from ordering)
        score = -this.alphaBeta(newBoard, depth - 1, -beta, -alpha, ply + 1, true);
      } else {
        // LMR for late quiet moves
        let reduction = 0;
        if (movesSearched >= 4 && depth >= 3 && !inCheck &&
            move.capture === undefined && move.promotion === undefined) {
          reduction = 1;
          if (movesSearched >= 8) reduction = 2;
          if (depth >= 6 && movesSearched >= 12) reduction = 3;
        }

        // Zero-window search (PVS)
        score = -this.alphaBeta(newBoard, depth - 1 - reduction, -alpha - 1, -alpha, ply + 1, true);

        // Re-search at full depth + window if promising
        if (score > alpha && (reduction > 0 || !isPV)) {
          score = -this.alphaBeta(newBoard, depth - 1, -beta, -alpha, ply + 1, true);
        }
      }
      movesSearched++;

      if (this.stopped) return 0;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;

        if (score > alpha) {
          alpha = score;
          ttType = TT_EXACT;

          // Update PV
          this.pvTable[ply] = [move, ...(this.pvTable[ply + 1]?.slice(0, this.pvLength[ply + 1] - ply - 1) || [])];
          this.pvLength[ply] = this.pvLength[ply + 1];
        }
      }

      if (alpha >= beta) {
        ttType = TT_BETA;
        this._storeKiller(ply, move);
        this._updateHistory(board.side, move, depth);
        break;
      }
    }

    this.tt.set(board, { depth, score: bestScore, type: ttType, bestMove });
    return bestScore;
  }

  // Iterative deepening with aspiration windows
  search(board, options = {}) {
    const maxDepth = options.depth || 64;
    this.timeLimit = options.timeLimit || 0;
    this.startTime = Date.now();
    this.stopped = false;
    this.nodes = 0;
    this.qNodes = 0;
    this.maxDepth = 0;

    // Check opening book
    if (this.useBook) {
      const hash = computeHash(board);
      const bookMoves = OPENING_BOOK.get(hash);
      if (bookMoves && bookMoves.length > 0) {
        const move = bookMoves[Math.floor(Math.random() * bookMoves.length)];
        return {
          move, score: 0, depth: 0, nodes: 0,
          time: 0, pv: [move], book: true,
        };
      }
    }

    this._clearKillers();
    // Don't clear history between moves — it's cumulative knowledge

    const moves = board.generateLegalMoves();
    if (moves.length === 0) return { move: null, score: 0, depth: 0, nodes: 0, pv: [] };
    if (moves.length === 1) return { move: moves[0], score: 0, depth: 0, nodes: 1, pv: [moves[0]] };

    let bestMove = null;
    let bestScore = 0;
    let prevScore = 0;

    for (let depth = 1; depth <= maxDepth; depth++) {
      // Aspiration window
      let alpha, beta;
      if (depth >= 4 && Math.abs(prevScore) < MATE_SCORE - 100) {
        alpha = prevScore - 50;
        beta = prevScore + 50;
      } else {
        alpha = -INFINITY;
        beta = INFINITY;
      }

      let score = this.alphaBeta(board, depth, alpha, beta, 0, true);

      // Re-search with wider window if aspiration fails
      if (!this.stopped && (score <= alpha || score >= beta)) {
        score = this.alphaBeta(board, depth, -INFINITY, INFINITY, 0, true);
      }

      if (this.stopped) break;

      bestMove = this.pvTable[0]?.[0] || bestMove;
      bestScore = score;
      prevScore = score;
      this.maxDepth = depth;

      // Build PV string
      const pv = this.pvTable[0]?.slice(0, depth).map(m => Board.moveToUCI(m)).join(' ') || '';

      if (options.log) {
        const elapsed = Date.now() - this.startTime;
        const nps = elapsed > 0 ? Math.floor(this.nodes / (elapsed / 1000)) : 0;
        options.log({
          depth, score: bestScore, nodes: this.nodes,
          time: elapsed, nps, pv,
          ttHits: this.tt.hits, qNodes: this.qNodes,
        });
      }

      if (Math.abs(bestScore) > MATE_SCORE - 100) break;
    }

    return {
      move: bestMove,
      score: bestScore,
      depth: this.maxDepth,
      nodes: this.nodes,
      time: Date.now() - this.startTime,
      pv: this.pvTable[0]?.slice(0, this.maxDepth) || [],
    };
  }

  // Get opening book status
  getBookMove(board) {
    const hash = computeHash(board);
    return OPENING_BOOK.get(hash) || null;
  }
}

export { INFINITY, MATE_SCORE, PIECE_VALUES, OPENING_BOOK };
