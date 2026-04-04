// ===== Minimax Game AI =====

// ===== Tic-Tac-Toe =====

export class TicTacToe {
  constructor(board = null) {
    this.board = board || Array(9).fill(null);
    this.currentPlayer = 'X';
  }

  clone() {
    const game = new TicTacToe([...this.board]);
    game.currentPlayer = this.currentPlayer;
    return game;
  }

  makeMove(pos) {
    if (this.board[pos] !== null) throw new Error('Invalid move');
    const next = this.clone();
    next.board[pos] = this.currentPlayer;
    next.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
    return next;
  }

  getMoves() {
    return this.board.reduce((moves, cell, i) => {
      if (cell === null) moves.push(i);
      return moves;
    }, []);
  }

  getWinner() {
    const lines = [
      [0,1,2],[3,4,5],[6,7,8], // rows
      [0,3,6],[1,4,7],[2,5,8], // cols
      [0,4,8],[2,4,6],         // diags
    ];
    for (const [a, b, c] of lines) {
      if (this.board[a] && this.board[a] === this.board[b] && this.board[b] === this.board[c]) {
        return this.board[a];
      }
    }
    return null;
  }

  isTerminal() {
    return this.getWinner() !== null || this.getMoves().length === 0;
  }

  evaluate(player) {
    const winner = this.getWinner();
    if (winner === player) return 10;
    if (winner !== null) return -10;
    return 0;
  }

  toString() {
    let result = '';
    for (let i = 0; i < 9; i++) {
      result += this.board[i] || '.';
      if (i % 3 === 2) result += '\n';
    }
    return result;
  }
}

// ===== Minimax =====

export function minimax(game, depth, isMaximizing, player) {
  if (game.isTerminal() || depth === 0) {
    return { score: game.evaluate(player), move: null };
  }

  const moves = game.getMoves();
  let bestMove = null;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (const move of moves) {
      const next = game.makeMove(move);
      const { score } = minimax(next, depth - 1, false, player);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return { score: bestScore, move: bestMove };
  } else {
    let bestScore = Infinity;
    for (const move of moves) {
      const next = game.makeMove(move);
      const { score } = minimax(next, depth - 1, true, player);
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return { score: bestScore, move: bestMove };
  }
}

// ===== Alpha-Beta Pruning =====

export function alphaBeta(game, depth, alpha, beta, isMaximizing, player) {
  if (game.isTerminal() || depth === 0) {
    return { score: game.evaluate(player), move: null, nodesExplored: 1 };
  }

  const moves = game.getMoves();
  let bestMove = null;
  let totalNodes = 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (const move of moves) {
      const next = game.makeMove(move);
      const { score, nodesExplored } = alphaBeta(next, depth - 1, alpha, beta, false, player);
      totalNodes += nodesExplored;
      if (score > bestScore) { bestScore = score; bestMove = move; }
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break; // prune
    }
    return { score: bestScore, move: bestMove, nodesExplored: totalNodes };
  } else {
    let bestScore = Infinity;
    for (const move of moves) {
      const next = game.makeMove(move);
      const { score, nodesExplored } = alphaBeta(next, depth - 1, alpha, beta, true, player);
      totalNodes += nodesExplored;
      if (score < bestScore) { bestScore = score; bestMove = move; }
      beta = Math.min(beta, score);
      if (beta <= alpha) break; // prune
    }
    return { score: bestScore, move: bestMove, nodesExplored: totalNodes };
  }
}

// ===== AI Player =====

export function bestMove(game, useAlphaBeta = true) {
  const player = game.currentPlayer;
  if (useAlphaBeta) {
    return alphaBeta(game, 20, -Infinity, Infinity, true, player);
  }
  return minimax(game, 20, true, player);
}
