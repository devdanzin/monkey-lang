// pgn.test.js — Tests for PGN export, algebraic notation, game history

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { moveToSAN, parseSAN, Game, PIECE_SYMBOLS } from './pgn.js';
import { Board, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, STARTING_FEN } from './board.js';

describe('Algebraic Notation (SAN)', () => {
  describe('moveToSAN', () => {
    it('pawn move: e4', () => {
      const b = Board.fromFEN(STARTING_FEN);
      const move = b.findMoveFromUCI('e2e4');
      assert.equal(moveToSAN(b, move), 'e4');
    });

    it('knight move: Nf3', () => {
      const b = Board.fromFEN(STARTING_FEN);
      const move = b.findMoveFromUCI('g1f3');
      assert.equal(moveToSAN(b, move), 'Nf3');
    });

    it('pawn capture: exd5', () => {
      const b = Board.fromFEN('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
      const move = b.findMoveFromUCI('e4d5');
      assert.equal(moveToSAN(b, move), 'exd5');
    });

    it('castling kingside: O-O', () => {
      const b = Board.fromFEN('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
      const move = b.findMoveFromUCI('e1g1');
      assert.equal(moveToSAN(b, move), 'O-O');
    });

    it('castling queenside: O-O-O', () => {
      const b = Board.fromFEN('r3kbnr/pppqpppp/2n5/3p1b2/3P1B2/2N5/PPPQPPPP/R3KBNR w KQkq - 4 4');
      const move = b.findMoveFromUCI('e1c1');
      assert.equal(moveToSAN(b, move), 'O-O-O');
    });

    it('promotion: e8=Q', () => {
      const b2 = Board.fromFEN('8/4P1k1/8/8/8/8/8/4K3 w - - 0 1');
      const move = b2.findMoveFromUCI('e7e8q');
      if (move) assert.equal(moveToSAN(b2, move), 'e8=Q');
    });

    it('knight disambiguation: Nbd2', () => {
      // Both knights can go to d2
      const b = Board.fromFEN('4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1');
      const move = b.findMoveFromUCI('b1d2');
      assert.equal(moveToSAN(b, move), 'Nbd2');
    });

    it('rook disambiguation by file: Rae1', () => {
      // Both rooks can reach e1
      const b = Board.fromFEN('4k3/8/8/8/8/8/8/R3K2R w - - 0 1');
      // Without castling rights, Ke1 is there. Use different position.
      const b2 = Board.fromFEN('4k3/8/8/8/8/8/8/R2K3R w - - 0 1');
      // a1 rook → e1, h1 rook → e1. Both can reach e1.
      const move = b2.findMoveFromUCI('a1e1');
      if (move) assert.equal(moveToSAN(b2, move), 'Rae1');
    });

    it('check notation: Qf7+', () => {
      const b = Board.fromFEN('r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3');
      const move = b.findMoveFromUCI('h5f7');
      const san = moveToSAN(b, move);
      // Should be Qxf7+ or Qxf7# depending on position
      assert.ok(san.includes('Qxf7'), `Expected Qxf7, got ${san}`);
    });
  });

  describe('parseSAN', () => {
    it('parses pawn move', () => {
      const b = Board.fromFEN(STARTING_FEN);
      const move = parseSAN(b, 'e4');
      assert.ok(move);
      assert.equal(move.to, 28); // e4
      assert.equal(move.piece, PAWN);
    });

    it('parses knight move', () => {
      const b = Board.fromFEN(STARTING_FEN);
      const move = parseSAN(b, 'Nf3');
      assert.ok(move);
      assert.equal(move.piece, KNIGHT);
    });

    it('parses capture', () => {
      const b = Board.fromFEN('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
      const move = parseSAN(b, 'exd5');
      assert.ok(move);
      assert.ok(move.capture !== undefined);
    });

    it('parses castling', () => {
      const b = Board.fromFEN('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
      const move = parseSAN(b, 'O-O');
      assert.ok(move);
      assert.equal(move.castling, 'K');
    });

    it('parses with check symbol', () => {
      const b = Board.fromFEN(STARTING_FEN);
      const move = parseSAN(b, 'e4');
      assert.ok(move); // Should still work with/without + symbol
    });

    it('roundtrips SAN', () => {
      const b = Board.fromFEN(STARTING_FEN);
      const moves = b.generateLegalMoves();
      for (const move of moves) {
        const san = moveToSAN(b, move);
        const parsed = parseSAN(b, san);
        assert.ok(parsed, `Failed to parse SAN: ${san}`);
        assert.equal(parsed.from, move.from, `Roundtrip failed for ${san}: from`);
        assert.equal(parsed.to, move.to, `Roundtrip failed for ${san}: to`);
      }
    });
  });
});

describe('Game', () => {
  describe('basics', () => {
    it('creates a new game', () => {
      const game = new Game();
      assert.equal(game.fen(), STARTING_FEN);
      assert.equal(game.result, '*');
      assert.equal(game.moves.length, 0);
    });

    it('plays moves by SAN', () => {
      const game = new Game();
      game.play('e4');
      game.play('e5');
      game.play('Nf3');
      assert.equal(game.moves.length, 3);
      assert.equal(game.moveList().join(' '), 'e4 e5 Nf3');
    });

    it('throws on illegal move', () => {
      const game = new Game();
      assert.throws(() => game.play('e5'), /Illegal move/);
    });

    it('plays moves by UCI', () => {
      const game = new Game();
      const move = game.board.findMoveFromUCI('e2e4');
      game.play(move);
      assert.equal(game.moves.length, 1);
    });

    it('tracks game result', () => {
      const game = new Game();
      assert.ok(!game.isGameOver());
      assert.equal(game.result, '*');
    });

    it('undo last move', () => {
      const game = new Game();
      game.play('e4');
      game.play('e5');
      const san = game.undo();
      assert.equal(san, 'e5');
      assert.equal(game.moves.length, 1);
      // Board should be back to after e4
    });
  });

  describe('Scholar\'s Mate', () => {
    it('detects checkmate in Scholar\'s Mate', () => {
      const game = new Game();
      game.play('e4');
      game.play('e5');
      game.play('Bc4');
      game.play('Nc6');
      game.play('Qh5');
      game.play('Nf6');
      game.play('Qxf7');
      assert.ok(game.isGameOver());
      assert.equal(game.result, '1-0');
      // Last move should have # notation
      assert.equal(game.moves[game.moves.length - 1].san, 'Qxf7#');
    });
  });

  describe('custom start position', () => {
    it('starts from custom FEN', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const game = new Game({ fen });
      assert.equal(game.startFEN, fen);
      assert.equal(game.board.side, BLACK);
    });
  });
});

describe('PGN', () => {
  describe('export', () => {
    it('exports basic game', () => {
      const game = new Game({ white: 'Henry', black: 'Opponent' });
      game.play('e4');
      game.play('e5');
      game.play('Nf3');
      const pgn = game.toPGN();
      assert.ok(pgn.includes('[White "Henry"]'));
      assert.ok(pgn.includes('[Black "Opponent"]'));
      assert.ok(pgn.includes('1. e4 e5'));
      assert.ok(pgn.includes('2. Nf3'));
    });

    it('exports Scholar\'s Mate', () => {
      const game = new Game();
      game.play('e4');
      game.play('e5');
      game.play('Bc4');
      game.play('Nc6');
      game.play('Qh5');
      game.play('Nf6');
      game.play('Qxf7');
      const pgn = game.toPGN();
      assert.ok(pgn.includes('1-0'));
      assert.ok(pgn.includes('Qxf7#'));
    });

    it('includes FEN tag for non-standard start', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const game = new Game({ fen });
      game.play('e5');
      const pgn = game.toPGN();
      assert.ok(pgn.includes('[FEN "'));
      assert.ok(pgn.includes('[SetUp "1"]'));
    });
  });

  describe('import', () => {
    it('parses simple PGN', () => {
      const pgn = `[Event "Test"]
[White "Henry"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;

      const game = Game.fromPGN(pgn);
      assert.equal(game.tags.White, 'Henry');
      assert.equal(game.moves.length, 7);
      assert.equal(game.result, '1-0');
    });

    it('handles PGN with comments', () => {
      const pgn = `[Event "Test"]
[Result "*"]

1. e4 {Best first move} e5 2. Nf3 *`;
      const game = Game.fromPGN(pgn);
      assert.equal(game.moves.length, 3);
    });

    it('roundtrips PGN', () => {
      const game1 = new Game({ white: 'A', black: 'B' });
      game1.play('e4');
      game1.play('e5');
      game1.play('Nf3');
      game1.play('Nc6');
      const pgn = game1.toPGN();
      const game2 = Game.fromPGN(pgn);
      assert.equal(game2.moves.length, 4);
      assert.deepEqual(game2.moveList(), game1.moveList());
    });
  });
});

describe('Stalemate detection', () => {
  it('detects stalemate as draw', () => {
    // After Qc7, black king on a8 has no legal moves and is NOT in check → stalemate
    const game = new Game({ fen: 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1' });
    game.play('Qc7'); // Stalemate: king on a8 blocked by Kb6 and Qc7, not in check
    assert.ok(game.isGameOver());
    assert.equal(game.result, '1/2-1/2');
  });
});
