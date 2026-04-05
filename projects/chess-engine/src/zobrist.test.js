// zobrist.test.js — Zobrist hashing tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Board, STARTING_FEN } from './board.js';
import { computeHash } from './zobrist.js';

describe('Zobrist Hashing', () => {
  it('same position gives same hash', () => {
    const b1 = Board.fromFEN(STARTING_FEN);
    const b2 = Board.fromFEN(STARTING_FEN);
    assert.equal(computeHash(b1), computeHash(b2));
  });

  it('different positions give different hashes', () => {
    const b1 = Board.fromFEN(STARTING_FEN);
    const b2 = Board.fromFEN('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    assert.notEqual(computeHash(b1), computeHash(b2));
  });

  it('after move, hash changes', () => {
    const b1 = Board.fromFEN(STARTING_FEN);
    const move = b1.findMoveFromUCI('e2e4');
    const b2 = b1.makeMove(move);
    assert.notEqual(computeHash(b1), computeHash(b2));
  });

  it('hash is consistent across equal positions via different paths', () => {
    // e4 d5 = same as e4 d5 regardless of moveOrder
    const b = Board.fromFEN(STARTING_FEN);
    const m1 = b.makeMove(b.findMoveFromUCI('e2e4'));
    const m2 = m1.makeMove(m1.findMoveFromUCI('d7d5'));

    const b2 = Board.fromFEN('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
    assert.equal(computeHash(m2), computeHash(b2));
  });

  it('castling rights affect hash', () => {
    const withCastling = Board.fromFEN('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    const noCastling = Board.fromFEN('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w - - 0 1');
    assert.notEqual(computeHash(withCastling), computeHash(noCastling));
  });

  it('en passant square affects hash', () => {
    const withEP = Board.fromFEN('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    const noEP = Board.fromFEN('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    assert.notEqual(computeHash(withEP), computeHash(noEP));
  });

  it('side to move affects hash', () => {
    const white = Board.fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const black = Board.fromFEN('4k3/8/8/8/8/8/8/4K3 b - - 0 1');
    assert.notEqual(computeHash(white), computeHash(black));
  });
});
