// play.js — Interactive CLI chess game
// Play against the engine from the command line

import { Board, STARTING_FEN, WHITE, BLACK, sqName } from './board.js';
import { SearchEngine } from './search.js';
import { moveToSAN, parseSAN, Game } from './pgn.js';
import { createInterface } from 'readline';

const PIECE_CHARS = {
  white: { 0: '♙', 1: '♘', 2: '♗', 3: '♖', 4: '♕', 5: '♔' },
  black: { 0: '♟', 1: '♞', 2: '♝', 3: '♜', 4: '♛', 5: '♚' },
};

const ASCII_PIECES = {
  white: { 0: 'P', 1: 'N', 2: 'B', 3: 'R', 4: 'Q', 5: 'K' },
  black: { 0: 'p', 1: 'n', 2: 'b', 3: 'r', 4: 'q', 5: 'k' },
};

export function boardToAscii(board, useUnicode = true) {
  const chars = useUnicode ? PIECE_CHARS : ASCII_PIECES;
  let s = '\n  ╔═══╤═══╤═══╤═══╤═══╤═══╤═══╤═══╗\n';

  for (let rank = 7; rank >= 0; rank--) {
    s += `${rank + 1} ║`;
    for (let file = 0; file < 8; file++) {
      const sq = rank * 8 + file;
      let piece = ' ';
      const isDark = (rank + file) % 2 === 0;

      for (let color = 0; color < 2; color++) {
        for (let p = 0; p < 6; p++) {
          if ((board.pieces[color][p] >> BigInt(sq)) & 1n) {
            piece = chars[color === 0 ? 'white' : 'black'][p];
          }
        }
      }

      const bg = isDark ? '·' : ' ';
      s += ` ${piece === ' ' ? bg : piece} `;
      s += file < 7 ? '│' : '';
    }
    s += '║\n';
    if (rank > 0) s += '  ╟───┼───┼───┼───┼───┼───┼───┼───╢\n';
  }
  s += '  ╚═══╧═══╧═══╧═══╧═══╧═══╧═══╧═══╝\n';
  s += '    a   b   c   d   e   f   g   h\n';
  return s;
}

export function formatMoveHistory(game) {
  const moves = game.moveList();
  let s = '';
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) s += `${Math.floor(i / 2) + 1}. `;
    s += moves[i] + ' ';
    if (i % 2 === 1 && i < moves.length - 1) s += '\n';
  }
  return s.trim();
}

export class InteractiveGame {
  constructor(options = {}) {
    this.playerColor = options.playerColor !== undefined ? options.playerColor : WHITE;
    this.engineDepth = options.depth || 4;
    this.engineTime = options.time || 2000; // ms
    this.useUnicode = options.unicode !== false;
    this.engine = new SearchEngine();
    this.game = new Game({
      white: this.playerColor === WHITE ? 'Human' : 'HenryChess',
      black: this.playerColor === BLACK ? 'Human' : 'HenryChess',
    });
  }

  showBoard() {
    console.log(boardToAscii(this.game.board, this.useUnicode));
    if (this.game.moves.length > 0) {
      console.log('Moves:', formatMoveHistory(this.game));
    }
    const side = this.game.board.side === WHITE ? 'White' : 'Black';
    console.log(`\n${side} to move`);
  }

  engineMove() {
    console.log('\nThinking...');
    const result = this.engine.search(this.game.board, {
      depth: this.engineDepth,
      timeLimit: this.engineTime,
      log: (info) => {
        if (info.depth >= 3) {
          const scoreStr = Math.abs(info.score) > 90000
            ? `M${Math.ceil((100001 - Math.abs(info.score)) / 2)}`
            : `${info.score > 0 ? '+' : ''}${info.score / 100}`;
          process.stdout.write(`\r  depth ${info.depth}: ${scoreStr} (${info.nps} nps)`);
        }
      },
    });
    console.log('');

    if (result.move) {
      const san = this.game.play(result.move);
      const scoreStr = Math.abs(result.score) > 90000
        ? `Mate in ${Math.ceil((100001 - Math.abs(result.score)) / 2)}`
        : `${result.score > 0 ? '+' : ''}${(result.score / 100).toFixed(2)}`;
      console.log(`Engine plays: ${san} (${scoreStr}, depth ${result.depth}${result.book ? ' book' : ''})`);
    }
  }

  parsePlayerMove(input) {
    input = input.trim();
    if (!input) return null;

    // Try SAN first (e.g., "Nf3", "e4", "O-O")
    const sanMove = parseSAN(this.game.board, input);
    if (sanMove) return sanMove;

    // Try UCI notation (e.g., "e2e4", "g1f3")
    const uciMove = this.game.board.findMoveFromUCI(input);
    if (uciMove) return uciMove;

    return null;
  }

  run() {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('╔══════════════════════════╗');
    console.log('║    HenryChess v1.0      ║');
    console.log('║  Type moves in SAN/UCI  ║');
    console.log('║  Commands: quit, undo,  ║');
    console.log('║  pgn, hint, new         ║');
    console.log('╚══════════════════════════╝');

    this.showBoard();

    // If engine plays first (player is black)
    if (this.playerColor === BLACK) {
      this.engineMove();
      this.showBoard();
    }

    const prompt = () => {
      if (this.game.isGameOver()) {
        console.log(`\n*** Game Over: ${this.game.result} ***`);
        console.log(this.game.toPGN());
        rl.close();
        return;
      }

      rl.question('\nYour move: ', (input) => {
        input = input.trim().toLowerCase();

        if (input === 'quit' || input === 'exit') {
          console.log('\nGoodbye!');
          rl.close();
          return;
        }

        if (input === 'undo') {
          this.game.undo(); // Undo engine's move
          this.game.undo(); // Undo player's move
          this.showBoard();
          prompt();
          return;
        }

        if (input === 'pgn') {
          console.log('\n' + this.game.toPGN());
          prompt();
          return;
        }

        if (input === 'hint') {
          const result = this.engine.search(this.game.board, { depth: this.engineDepth });
          if (result.move) {
            console.log(`Hint: ${moveToSAN(this.game.board, result.move)}`);
          }
          prompt();
          return;
        }

        if (input === 'new') {
          this.game = new Game({
            white: this.playerColor === WHITE ? 'Human' : 'HenryChess',
            black: this.playerColor === BLACK ? 'Human' : 'HenryChess',
          });
          this.showBoard();
          if (this.playerColor === BLACK) {
            this.engineMove();
            this.showBoard();
          }
          prompt();
          return;
        }

        if (input === 'board') {
          this.showBoard();
          prompt();
          return;
        }

        if (input === 'moves') {
          const moves = this.game.board.generateLegalMoves();
          console.log('Legal moves:', moves.map(m => moveToSAN(this.game.board, m)).join(', '));
          prompt();
          return;
        }

        // Parse move
        const move = this.parsePlayerMove(input);
        if (!move) {
          console.log('Invalid move. Try SAN (e.g., Nf3) or UCI (e.g., g1f3).');
          prompt();
          return;
        }

        const san = this.game.play(move);
        console.log(`You played: ${san}`);

        if (this.game.isGameOver()) {
          this.showBoard();
          console.log(`\n*** Game Over: ${this.game.result} ***`);
          console.log(this.game.toPGN());
          rl.close();
          return;
        }

        // Engine's turn
        this.engineMove();
        this.showBoard();

        if (this.game.isGameOver()) {
          console.log(`\n*** Game Over: ${this.game.result} ***`);
          console.log(this.game.toPGN());
          rl.close();
          return;
        }

        prompt();
      });
    };

    prompt();
  }
}

// Run if executed directly
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('/play.js') ||
  process.argv[1].endsWith('\\play.js')
);
if (isMainModule) {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--black') options.playerColor = BLACK;
    if (args[i] === '--white') options.playerColor = WHITE;
    if (args[i] === '--depth') options.depth = parseInt(args[++i]);
    if (args[i] === '--time') options.time = parseInt(args[++i]);
    if (args[i] === '--ascii') options.unicode = false;
  }
  const game = new InteractiveGame(options);
  game.run();
}

export default InteractiveGame;
