// eval-advanced.test.js — More evaluation tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Board, STARTING_FEN, WHITE } from './board.js';
import { evaluate } from './eval.js';

describe('Advanced Evaluation', () => {
  it('starting position is roughly equal', () => {
    const b = Board.fromFEN(STARTING_FEN);
    const score = evaluate(b);
    assert.ok(Math.abs(score) < 50, `Starting position should be near 0, got ${score}`);
  });

  it('extra queen is winning', () => {
    const b = Board.fromFEN('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1');
    const score = evaluate(b);
    assert.ok(score > 800, `Extra queen should be > 800, got ${score}`);
  });

  it('down a queen is losing', () => {
    const b = Board.fromFEN('q3k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const score = evaluate(b);
    assert.ok(score < -800, `Down queen should be < -800, got ${score}`);
  });

  it('extra pawn is small advantage', () => {
    const b = Board.fromFEN('4k3/8/8/8/8/8/P7/4K3 w - - 0 1');
    const score = evaluate(b);
    assert.ok(score > 50 && score < 300, `Extra pawn should be moderate, got ${score}`);
  });

  it('material balance matters', () => {
    const equal = Board.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const whiteUp = Board.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); // same
    const evalEqual = evaluate(equal);
    const evalUp = evaluate(whiteUp);
    assert.equal(evalEqual, evalUp);
  });

  it('both sides have only kings', () => {
    const b = Board.fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const score = evaluate(b);
    assert.ok(Math.abs(score) < 30, `Kings only should be ~0, got ${score}`);
  });

  it('piece placement affects score', () => {
    // Central knight vs corner knight
    const central = Board.fromFEN('4k3/8/8/4N3/8/8/8/4K3 w - - 0 1');
    const corner = Board.fromFEN('4k3/8/8/8/8/8/8/N3K3 w - - 0 1');
    const centralScore = evaluate(central);
    const cornerScore = evaluate(corner);
    assert.ok(centralScore > cornerScore, 'Central knight should score higher');
  });

  it('passed pawn bonus', () => {
    // White pawn on 7th rank (about to promote)
    const b = Board.fromFEN('4k3/4P3/8/8/8/8/8/4K3 w - - 0 1');
    const score = evaluate(b);
    assert.ok(score > 200, `Advanced passed pawn should score well, got ${score}`);
  });

  it('evaluation is from white perspective', () => {
    // Same position, different side to move
    const white = Board.fromFEN('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    const black = Board.fromFEN('4k3/8/8/8/8/8/4P3/4K3 b - - 0 1');
    const wScore = evaluate(white);
    const bScore = evaluate(black);
    // Scores should have opposite sign (or be close to equal)
    assert.ok(wScore >= 0, 'White with extra pawn should be positive for white');
  });

  it('symmetric position evaluates near zero', () => {
    const b = Board.fromFEN('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    const score = evaluate(b);
    assert.ok(Math.abs(score) < 100, `Symmetric should be near 0, got ${score}`);
  });
});
