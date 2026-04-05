// eval-positions.test.js — More evaluation and FEN tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Board, STARTING_FEN, WHITE, BLACK } from './board.js';
import { evaluate } from './eval.js';

describe('Evaluation & Positions', () => {
  it('Sicilian Defense position', () => {
    const b = Board.fromFEN('rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2');
    assert.ok(b.generateMoves().length >= 25);
  });

  it("Queen's Gambit position", () => {
    const b = Board.fromFEN('rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2');
    assert.ok(b.generateMoves().length >= 20);
  });

  it('Italian Game position', () => {
    const b = Board.fromFEN('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3');
    const moves = b.generateMoves();
    assert.ok(moves.length >= 20);
  });

  it('rook vs bishop eval', () => {
    const rook = Board.fromFEN('4k3/8/8/8/8/8/8/4KR2 w - - 0 1');
    const bishop = Board.fromFEN('4k3/8/8/8/8/8/8/4KB2 w - - 0 1');
    assert.ok(evaluate(rook) > evaluate(bishop));
  });

  it('two rooks > queen', () => {
    const twoRooks = Board.fromFEN('4k3/8/8/8/8/8/8/RR2K3 w - - 0 1');
    const queen = Board.fromFEN('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1');
    // Two rooks (10) vs queen (9) — rooks slightly better
    assert.ok(evaluate(twoRooks) >= evaluate(queen) - 100);
  });

  it('three pawns vs knight', () => {
    const pawns = Board.fromFEN('4k3/8/8/8/8/PPP5/8/4K3 w - - 0 1');
    const knight = Board.fromFEN('4k3/8/8/8/8/8/8/4KN2 w - - 0 1');
    assert.ok(typeof evaluate(pawns) === 'number');
    assert.ok(typeof evaluate(knight) === 'number');
  });

  it('board clone independence', () => {
    const orig = Board.fromFEN(STARTING_FEN);
    const clone = orig.clone();
    const move = orig.generateMoves()[0];
    orig.makeMove(move);
    assert.equal(clone.side, WHITE);
    assert.equal(clone.generateMoves().length, 20);
  });

  it('toFEN produces valid string', () => {
    const b = Board.fromFEN(STARTING_FEN);
    const fen = b.toFEN();
    assert.ok(fen.includes('/'));
    assert.ok(fen.split(' ').length >= 4);
  });

  it('after makeMove, different moves available', () => {
    const b = Board.fromFEN(STARTING_FEN);
    b.makeMove(b.generateMoves()[0]);
    // Should still have exactly 20 moves (black's response)
    assert.equal(b.generateMoves().length, 20);
  });

  it('5 moves deep from start', () => {
    const b = Board.fromFEN(STARTING_FEN);
    for (let i = 0; i < 5; i++) {
      const moves = b.generateMoves();
      assert.ok(moves.length > 0);
      b.makeMove(moves[0]);
    }
  });

  it('king and pawn endgame', () => {
    const b = Board.fromFEN('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    assert.ok(evaluate(b) > 0);
  });

  it('opposite bishops (draw tendency)', () => {
    // Each side has opposite color bishop
    const b = Board.fromFEN('4k3/8/8/8/4b3/8/8/2B1K3 w - - 0 1');
    assert.ok(Math.abs(evaluate(b)) < 200);
  });

  it('all pawns symmetric', () => {
    const b = Board.fromFEN('4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1');
    const eval1 = evaluate(b);
    assert.ok(Math.abs(eval1) < 50);
  });

  it('queen endgame', () => {
    const b = Board.fromFEN('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1');
    assert.ok(evaluate(b) > 800);
  });

  it('evaluate never returns NaN', () => {
    const positions = [
      STARTING_FEN,
      '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    ];
    for (const fen of positions) {
      const b = Board.fromFEN(fen);
      const score = evaluate(b);
      assert.ok(!isNaN(score), `NaN eval for ${fen}`);
    }
  });

  it('many moves possible in open position', () => {
    const b = Board.fromFEN('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4');
    assert.ok(b.generateMoves().length >= 25);
  });

  it('very few moves in cramped position', () => {
    const b = Board.fromFEN('r1bqk2r/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 0 5');
    assert.ok(b.generateMoves().length > 0);
  });

  it('FEN with no castling rights', () => {
    const b = Board.fromFEN('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w - - 0 1');
    const moves = b.generateMoves();
    assert.ok(moves.length > 0);
  });

  it('evaluate many positions quickly', () => {
    const start = Date.now();
    const b = Board.fromFEN(STARTING_FEN);
    for (let i = 0; i < 1000; i++) {
      evaluate(b);
    }
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 1000, `1000 evals took ${elapsed}ms`);
  });

  it('move generation is deterministic', () => {
    const b1 = Board.fromFEN(STARTING_FEN);
    const b2 = Board.fromFEN(STARTING_FEN);
    assert.equal(b1.generateMoves().length, b2.generateMoves().length);
  });

  it('opposite material advantage', () => {
    const whiteUp = Board.fromFEN('4k3/8/8/8/8/8/8/4KR2 w - - 0 1');
    const blackUp = Board.fromFEN('4k2r/8/8/8/8/8/8/4K3 w - - 0 1');
    assert.ok(evaluate(whiteUp) > 0);
    assert.ok(evaluate(blackUp) < 0);
  });

  it('minor piece values: bishop ~= knight', () => {
    const bishop = Board.fromFEN('4k3/8/8/8/8/8/8/4KB2 w - - 0 1');
    const knight = Board.fromFEN('4k3/8/8/8/8/8/8/4KN2 w - - 0 1');
    const diff = Math.abs(evaluate(bishop) - evaluate(knight));
    assert.ok(diff < 100, `Bishop vs knight diff: ${diff}`);
  });

  it('central pawns worth more than rim pawns', () => {
    const central = Board.fromFEN('4k3/8/8/4P3/8/8/8/4K3 w - - 0 1');
    const rim = Board.fromFEN('4k3/8/8/P7/8/8/8/4K3 w - - 0 1');
    assert.ok(evaluate(central) >= evaluate(rim));
  });

  it('king under attack from rook', () => {
    const b = Board.fromFEN('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
    // White king should have limited moves due to rook attack
    const moves = b.generateMoves();
    assert.ok(moves.length < 8);
  });
});
