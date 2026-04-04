import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TicTacToe, minimax, alphaBeta, bestMove } from '../src/index.js';

describe('TicTacToe — basic', () => {
  it('creates empty board', () => {
    const game = new TicTacToe();
    assert.equal(game.getMoves().length, 9);
    assert.equal(game.currentPlayer, 'X');
  });

  it('makes move', () => {
    const game = new TicTacToe().makeMove(4);
    assert.equal(game.board[4], 'X');
    assert.equal(game.currentPlayer, 'O');
  });

  it('detects row win', () => {
    const game = new TicTacToe(['X','X','X',null,null,null,null,null,null]);
    assert.equal(game.getWinner(), 'X');
  });

  it('detects column win', () => {
    const game = new TicTacToe(['O',null,null,'O',null,null,'O',null,null]);
    assert.equal(game.getWinner(), 'O');
  });

  it('detects diagonal win', () => {
    const game = new TicTacToe(['X',null,null,null,'X',null,null,null,'X']);
    assert.equal(game.getWinner(), 'X');
  });

  it('detects draw', () => {
    const game = new TicTacToe(['X','O','X','X','O','O','O','X','X']);
    assert.equal(game.getWinner(), null);
    assert.equal(game.isTerminal(), true);
  });

  it('no winner on empty board', () => {
    assert.equal(new TicTacToe().getWinner(), null);
    assert.equal(new TicTacToe().isTerminal(), false);
  });
});

describe('Minimax', () => {
  it('finds winning move', () => {
    // X can win by playing position 2
    const game = new TicTacToe(['X','X',null,null,'O',null,null,null,'O']);
    const { score, move } = minimax(game, 10, true, 'X');
    assert.equal(move, 2);
    assert.equal(score, 10);
  });

  it('blocks opponent win', () => {
    // O needs to block X from winning at position 2
    const game = new TicTacToe(['X','X',null,'O',null,null,null,null,null]);
    game.currentPlayer = 'O';
    const { move } = bestMove(game, false);
    assert.equal(move, 2); // must block
  });
});

describe('Alpha-Beta Pruning', () => {
  it('gives same result as minimax', () => {
    const game = new TicTacToe(['X','X',null,null,'O',null,null,null,'O']);
    const mm = minimax(game, 10, true, 'X');
    const ab = alphaBeta(game, 10, -Infinity, Infinity, true, 'X');
    assert.equal(mm.move, ab.move);
    assert.equal(mm.score, ab.score);
  });

  it('explores fewer nodes', () => {
    const game = new TicTacToe();
    const ab = alphaBeta(game, 9, -Infinity, Infinity, true, 'X');
    assert.ok(ab.nodesExplored > 0);
    // Alpha-beta should explore much fewer than the full tree
    assert.ok(ab.nodesExplored < 500000);
  });
});

describe('bestMove', () => {
  it('never loses from empty board', () => {
    // X goes first, plays optimally → should draw or win
    let game = new TicTacToe();
    while (!game.isTerminal()) {
      const { move } = bestMove(game);
      game = game.makeMove(move);
    }
    // Perfect play from both sides should draw
    const winner = game.getWinner();
    assert.ok(winner === null || winner === 'X', `X should not lose: ${winner}`);
  });

  it('takes center on empty board', () => {
    const game = new TicTacToe();
    const { move } = bestMove(game);
    // Center or corner are optimal first moves
    assert.ok([0, 2, 4, 6, 8].includes(move));
  });
});
