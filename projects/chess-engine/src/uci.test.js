// uci.test.js — Tests for UCI protocol implementation

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UCIEngine } from './uci.js';

describe('UCI Protocol', () => {
  describe('uci command', () => {
    it('responds with id and uciok', () => {
      const engine = new UCIEngine();
      const response = engine.processCommand('uci');
      assert.ok(response.some(r => r.startsWith('id name')));
      assert.ok(response.some(r => r.startsWith('id author')));
      assert.ok(response.includes('uciok'));
    });
  });

  describe('isready', () => {
    it('responds with readyok', () => {
      const engine = new UCIEngine();
      const response = engine.processCommand('isready');
      assert.deepEqual(response, ['readyok']);
    });
  });

  describe('ucinewgame', () => {
    it('resets engine state', () => {
      const engine = new UCIEngine();
      // Make some moves first
      engine.processCommand('position startpos moves e2e4 e7e5');
      engine.processCommand('ucinewgame');
      // After ucinewgame, position should be reset
      assert.ok(engine.board);
    });
  });

  describe('position', () => {
    it('sets startpos', () => {
      const engine = new UCIEngine();
      engine.processCommand('position startpos');
      assert.equal(engine.board.toFEN(), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    });

    it('sets startpos with moves', () => {
      const engine = new UCIEngine();
      engine.processCommand('position startpos moves e2e4 e7e5');
      // After e4 e5, pawns should be on e4 and e5
      const fen = engine.board.toFEN();
      assert.ok(fen.includes('4p3'), `Expected pawn on e5, got FEN: ${fen}`);
    });

    it('sets custom FEN', () => {
      const engine = new UCIEngine();
      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      engine.processCommand(`position fen ${fen}`);
      // Black to move
      assert.equal(engine.board.side, 1);
    });

    it('applies moves after FEN', () => {
      const engine = new UCIEngine();
      engine.processCommand('position fen rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1 moves e7e5');
      const fen = engine.board.toFEN();
      assert.ok(fen.includes('4p3'));
    });
  });

  describe('go', () => {
    it('returns bestmove', () => {
      const engine = new UCIEngine();
      engine.processCommand('position startpos');
      const response = engine.processCommand('go depth 3');
      const bestmove = response.find(r => r.startsWith('bestmove'));
      assert.ok(bestmove, 'Should have bestmove response');
      // Should be a valid UCI move
      const move = bestmove.split(' ')[1];
      assert.ok(move.length >= 4, `Move should be at least 4 chars: ${move}`);
    });

    it('respects depth limit', () => {
      const engine = new UCIEngine();
      engine.engine.useBook = false; // Disable book to see depth info
      engine.processCommand('position startpos');
      const response = engine.processCommand('go depth 2');
      const infos = response.filter(r => r.startsWith('info depth'));
      assert.ok(infos.length >= 1);
    });

    it('returns bestmove with movetime', () => {
      const engine = new UCIEngine();
      engine.processCommand('position startpos');
      const response = engine.processCommand('go movetime 100');
      const bestmove = response.find(r => r.startsWith('bestmove'));
      assert.ok(bestmove);
    });

    it('handles mate position', () => {
      const engine = new UCIEngine();
      // Scholar's mate setup — white to deliver Qxf7#
      engine.processCommand('position fen r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 3');
      const response = engine.processCommand('go depth 2');
      const bestmove = response.find(r => r.startsWith('bestmove'));
      assert.ok(bestmove);
      // Should find Qxf7#
      assert.ok(bestmove.includes('h5f7'), `Expected Qxf7#, got: ${bestmove}`);
    });

    it('handles time control', () => {
      const engine = new UCIEngine();
      engine.processCommand('position startpos');
      const response = engine.processCommand('go wtime 60000 btime 60000 winc 1000 binc 1000');
      const bestmove = response.find(r => r.startsWith('bestmove'));
      assert.ok(bestmove);
    });
  });

  describe('setoption', () => {
    it('sets UseBook option', () => {
      const engine = new UCIEngine();
      engine.processCommand('setoption name UseBook value false');
      assert.equal(engine.engine.useBook, false);
      engine.processCommand('setoption name UseBook value true');
      assert.equal(engine.engine.useBook, true);
    });
  });

  describe('debug mode', () => {
    it('toggles debug', () => {
      const engine = new UCIEngine();
      engine.processCommand('debug on');
      assert.equal(engine.debug, true);
      engine.processCommand('debug off');
      assert.equal(engine.debug, false);
    });
  });

  describe('stop', () => {
    it('sets stopped flag', () => {
      const engine = new UCIEngine();
      engine.processCommand('stop');
      assert.equal(engine.engine.stopped, true);
    });
  });

  describe('board display (non-standard)', () => {
    it('shows board', () => {
      const engine = new UCIEngine();
      engine.processCommand('position startpos');
      const response = engine.processCommand('board');
      assert.ok(response.length > 0);
      assert.ok(response[0].includes('a   b   c   d'));
    });
  });

  describe('eval (non-standard)', () => {
    it('shows evaluation', () => {
      const engine = new UCIEngine();
      engine.processCommand('position startpos');
      const response = engine.processCommand('eval');
      assert.ok(response.some(r => r.includes('eval')));
    });
  });

  describe('quit', () => {
    it('returns quit signal', () => {
      const engine = new UCIEngine();
      const response = engine.processCommand('quit');
      assert.ok(response.includes('__quit__'));
    });
  });

  describe('unknown commands', () => {
    it('ignores unknown commands', () => {
      const engine = new UCIEngine();
      const response = engine.processCommand('foobar');
      assert.deepEqual(response, []);
    });
  });

  describe('full game flow', () => {
    it('plays through UCI protocol', () => {
      const engine = new UCIEngine();

      // UCI handshake
      let r = engine.processCommand('uci');
      assert.ok(r.includes('uciok'));

      r = engine.processCommand('isready');
      assert.deepEqual(r, ['readyok']);

      // New game
      engine.processCommand('ucinewgame');

      // Position and search
      engine.processCommand('position startpos');
      r = engine.processCommand('go depth 3');
      const bestmove = r.find(x => x.startsWith('bestmove'));
      assert.ok(bestmove);

      // Apply engine's move and let it think again
      const move = bestmove.split(' ')[1];
      engine.processCommand(`position startpos moves ${move}`);
      r = engine.processCommand('go depth 2');
      const bestmove2 = r.find(x => x.startsWith('bestmove'));
      assert.ok(bestmove2);
    });
  });
});
