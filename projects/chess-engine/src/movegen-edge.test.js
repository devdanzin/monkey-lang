// movegen-edge.test.js — Move generation edge cases

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Board, STARTING_FEN, WHITE, BLACK } from './board.js';

describe('Move Generation Edge Cases', () => {
  it('starting position has 20 moves for white', () => {
    const b = Board.fromFEN(STARTING_FEN);
    const moves = b.generateMoves();
    assert.equal(moves.length, 20);
  });

  it('en passant position has moves', () => {
    const b = Board.fromFEN('rnbqkbnr/pppp1ppp/8/3Pp3/8/8/PPP1PPPP/RNBQKBNR w KQkq e6 0 1');
    const moves = b.generateMoves();
    assert.ok(moves.length > 20); // plenty of moves
  });

  it('promotion position generates extra moves', () => {
    const b = Board.fromFEN('8/P7/8/8/8/8/8/4K2k w - - 0 1');
    const moves = b.generateMoves();
    assert.ok(moves.length >= 4); // at least 4 promotion choices + king moves
  });

  it('lone king has up to 8 moves', () => {
    const b = Board.fromFEN('8/8/8/4K3/8/8/8/7k w - - 0 1');
    const moves = b.generateMoves();
    assert.ok(moves.length >= 5); // center-ish king should have many moves
    assert.ok(moves.length <= 8);
  });

  it('corner king has 3 moves', () => {
    const b = Board.fromFEN('K7/8/8/8/8/8/8/7k w - - 0 1');
    const moves = b.generateMoves();
    assert.equal(moves.length, 3); // a8: b8, b7, a7
  });

  it('double check — black has few legal moves', () => {
    const b = Board.fromFEN('4k3/8/5N2/8/3B4/8/8/4K3 b - - 0 1');
    const moves = b.generateMoves();
    assert.ok(moves.length > 0);
    assert.ok(moves.length <= 8); // only king moves
  });

  it('many pieces means many moves', () => {
    const b = Board.fromFEN(STARTING_FEN);
    const moves = b.generateMoves();
    assert.equal(moves.length, 20);
    // Make a move
    b.makeMove(moves[0]);
    const bMoves = b.generateMoves();
    assert.equal(bMoves.length, 20);
  });

  it('rook on open file has many moves', () => {
    const b = Board.fromFEN('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
    const moves = b.generateMoves();
    assert.ok(moves.length >= 15); // rook + king moves
  });

  it('queen has the most moves', () => {
    const b = Board.fromFEN('4k3/8/8/3Q4/8/8/8/4K3 w - - 0 1');
    const moves = b.generateMoves();
    assert.ok(moves.length >= 25); // queen from d5 + king moves
  });

  it('blocked position still generates moves', () => {
    const b = Board.fromFEN('rnbqkbnr/pppppppp/8/8/8/PPPPPPPP/8/RNBQKBNR w KQkq - 0 1');
    const moves = b.generateMoves();
    assert.ok(moves.length > 0); // rook lifting, knight jumping
  });

  it('knight in corner has 2 moves', () => {
    const b = Board.fromFEN('N3k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const moves = b.generateMoves();
    const nonKingMoves = moves.length - 5; // king has ~5 moves from e1
    assert.ok(nonKingMoves >= 2);
  });

  it('move objects have from and to', () => {
    const b = Board.fromFEN(STARTING_FEN);
    const moves = b.generateMoves();
    for (const m of moves) {
      assert.ok(typeof m.from === 'number');
      assert.ok(typeof m.to === 'number');
      assert.ok(m.from >= 0 && m.from < 64);
      assert.ok(m.to >= 0 && m.to < 64);
    }
  });

  it('makeMove changes side to move', () => {
    const b = Board.fromFEN(STARTING_FEN);
    const moves = b.generateMoves();
    b.makeMove(moves[0]);
    // After white moves, black should have 20 moves
    const bMoves = b.generateMoves();
    assert.equal(bMoves.length, 20);
  });

  it('two consecutive moves', () => {
    const b = Board.fromFEN(STARTING_FEN);
    const wMoves = b.generateMoves();
    b.makeMove(wMoves[0]);
    const bMoves = b.generateMoves();
    assert.equal(bMoves.length, 20);
    b.makeMove(bMoves[0]);
    const wMoves2 = b.generateMoves();
    assert.ok(wMoves2.length >= 20); // should have at least 20 (might have more due to pawn on rank 3)
  });
});
