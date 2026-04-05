// selfplay.test.js — Tests for engine self-play

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { playGame, tournament, bench } from './selfplay.js';

describe('Self-play', () => {
  describe('playGame', () => {
    it('completes a game', { timeout: 30000 }, () => {
      const result = playGame({ whiteDepth: 2, blackDepth: 2, maxMoves: 30 });
      assert.ok(result.result, 'Should have a result');
      assert.ok(['1-0', '0-1', '1/2-1/2'].includes(result.result));
      assert.ok(result.moves > 0, 'Should have some moves');
      assert.ok(result.pgn, 'Should have PGN');
    });

    it('respects maxMoves', { timeout: 30000 }, () => {
      const result = playGame({ whiteDepth: 1, blackDepth: 1, maxMoves: 5 });
      assert.ok(result.moves <= 10, `Expected ≤10 half-moves, got ${result.moves}`);
    });

    it('generates valid PGN', { timeout: 30000 }, () => {
      const result = playGame({ whiteDepth: 2, blackDepth: 2, maxMoves: 10 });
      assert.ok(result.pgn.includes('[Event'));
      assert.ok(result.pgn.includes('[White'));
      assert.ok(result.pgn.includes('[Black'));
    });

    it('returns move list', { timeout: 30000 }, () => {
      const result = playGame({ whiteDepth: 2, blackDepth: 2, maxMoves: 10 });
      assert.ok(Array.isArray(result.moveList));
      assert.equal(result.moveList.length, result.moves);
    });

    it('can disable book for one side', { timeout: 30000 }, () => {
      const result = playGame({
        whiteDepth: 2, blackDepth: 2,
        whiteNoBook: true, maxMoves: 5
      });
      assert.ok(result.moves > 0);
    });

    it('plays from custom FEN', { timeout: 30000 }, () => {
      // Endgame position
      const result = playGame({
        fen: '4k3/4P3/4K3/8/8/8/8/8 w - - 0 1',
        whiteDepth: 3, blackDepth: 2, maxMoves: 10,
      });
      assert.ok(result.result);
    });
  });

  describe('tournament', () => {
    it('plays multiple games', { timeout: 60000 }, () => {
      const result = tournament({
        games: 3, whiteDepth: 1, blackDepth: 1,
      });
      assert.equal(result.totalGames, 3);
      assert.ok(result.summary);
      assert.equal(result.games.length, 3);
      const total = result.results['1-0'] + result.results['0-1'] + result.results['1/2-1/2'];
      assert.equal(total, 3);
    });

    it('tracks scores correctly', { timeout: 60000 }, () => {
      const result = tournament({
        games: 2, whiteDepth: 1, blackDepth: 1,
      });
      assert.equal(result.whiteScore + result.blackScore, result.totalGames);
    });
  });

  describe('bench', () => {
    it('returns benchmark stats', { timeout: 30000 }, () => {
      const result = bench({ depth: 1, maxMoves: 10 });
      assert.ok(result.timeMs > 0);
      assert.ok(result.moves > 0);
      assert.ok(result.movesPerSecond);
      assert.ok(result.result);
    });
  });
});
