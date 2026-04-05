// pgn.js — PGN export, algebraic notation, game history

import { Board, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, sqName, parseSq, fileOf, rankOf } from './board.js';

const PIECE_SYMBOLS = ['', 'N', 'B', 'R', 'Q', 'K']; // Pawn has no symbol

/**
 * Convert a move to Standard Algebraic Notation (SAN)
 * e.g., e4, Nf3, Bxe5, O-O, Qxf7#
 */
export function moveToSAN(board, move) {
  // Castling
  if (move.castling === 'K' || move.castling === 'k') return 'O-O';
  if (move.castling === 'Q' || move.castling === 'q') return 'O-O-O';

  let san = '';
  const piece = move.piece;

  if (piece !== PAWN) {
    san += PIECE_SYMBOLS[piece];

    // Disambiguation: if multiple pieces of same type can reach the target
    const legalMoves = board.generateLegalMoves();
    const ambiguous = legalMoves.filter(m =>
      m.piece === piece && m.to === move.to && m.from !== move.from
    );
    if (ambiguous.length > 0) {
      const sameFile = ambiguous.some(m => fileOf(m.from) === fileOf(move.from));
      const sameRank = ambiguous.some(m => rankOf(m.from) === rankOf(move.from));
      if (!sameFile) {
        san += 'abcdefgh'[fileOf(move.from)];
      } else if (!sameRank) {
        san += (rankOf(move.from) + 1);
      } else {
        san += sqName(move.from);
      }
    }
  } else if (move.capture !== undefined) {
    san += 'abcdefgh'[fileOf(move.from)];
  }

  if (move.capture !== undefined) san += 'x';
  san += sqName(move.to);

  // Promotion
  if (move.promotion !== undefined) {
    san += '=' + PIECE_SYMBOLS[move.promotion];
  }

  // Check / Checkmate
  const newBoard = board.makeMove(move);
  if (newBoard.inCheck()) {
    const legalReplies = newBoard.generateLegalMoves();
    if (legalReplies.length === 0) {
      san += '#';
    } else {
      san += '+';
    }
  }

  return san;
}

/**
 * Parse SAN notation back to a move object
 */
export function parseSAN(board, san) {
  const legalMoves = board.generateLegalMoves();

  // Castling
  if (san === 'O-O' || san === '0-0') {
    return legalMoves.find(m => m.castling === (board.side === WHITE ? 'K' : 'k'));
  }
  if (san === 'O-O-O' || san === '0-0-0') {
    return legalMoves.find(m => m.castling === (board.side === WHITE ? 'Q' : 'q'));
  }

  // Strip check/mate symbols
  san = san.replace(/[+#!?]+$/, '');

  // Promotion
  let promotion = undefined;
  const promoMatch = san.match(/=([NBRQ])$/);
  if (promoMatch) {
    promotion = ['', 'N', 'B', 'R', 'Q'].indexOf(promoMatch[1]);
    san = san.replace(/=[NBRQ]$/, '');
  }

  // Target square is always the last 2 chars
  const toSq = parseSq(san.slice(-2));
  san = san.slice(0, -2);

  // Remove capture symbol
  san = san.replace('x', '');

  // Determine piece
  let piece = PAWN;
  if (san.length > 0 && 'NBRQK'.includes(san[0])) {
    piece = ['', 'N', 'B', 'R', 'Q', 'K'].indexOf(san[0]);
    san = san.slice(1);
  }

  // Disambiguation
  let disambigFile = -1;
  let disambigRank = -1;
  if (san.length === 2) {
    disambigFile = san.charCodeAt(0) - 97;
    disambigRank = san.charCodeAt(1) - 49;
  } else if (san.length === 1) {
    if (san >= 'a' && san <= 'h') disambigFile = san.charCodeAt(0) - 97;
    else if (san >= '1' && san <= '8') disambigRank = san.charCodeAt(0) - 49;
  }

  return legalMoves.find(m => {
    if (m.piece !== piece) return false;
    if (m.to !== toSq) return false;
    if (promotion !== undefined && m.promotion !== promotion) return false;
    if (promotion === undefined && m.promotion !== undefined) {
      // Default promotion to queen if not specified
      if (m.promotion !== QUEEN) return false;
    }
    if (disambigFile >= 0 && fileOf(m.from) !== disambigFile) return false;
    if (disambigRank >= 0 && rankOf(m.from) !== disambigRank) return false;
    return true;
  });
}

/**
 * Game history — tracks moves, positions, and metadata
 */
export class Game {
  constructor(options = {}) {
    this.startFEN = options.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    this.board = Board.fromFEN(this.startFEN);
    this.moves = []; // { move, san, board (before move) }
    this.result = '*'; // *, 1-0, 0-1, 1/2-1/2
    this.tags = {
      Event: options.event || 'Casual Game',
      Site: options.site || 'Henry Chess Engine',
      Date: options.date || new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      Round: options.round || '-',
      White: options.white || 'White',
      Black: options.black || 'Black',
      Result: '*',
    };
  }

  /**
   * Make a move (SAN string or move object)
   * Returns the SAN notation of the move played
   */
  play(moveInput) {
    let move;
    if (typeof moveInput === 'string') {
      move = parseSAN(this.board, moveInput);
      if (!move) throw new Error(`Illegal move: ${moveInput}`);
    } else {
      move = moveInput;
    }

    const san = moveToSAN(this.board, move);
    this.moves.push({ move, san, fen: this.board.toFEN() });
    this.board = this.board.makeMove(move);

    // Check for game end
    const legalMoves = this.board.generateLegalMoves();
    if (legalMoves.length === 0) {
      if (this.board.inCheck()) {
        this.result = this.board.side === BLACK ? '1-0' : '0-1';
      } else {
        this.result = '1/2-1/2';
      }
      this.tags.Result = this.result;
    }

    // 50-move rule
    if (this.board.halfmove >= 100) {
      this.result = '1/2-1/2';
      this.tags.Result = this.result;
    }

    return san;
  }

  /**
   * Undo the last move
   */
  undo() {
    if (this.moves.length === 0) return null;
    const last = this.moves.pop();
    this.board = Board.fromFEN(last.fen);
    this.result = '*';
    this.tags.Result = '*';
    return last.san;
  }

  /**
   * Get current position as FEN
   */
  fen() {
    return this.board.toFEN();
  }

  /**
   * Check if game is over
   */
  isGameOver() {
    return this.result !== '*';
  }

  /**
   * Get move list in SAN
   */
  moveList() {
    return this.moves.map(m => m.san);
  }

  /**
   * Export to PGN format
   */
  toPGN() {
    let pgn = '';

    // Tags
    for (const [key, value] of Object.entries(this.tags)) {
      pgn += `[${key} "${value}"]\n`;
    }
    if (this.startFEN !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
      pgn += `[FEN "${this.startFEN}"]\n`;
      pgn += `[SetUp "1"]\n`;
    }
    pgn += '\n';

    // Moves
    let moveLine = '';
    for (let i = 0; i < this.moves.length; i++) {
      if (i % 2 === 0) {
        moveLine += `${Math.floor(i / 2) + 1}. `;
      }
      moveLine += this.moves[i].san + ' ';
    }
    moveLine += this.result;

    // Wrap at 80 chars
    const words = moveLine.split(' ');
    let line = '';
    for (const word of words) {
      if (line.length + word.length + 1 > 80) {
        pgn += line.trim() + '\n';
        line = '';
      }
      line += word + ' ';
    }
    if (line.trim()) pgn += line.trim() + '\n';

    return pgn;
  }

  /**
   * Parse PGN string into a Game
   */
  static fromPGN(pgn) {
    const tags = {};
    const tagRegex = /\[(\w+)\s+"([^"]+)"\]/g;
    let match;
    while ((match = tagRegex.exec(pgn)) !== null) {
      tags[match[1]] = match[2];
    }

    const game = new Game({
      fen: tags.FEN || undefined,
      event: tags.Event,
      site: tags.Site,
      date: tags.Date,
      round: tags.Round,
      white: tags.White,
      black: tags.Black,
    });

    // Extract movetext (everything after the tags)
    const movetext = pgn.replace(/\[.*?\]\s*/g, '').trim();
    // Remove comments and variations
    const clean = movetext
      .replace(/\{[^}]*\}/g, '') // {comments}
      .replace(/\([^)]*\)/g, '') // (variations)
      .replace(/\d+\.\.\./g, '') // 1...
      .replace(/\d+\./g, '') // 1.
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = clean.split(' ').filter(t =>
      t && !['1-0', '0-1', '1/2-1/2', '*'].includes(t)
    );

    for (const token of tokens) {
      try {
        game.play(token);
      } catch (e) {
        break; // Stop on invalid move
      }
    }

    // Set result from tag
    if (tags.Result) {
      game.result = tags.Result;
      game.tags.Result = tags.Result;
    }

    return game;
  }
}

export { PIECE_SYMBOLS };
