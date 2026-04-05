// uci.js — Universal Chess Interface (UCI) protocol implementation
// Allows the engine to be used with any UCI-compatible chess GUI

import { Board, STARTING_FEN } from './board.js';
import { SearchEngine } from './search.js';
import { moveToSAN } from './pgn.js';
import { createInterface } from 'readline';

const ENGINE_NAME = 'HenryChess';
const ENGINE_AUTHOR = 'Henry';

export class UCIEngine {
  constructor() {
    this.engine = new SearchEngine();
    this.board = Board.fromFEN(STARTING_FEN);
    this.debug = false;
    this.options = {
      Hash: 64, // TT size in MB
      Threads: 1,
      MoveTime: 0, // ms, 0 = use time control
    };
  }

  // Process a single UCI command
  processCommand(line) {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0];

    switch (cmd) {
      case 'uci':
        return this.handleUci();
      case 'debug':
        this.debug = parts[1] === 'on';
        return [];
      case 'isready':
        return ['readyok'];
      case 'setoption':
        return this.handleSetOption(parts);
      case 'ucinewgame':
        this.engine.tt.clear();
        this.engine._clearHistory();
        this.engine._clearKillers();
        this.board = Board.fromFEN(STARTING_FEN);
        return [];
      case 'position':
        return this.handlePosition(parts);
      case 'go':
        return this.handleGo(parts);
      case 'stop':
        this.engine.stopped = true;
        return [];
      case 'quit':
        return ['__quit__'];
      case 'board': // non-standard: show board
        return [this.boardToString()];
      case 'eval': // non-standard: show evaluation
        return this.handleEval();
      default:
        return [];
    }
  }

  handleUci() {
    return [
      `id name ${ENGINE_NAME}`,
      `id author ${ENGINE_AUTHOR}`,
      'option name Hash type spin default 64 min 1 max 1024',
      'option name UseBook type check default true',
      'uciok',
    ];
  }

  handleSetOption(parts) {
    // setoption name <name> value <value>
    const nameIdx = parts.indexOf('name');
    const valueIdx = parts.indexOf('value');
    if (nameIdx >= 0 && valueIdx >= 0) {
      const name = parts.slice(nameIdx + 1, valueIdx).join(' ');
      const value = parts.slice(valueIdx + 1).join(' ');
      if (name === 'UseBook') {
        this.engine.useBook = value === 'true';
      }
    }
    return [];
  }

  handlePosition(parts) {
    let fenEnd = 2;

    if (parts[1] === 'startpos') {
      this.board = Board.fromFEN(STARTING_FEN);
      fenEnd = 2;
    } else if (parts[1] === 'fen') {
      const fen = parts.slice(2, 8).join(' ');
      this.board = Board.fromFEN(fen);
      fenEnd = 8;
    }

    // Apply moves
    const movesIdx = parts.indexOf('moves');
    if (movesIdx >= 0) {
      for (let i = movesIdx + 1; i < parts.length; i++) {
        const move = this.board.findMoveFromUCI(parts[i]);
        if (move) {
          this.board = this.board.makeMove(move);
        }
      }
    }

    return [];
  }

  handleGo(parts) {
    let depth = 64;
    let timeLimit = 0;
    let movetime = 0;
    let wtime = 0, btime = 0, winc = 0, binc = 0;
    let movestogo = 30;

    for (let i = 1; i < parts.length; i++) {
      switch (parts[i]) {
        case 'depth': depth = parseInt(parts[++i]); break;
        case 'movetime': movetime = parseInt(parts[++i]); break;
        case 'wtime': wtime = parseInt(parts[++i]); break;
        case 'btime': btime = parseInt(parts[++i]); break;
        case 'winc': winc = parseInt(parts[++i]); break;
        case 'binc': binc = parseInt(parts[++i]); break;
        case 'movestogo': movestogo = parseInt(parts[++i]); break;
        case 'infinite': depth = 64; break;
      }
    }

    // Calculate time allocation
    if (movetime > 0) {
      timeLimit = movetime;
    } else if (wtime > 0 || btime > 0) {
      const myTime = this.board.side === 0 ? wtime : btime;
      const myInc = this.board.side === 0 ? winc : binc;
      // Use 1/30th of remaining time + increment
      timeLimit = Math.max(50, Math.floor(myTime / movestogo) + myInc);
    }

    const output = [];

    const result = this.engine.search(this.board, {
      depth,
      timeLimit: timeLimit || undefined,
      log: (info) => {
        const scoreStr = Math.abs(info.score) > 90000
          ? `mate ${Math.sign(info.score) * Math.ceil((100001 - Math.abs(info.score)) / 2)}`
          : `cp ${info.score}`;
        output.push(
          `info depth ${info.depth} score ${scoreStr} nodes ${info.nodes} ` +
          `time ${info.time} nps ${info.nps} pv ${info.pv}`
        );
      },
    });

    if (result.move) {
      const uci = Board.moveToUCI(result.move);
      output.push(`bestmove ${uci}`);
    } else {
      output.push('bestmove (none)');
    }

    return output;
  }

  handleEval() {
    // Import eval dynamically would be complex, so just search depth 1
    const result = this.engine.search(this.board, { depth: 1 });
    return [`info string eval ${result.score} cp`];
  }

  boardToString() {
    const board = this.board;
    let s = '\n  +---+---+---+---+---+---+---+---+\n';
    const pieces = ' PNBRQKpnbrqk';
    for (let rank = 7; rank >= 0; rank--) {
      s += `${rank + 1} |`;
      for (let file = 0; file < 8; file++) {
        const sq = rank * 8 + file;
        let piece = ' ';
        for (let color = 0; color < 2; color++) {
          for (let p = 0; p < 6; p++) {
            if ((board.pieces[color][p] >> BigInt(sq)) & 1n) {
              piece = pieces[color * 6 + p + 1];
            }
          }
        }
        s += ` ${piece} |`;
      }
      s += '\n  +---+---+---+---+---+---+---+---+\n';
    }
    s += '    a   b   c   d   e   f   g   h\n';
    s += `\n${board.side === 0 ? 'White' : 'Black'} to move`;
    s += `\nFEN: ${board.toFEN()}`;
    return s;
  }

  // Run the UCI loop (stdin/stdout)
  run() {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on('line', (line) => {
      const responses = this.processCommand(line);
      for (const r of responses) {
        if (r === '__quit__') {
          rl.close();
          process.exit(0);
        }
        console.log(r);
      }
    });
  }
}

// Run if executed directly
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('/uci.js') ||
  process.argv[1].endsWith('\\uci.js')
);
if (isMainModule) {
  const engine = new UCIEngine();
  engine.run();
}

export default UCIEngine;
