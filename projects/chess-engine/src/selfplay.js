// selfplay.js — Engine self-play for testing and analysis

import { Board, STARTING_FEN, WHITE, BLACK } from './board.js';
import { SearchEngine } from './search.js';
import { Game, moveToSAN } from './pgn.js';

/**
 * Play a single game between two engine configurations
 */
export function playGame(options = {}) {
  const whiteDepth = options.whiteDepth || 4;
  const blackDepth = options.blackDepth || 4;
  const whiteTime = options.whiteTime || 1000;
  const blackTime = options.blackTime || 1000;
  const maxMoves = options.maxMoves || 200;
  const fen = options.fen || STARTING_FEN;
  const verbose = options.verbose || false;

  const whiteEngine = new SearchEngine();
  const blackEngine = new SearchEngine();

  // Optional: disable book for one side to test
  if (options.whiteNoBook) whiteEngine.useBook = false;
  if (options.blackNoBook) blackEngine.useBook = false;

  const game = new Game({
    white: `HenryChess-d${whiteDepth}`,
    black: `HenryChess-d${blackDepth}`,
    event: 'Self-Play',
    fen: fen !== STARTING_FEN ? fen : undefined,
  });

  for (let i = 0; i < maxMoves * 2; i++) {
    if (game.isGameOver()) break;

    const isWhite = game.board.side === WHITE;
    const engine = isWhite ? whiteEngine : blackEngine;
    const depth = isWhite ? whiteDepth : blackDepth;
    const timeLimit = isWhite ? whiteTime : blackTime;

    const result = engine.search(game.board, { depth, timeLimit });

    if (!result.move) {
      // No legal moves — shouldn't happen if Game doesn't already detect it
      break;
    }

    const san = game.play(result.move);
    if (verbose) {
      const scoreStr = Math.abs(result.score) > 90000
        ? `M${Math.ceil((100001 - Math.abs(result.score)) / 2)}`
        : `${(result.score / 100).toFixed(2)}`;
      console.log(`${Math.ceil((i + 1) / 2)}${isWhite ? '.' : '...'} ${san} (${scoreStr}, d${result.depth}${result.book ? ' book' : ''})`);
    }
  }

  // Force draw if max moves reached
  if (!game.isGameOver()) {
    game.result = '1/2-1/2';
    game.tags.Result = '1/2-1/2';
  }

  return {
    result: game.result,
    moves: game.moves.length,
    pgn: game.toPGN(),
    moveList: game.moveList(),
  };
}

/**
 * Play a tournament of N games, tracking results
 */
export function tournament(options = {}) {
  const numGames = options.games || 10;
  const verbose = options.verbose || false;
  const results = { '1-0': 0, '0-1': 0, '1/2-1/2': 0 };
  const games = [];

  for (let i = 0; i < numGames; i++) {
    if (verbose) console.log(`\n=== Game ${i + 1}/${numGames} ===`);

    const game = playGame({
      ...options,
      verbose,
    });

    results[game.result]++;
    games.push(game);

    if (verbose) {
      console.log(`Result: ${game.result} (${game.moves} moves)`);
    }
  }

  const totalGames = results['1-0'] + results['0-1'] + results['1/2-1/2'];
  const whiteScore = results['1-0'] + results['1/2-1/2'] * 0.5;
  const blackScore = results['0-1'] + results['1/2-1/2'] * 0.5;

  return {
    results,
    games,
    totalGames,
    whiteScore,
    blackScore,
    whitePercentage: (whiteScore / totalGames * 100).toFixed(1),
    summary: `W: ${results['1-0']} | D: ${results['1/2-1/2']} | B: ${results['0-1']} | ` +
             `White: ${whiteScore}/${totalGames} (${(whiteScore / totalGames * 100).toFixed(1)}%)`,
  };
}

/**
 * Quick bench: play one game and report stats
 */
export function bench(options = {}) {
  const depth = options.depth || 4;
  const start = Date.now();

  const game = playGame({
    whiteDepth: depth,
    blackDepth: depth,
    maxMoves: 50,
    ...options,
  });

  const elapsed = Date.now() - start;

  return {
    result: game.result,
    moves: game.moves,
    timeMs: elapsed,
    movesPerSecond: (game.moves / (elapsed / 1000)).toFixed(1),
  };
}

// Run if executed directly
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('/selfplay.js') ||
  process.argv[1].endsWith('\\selfplay.js')
);
if (isMainModule) {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'game';

  if (cmd === 'game') {
    console.log('Playing one game (depth 3)...\n');
    const result = playGame({ whiteDepth: 3, blackDepth: 3, verbose: true });
    console.log(`\nResult: ${result.result}`);
    console.log(`\nPGN:\n${result.pgn}`);
  } else if (cmd === 'tournament') {
    const n = parseInt(args[1]) || 5;
    console.log(`Playing ${n} game tournament...\n`);
    const result = tournament({ games: n, whiteDepth: 3, blackDepth: 3, verbose: true });
    console.log(`\n${result.summary}`);
  } else if (cmd === 'bench') {
    console.log('Running benchmark...');
    const result = bench({ depth: 3 });
    console.log(`${result.moves} moves in ${result.timeMs}ms (${result.movesPerSecond} moves/sec)`);
    console.log(`Result: ${result.result}`);
  }
}
