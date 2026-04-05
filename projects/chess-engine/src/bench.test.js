// bench.test.js — Performance benchmarks for move generation and search

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Board, STARTING_FEN } from './board.js';
import { SearchEngine } from './search.js';

describe('Performance benchmarks', () => {
  describe('Move generation speed', () => {
    it('generates legal moves from starting position', () => {
      const b = Board.fromFEN(STARTING_FEN);
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        b.generateLegalMoves();
      }
      const elapsed = performance.now() - start;
      console.log(`  Move gen starting pos: ${elapsed.toFixed(1)}ms for 1000 iterations (${(elapsed / 1000 * 1000).toFixed(1)}µs/call)`);
      assert.ok(elapsed < 5000, 'Should complete in under 5s');
    });

    it('generates legal moves from complex position', () => {
      const b = Board.fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        b.generateLegalMoves();
      }
      const elapsed = performance.now() - start;
      console.log(`  Move gen Kiwipete: ${elapsed.toFixed(1)}ms for 1000 iterations`);
      assert.ok(elapsed < 5000);
    });
  });

  describe('Search speed', () => {
    it('depth 4 from starting position', { timeout: 30000 }, () => {
      const engine = new SearchEngine();
      engine.useBook = false;
      const board = Board.fromFEN(STARTING_FEN);
      const result = engine.search(board, { depth: 4 });
      assert.ok(result.move);
      assert.ok(result.nodes > 0);
      const nps = result.time > 0 ? Math.floor(result.nodes / (result.time / 1000)) : 0;
      console.log(`  Starting d4: ${result.nodes} nodes, ${result.time}ms, ${nps} NPS`);
    });

    it('depth 4 from Kiwipete', { timeout: 30000 }, () => {
      const engine = new SearchEngine();
      engine.useBook = false;
      const board = Board.fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
      const result = engine.search(board, { depth: 4 });
      assert.ok(result.move);
      const nps = result.time > 0 ? Math.floor(result.nodes / (result.time / 1000)) : 0;
      console.log(`  Kiwipete d4: ${result.nodes} nodes, ${result.time}ms, ${nps} NPS`);
    });

    it('endgame search is faster', { timeout: 30000 }, () => {
      const engine = new SearchEngine();
      const board = Board.fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
      const result = engine.search(board, { depth: 5 });
      assert.ok(result.move);
      const nps = result.time > 0 ? Math.floor(result.nodes / (result.time / 1000)) : 0;
      console.log(`  Endgame d5: ${result.nodes} nodes, ${result.time}ms, ${nps} NPS`);
    });

    it('time-limited search', () => {
      const engine = new SearchEngine();
      engine.useBook = false;
      const board = Board.fromFEN(STARTING_FEN);
      const result = engine.search(board, { timeLimit: 500 });
      assert.ok(result.move);
      assert.ok(result.time <= 1000, `Time should be ~500ms, got ${result.time}ms`);
      console.log(`  Time-limited (500ms): depth ${result.depth}, ${result.nodes} nodes, ${result.time}ms`);
    });
  });

  describe('TT effectiveness', () => {
    it('TT improves search', () => {
      const engine = new SearchEngine();
      engine.useBook = false;
      const board = Board.fromFEN(STARTING_FEN);
      
      // First search
      engine.search(board, { depth: 3 });
      const hits1 = engine.tt.hits;
      
      // Second search (TT warm)
      engine.search(board, { depth: 4 });
      const hits2 = engine.tt.hits;
      
      assert.ok(hits2 > hits1, 'TT should have more hits on deeper search');
      console.log(`  TT hits: d3=${hits1}, d4=${hits2}`);
    });
  });
});
