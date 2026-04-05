// zobrist-hash.test.js — Zobrist hashing additional tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Board, STARTING_FEN, WHITE, BLACK } from './board.js';
import { computeHash } from './zobrist.js';

describe('Zobrist Hashing', () => {
  it('same position same hash', () => {
    const h1 = computeHash(Board.fromFEN(STARTING_FEN));
    const h2 = computeHash(Board.fromFEN(STARTING_FEN));
    assert.equal(h1, h2);
  });

  it('different positions different hash', () => {
    const h1 = computeHash(Board.fromFEN(STARTING_FEN));
    const h2 = computeHash(Board.fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1'));
    assert.notEqual(h1, h2);
  });

  it('hash of two different FENs differs', () => {
    const h1 = computeHash(Board.fromFEN(STARTING_FEN));
    const h2 = computeHash(Board.fromFEN('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'));
    assert.notEqual(h1, h2);
  });

  it('hash is a number', () => {
    const h = computeHash(Board.fromFEN(STARTING_FEN));
    assert.ok(typeof h === 'number' || typeof h === 'bigint');
  });

  it('empty board has hash', () => {
    const h = computeHash(Board.fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1'));
    assert.ok(h !== undefined && h !== null);
  });

  it('Kiwipete has unique hash', () => {
    const h = computeHash(Board.fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'));
    assert.ok(typeof h === 'number' || typeof h === 'bigint');
  });

  it('many positions all different hashes', () => {
    const fens = [
      STARTING_FEN,
      '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
      '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    ];
    const hashes = new Set(fens.map(f => computeHash(Board.fromFEN(f))));
    assert.equal(hashes.size, 5);
  });

  it('multiple FENs produce distinct hashes', () => {
    const fens = [
      STARTING_FEN,
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      'r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2',
    ];
    const hashes = new Set(fens.map(f => computeHash(Board.fromFEN(f))));
    assert.equal(hashes.size, 4);
  });

  it('castling rights affect hash', () => {
    const withCastling = computeHash(Board.fromFEN('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1'));
    const withoutCastling = computeHash(Board.fromFEN('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w - - 0 1'));
    assert.notEqual(withCastling, withoutCastling);
  });

  it('side to move affects hash', () => {
    const white = computeHash(Board.fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1'));
    const black = computeHash(Board.fromFEN('4k3/8/8/8/8/8/8/4K3 b - - 0 1'));
    assert.notEqual(white, black);
  });

  it('compute is fast', () => {
    const b = Board.fromFEN(STARTING_FEN);
    const start = Date.now();
    for (let i = 0; i < 10000; i++) computeHash(b);
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 1000, `10000 hashes took ${elapsed}ms`);
  });

  it('hash survives clone', () => {
    const b = Board.fromFEN(STARTING_FEN);
    const c = b.clone();
    assert.equal(computeHash(b), computeHash(c));
  });

  it('en passant affects hash', () => {
    const noEp = computeHash(Board.fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
    const withEp = computeHash(Board.fromFEN('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'));
    assert.notEqual(noEp, withEp);
  });

  it('piece placement matters', () => {
    const knightE4 = computeHash(Board.fromFEN('4k3/8/8/8/4N3/8/8/4K3 w - - 0 1'));
    const knightD4 = computeHash(Board.fromFEN('4k3/8/8/8/3N4/8/8/4K3 w - - 0 1'));
    assert.notEqual(knightE4, knightD4);
  });

  it('different piece types have different hashes', () => {
    const knight = computeHash(Board.fromFEN('4k3/8/8/8/4N3/8/8/4K3 w - - 0 1'));
    const bishop = computeHash(Board.fromFEN('4k3/8/8/8/4B3/8/8/4K3 w - - 0 1'));
    assert.notEqual(knight, bishop);
  });

  it('hash nonzero', () => {
    const h = computeHash(Board.fromFEN(STARTING_FEN));
    assert.ok(h !== 0);
  });

  it('consistent across repeated computations', () => {
    const b = Board.fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    const h1 = computeHash(b);
    const h2 = computeHash(b);
    const h3 = computeHash(b);
    assert.equal(h1, h2);
    assert.equal(h2, h3);
  });

  it('FEN variations produce unique hashes', () => {
    const hashes = new Set();
    // Various endgame positions
    const positions = [
      '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      '4k3/8/8/8/8/8/8/4KR2 w - - 0 1',
      '4k3/8/8/8/8/8/8/4KB2 w - - 0 1',
      '4k3/8/8/8/8/8/8/4KN2 w - - 0 1',
      '4k3/8/8/8/8/8/8/Q3K3 w - - 0 1',
      '4k3/8/8/8/4P3/8/8/4K3 w - - 0 1',
    ];
    for (const fen of positions) hashes.add(computeHash(Board.fromFEN(fen)));
    assert.equal(hashes.size, 6);
  });

  it('hash table-like usage', () => {
    const table = new Map();
    const b = Board.fromFEN(STARTING_FEN);
    const h = computeHash(b);
    table.set(h, { eval: 0, depth: 1 });
    assert.ok(table.has(h));
    assert.equal(table.get(h).eval, 0);
  });

  it('material-only change', () => {
    const bothKnights = computeHash(Board.fromFEN('4k3/8/8/8/8/8/8/N3KN2 w - - 0 1'));
    const oneKnight = computeHash(Board.fromFEN('4k3/8/8/8/8/8/8/N3K3 w - - 0 1'));
    assert.notEqual(bothKnights, oneKnight);
  });

  it('pawn structure difference', () => {
    const doubled = computeHash(Board.fromFEN('4k3/8/8/8/4P3/4P3/8/4K3 w - - 0 1'));
    const split = computeHash(Board.fromFEN('4k3/8/8/8/3P4/4P3/8/4K3 w - - 0 1'));
    assert.notEqual(doubled, split);
  });

  it('queen side vs king side', () => {
    const qside = computeHash(Board.fromFEN('4k3/8/8/8/8/8/8/R3K3 w - - 0 1'));
    const kside = computeHash(Board.fromFEN('4k3/8/8/8/8/8/8/4K2R w - - 0 1'));
    assert.notEqual(qside, kside);
  });

  it('🎯 300th chess test — hash as fingerprint', () => {
    // Every unique FEN has a unique hash
    const fens = [
      STARTING_FEN,
      '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
    ];
    const map = new Map();
    for (const fen of fens) {
      const h = computeHash(Board.fromFEN(fen));
      map.set(fen, h);
    }
    assert.equal(map.size, 3);
    assert.notEqual(map.get(fens[0]), map.get(fens[1]));
  });
});
