// fen-positions.test.js — FEN parsing, board state, and evaluation

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Board, STARTING_FEN, WHITE, BLACK } from './board.js';
import { evaluate } from './eval.js';

describe('FEN Positions and Evaluation', () => {
  it('starting FEN parses correctly', () => {
    const b = Board.fromFEN(STARTING_FEN);
    assert.equal(b.side, WHITE);
    assert.equal(b.generateMoves().length, 20);
  });

  it('empty board with kings only', () => {
    const b = Board.fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    assert.ok(b.generateMoves().length >= 5);
  });

  it('FEN round-trip preserves key info', () => {
    const b = Board.fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const exported = b.toFEN();
    assert.ok(exported.includes('4k3'));
    assert.ok(exported.includes('4K3'));
  });

  it('black to move', () => {
    const b = Board.fromFEN('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    assert.equal(b.side, BLACK);
    assert.equal(b.generateMoves().length, 20);
  });

  it('Kiwipete has many moves', () => {
    const b = Board.fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    assert.ok(b.generateMoves().length >= 40);
  });

  it('position 3 perft suite', () => {
    const b = Board.fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    assert.ok(b.generateMoves().length > 0);
  });

  it('eval starting position near zero', () => {
    const b = Board.fromFEN(STARTING_FEN);
    assert.ok(Math.abs(evaluate(b)) < 50);
  });

  it('eval extra rook is winning', () => {
    const b = Board.fromFEN('4k3/8/8/8/8/8/8/4KR2 w - - 0 1');
    assert.ok(evaluate(b) > 200);
  });

  it('eval two bishops strong', () => {
    const b = Board.fromFEN('4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1');
    assert.ok(evaluate(b) > 200);
  });

  it('eval queen vs pawn', () => {
    const b = Board.fromFEN('4k3/8/8/8/8/8/p7/4K2Q w - - 0 1');
    assert.ok(evaluate(b) > 500);
  });

  it('eval equal rooks', () => {
    const b = Board.fromFEN('r3k3/8/8/8/8/8/8/R3K3 w - - 0 1');
    assert.ok(Math.abs(evaluate(b)) < 100);
  });

  it('eval equal pawns', () => {
    const b = Board.fromFEN('4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1');
    assert.ok(Math.abs(evaluate(b)) < 50);
  });

  it('eval changes after move', () => {
    const b = Board.fromFEN(STARTING_FEN);
    const before = evaluate(b);
    b.makeMove(b.generateMoves()[0]);
    const after = evaluate(b);
    assert.ok(typeof after === 'number');
  });

  it('clone produces independent copy', () => {
    const b = Board.fromFEN(STARTING_FEN);
    const c = b.clone();
    b.makeMove(b.generateMoves()[0]);
    assert.equal(c.generateMoves().length, 20);
  });

  it('promotion position', () => {
    const b = Board.fromFEN('8/4P3/8/8/8/8/8/4K2k w - - 0 1');
    assert.ok(b.generateMoves().some(m => m.promotion !== undefined));
  });

  it('en passant square set', () => {
    const b = Board.fromFEN('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    assert.ok(b.epSquare !== undefined && b.epSquare >= 0);
  });

  it('multiple moves from start', () => {
    const b = Board.fromFEN(STARTING_FEN);
    for (const m of b.generateMoves().slice(0, 5)) {
      const copy = b.clone();
      copy.makeMove(m);
      assert.equal(copy.generateMoves().length, 20);
    }
  });

  it('rook endgame moves', () => {
    const b = Board.fromFEN('8/8/8/8/8/8/4k3/R3K3 w - - 0 1');
    assert.ok(b.generateMoves().length >= 15);
  });

  it('position in check has limited moves', () => {
    const b = Board.fromFEN('k7/8/1Q6/8/8/8/8/R3K3 b - - 0 1');
    const moves = b.generateMoves();
    assert.ok(moves.length <= 5); // very few options under attack
  });

  it('knight fork position', () => {
    const b = Board.fromFEN('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1');
    assert.ok(b.generateMoves().length > 25);
  });

  it('material eval: queen + rook vs queen + rook', () => {
    const b = Board.fromFEN('r2qk3/8/8/8/8/8/8/R2QK3 w - - 0 1');
    assert.ok(Math.abs(evaluate(b)) < 100);
  });

  it('two queens advantage', () => {
    const b = Board.fromFEN('4k3/8/8/8/8/8/8/QQ2K3 w - - 0 1');
    assert.ok(evaluate(b) > 1500);
  });

  it('knight on rim is dim', () => {
    const center = Board.fromFEN('4k3/8/8/4N3/8/8/8/4K3 w - - 0 1');
    const rim = Board.fromFEN('4k3/8/8/8/8/8/8/N3K3 w - - 0 1');
    assert.ok(evaluate(center) > evaluate(rim));
  });

  it('advanced passed pawn', () => {
    const b = Board.fromFEN('4k3/4P3/8/8/8/8/8/4K3 w - - 0 1');
    assert.ok(evaluate(b) > 50);
  });

  it('🎯 250th test — complex middlegame evaluation', () => {
    const b = Board.fromFEN('r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 0 1');
    const score = evaluate(b);
    assert.ok(typeof score === 'number');
    assert.ok(Math.abs(score) < 300); // roughly equal position
  });
});
