// play.test.js — Tests for interactive chess game

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { boardToAscii, formatMoveHistory, InteractiveGame } from './play.js';
import { Board, STARTING_FEN, WHITE, BLACK } from './board.js';
import { Game } from './pgn.js';

describe('Board display', () => {
  it('renders starting position (Unicode)', () => {
    const board = Board.fromFEN(STARTING_FEN);
    const ascii = boardToAscii(board, true);
    assert.ok(ascii.includes('♜')); // black rook
    assert.ok(ascii.includes('♙')); // white pawn
    assert.ok(ascii.includes('a   b   c'));
  });

  it('renders starting position (ASCII)', () => {
    const board = Board.fromFEN(STARTING_FEN);
    const ascii = boardToAscii(board, false);
    assert.ok(ascii.includes('r')); // black rook
    assert.ok(ascii.includes('P')); // white pawn
  });

  it('shows empty squares', () => {
    const board = Board.fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const ascii = boardToAscii(board, true);
    assert.ok(ascii.includes('♔')); // white king
    assert.ok(ascii.includes('♚')); // black king
  });
});

describe('Move history formatting', () => {
  it('formats empty history', () => {
    const game = new Game();
    const s = formatMoveHistory(game);
    assert.equal(s, '');
  });

  it('formats moves with numbering', () => {
    const game = new Game();
    game.play('e4');
    game.play('e5');
    game.play('Nf3');
    const s = formatMoveHistory(game);
    assert.ok(s.includes('1. e4 e5'));
    assert.ok(s.includes('2. Nf3'));
  });
});

describe('InteractiveGame', () => {
  it('creates game with default options', () => {
    const ig = new InteractiveGame();
    assert.equal(ig.playerColor, WHITE);
    assert.ok(ig.engine);
    assert.ok(ig.game);
  });

  it('creates game as black', () => {
    const ig = new InteractiveGame({ playerColor: BLACK });
    assert.equal(ig.playerColor, BLACK);
  });

  it('parses SAN moves', () => {
    const ig = new InteractiveGame();
    const move = ig.parsePlayerMove('e4');
    assert.ok(move);
    assert.equal(move.piece, 0); // pawn
  });

  it('parses UCI moves', () => {
    const ig = new InteractiveGame();
    const move = ig.parsePlayerMove('e2e4');
    assert.ok(move);
  });

  it('rejects invalid moves', () => {
    const ig = new InteractiveGame();
    const move = ig.parsePlayerMove('xyz');
    assert.equal(move, null);
  });

  it('engine can make a move', () => {
    const ig = new InteractiveGame();
    ig.engineMove();
    assert.equal(ig.game.moves.length, 1);
  });

  it('plays a full sequence', () => {
    const ig = new InteractiveGame({ depth: 2 });
    // Player plays e4
    const m1 = ig.parsePlayerMove('e4');
    ig.game.play(m1);
    // Engine responds
    ig.engineMove();
    assert.equal(ig.game.moves.length, 2);
    // Player plays Nf3
    const m2 = ig.parsePlayerMove('Nf3');
    if (m2) ig.game.play(m2);
  });

  it('detects game over after Scholar\'s Mate', () => {
    const ig = new InteractiveGame({ depth: 1 });
    // Manually play Scholar's Mate
    ig.game.play('e4');
    ig.game.play('e5');
    ig.game.play('Bc4');
    ig.game.play('Nc6');
    ig.game.play('Qh5');
    ig.game.play('Nf6');
    ig.game.play('Qxf7');
    assert.ok(ig.game.isGameOver());
    assert.equal(ig.game.result, '1-0');
  });
});
