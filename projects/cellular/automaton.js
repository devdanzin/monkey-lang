'use strict';

// ============================================================
// Cellular Automaton Engine
// 1D Elementary CA (Wolfram rules) + 2D Game of Life
// ============================================================

// === 1D Elementary Cellular Automaton ===
class ElementaryCA {
  constructor(rule, width = 101) {
    this.rule = rule;
    this.width = width;
    this.ruleTable = this._buildRuleTable(rule);
    this.state = new Uint8Array(width);
    // Default: single cell in center
    this.state[Math.floor(width / 2)] = 1;
    this.generation = 0;
    this.history = [new Uint8Array(this.state)];
  }

  _buildRuleTable(rule) {
    // 8 possible 3-cell neighborhoods (111=7 down to 000=0)
    const table = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      table[i] = (rule >> i) & 1;
    }
    return table;
  }

  step() {
    const next = new Uint8Array(this.width);
    for (let i = 0; i < this.width; i++) {
      const left = i > 0 ? this.state[i - 1] : 0;
      const center = this.state[i];
      const right = i < this.width - 1 ? this.state[i + 1] : 0;
      const neighborhood = (left << 2) | (center << 1) | right;
      next[i] = this.ruleTable[neighborhood];
    }
    this.state = next;
    this.generation++;
    this.history.push(new Uint8Array(this.state));
    return this.state;
  }

  run(steps) {
    for (let i = 0; i < steps; i++) this.step();
    return this.history;
  }

  reset(initialState) {
    if (initialState) {
      this.state = new Uint8Array(initialState);
    } else {
      this.state = new Uint8Array(this.width);
      this.state[Math.floor(this.width / 2)] = 1;
    }
    this.generation = 0;
    this.history = [new Uint8Array(this.state)];
  }

  toASCII() {
    return this.history.map(row => 
      Array.from(row).map(c => c ? '█' : ' ').join('')
    ).join('\n');
  }

  toCompactASCII() {
    return this.history.map(row =>
      Array.from(row).map(c => c ? '#' : '.').join('')
    ).join('\n');
  }

  // Get class of rule (Wolfram classification)
  static classify(rule) {
    // Known classifications for common rules
    const classes = {
      0: 1, 8: 1, 32: 1, 40: 1, 128: 1, 136: 1, 160: 1, 168: 1,
      // Class 2 (periodic)
      1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 9: 2, 10: 2,
      // Class 3 (chaotic)
      18: 3, 22: 3, 30: 3, 45: 3, 60: 3, 90: 3, 105: 3, 150: 3,
      // Class 4 (complex)
      54: 4, 106: 4, 110: 4,
    };
    return classes[rule] || null;
  }
}

// === 2D Game of Life ===
class GameOfLife {
  constructor(width = 50, height = 50) {
    this.width = width;
    this.height = height;
    this.grid = new Uint8Array(width * height);
    this.generation = 0;
    this._buf = new Uint8Array(width * height);
  }

  get(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.grid[y * this.width + x];
  }

  set(x, y, val) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.grid[y * this.width + x] = val ? 1 : 0;
    }
  }

  toggle(x, y) {
    this.set(x, y, !this.get(x, y));
  }

  countNeighbors(x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = (x + dx + this.width) % this.width;
        const ny = (y + dy + this.height) % this.height;
        count += this.grid[ny * this.width + nx];
      }
    }
    return count;
  }

  step() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const n = this.countNeighbors(x, y);
        const alive = this.grid[y * this.width + x];
        // B3/S23 rules
        this._buf[y * this.width + x] = (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 1 : 0;
      }
    }
    // Swap buffers
    [this.grid, this._buf] = [this._buf, this.grid];
    this.generation++;
    return this.grid;
  }

  run(steps) {
    for (let i = 0; i < steps; i++) this.step();
    return this.grid;
  }

  // Place a pattern at position (ox, oy)
  place(pattern, ox = 0, oy = 0) {
    for (const [dx, dy] of pattern) {
      this.set(ox + dx, oy + dy, 1);
    }
  }

  // Place from string format
  placeString(str, ox = 0, oy = 0) {
    const lines = str.trim().split('\n');
    for (let y = 0; y < lines.length; y++) {
      for (let x = 0; x < lines[y].length; x++) {
        if (lines[y][x] === '#' || lines[y][x] === 'O' || lines[y][x] === '*') {
          this.set(ox + x, oy + y, 1);
        }
      }
    }
  }

  // Count live cells
  population() {
    let count = 0;
    for (let i = 0; i < this.grid.length; i++) count += this.grid[i];
    return count;
  }

  clear() {
    this.grid.fill(0);
    this.generation = 0;
  }

  // Random fill
  randomize(density = 0.3) {
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = Math.random() < density ? 1 : 0;
    }
  }

  toASCII() {
    const lines = [];
    for (let y = 0; y < this.height; y++) {
      let line = '';
      for (let x = 0; x < this.width; x++) {
        line += this.grid[y * this.width + x] ? '#' : '.';
      }
      lines.push(line);
    }
    return lines.join('\n');
  }

  // Get bounding box of live cells
  getBounds() {
    let minX = this.width, maxX = 0, minY = this.height, maxY = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y * this.width + x]) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    return { minX, maxX, minY, maxY };
  }

  // Hash the grid state (for cycle detection)
  hash() {
    let h = 0;
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i]) h = ((h << 5) - h + i) | 0;
    }
    return h;
  }
}

// === Pattern Library ===
const patterns = {
  // Still lifes
  block: [[0,0],[1,0],[0,1],[1,1]],
  beehive: [[1,0],[2,0],[0,1],[3,1],[1,2],[2,2]],
  loaf: [[1,0],[2,0],[0,1],[3,1],[1,2],[3,2],[2,3]],
  boat: [[0,0],[1,0],[0,1],[2,1],[1,2]],
  tub: [[1,0],[0,1],[2,1],[1,2]],

  // Oscillators
  blinker: [[0,0],[1,0],[2,0]], // period 2
  toad: [[1,0],[2,0],[3,0],[0,1],[1,1],[2,1]], // period 2
  beacon: [[0,0],[1,0],[0,1],[3,2],[2,3],[3,3]], // period 2
  pulsar: (() => {
    const cells = [];
    const row = [2,3,4,8,9,10];
    for (const x of row) { cells.push([x,0]); cells.push([x,5]); cells.push([x,7]); cells.push([x,12]); }
    for (const y of [2,3,4,8,9,10]) { cells.push([0,y]); cells.push([5,y]); cells.push([7,y]); cells.push([12,y]); }
    return cells;
  })(),

  // Spaceships
  glider: [[1,0],[2,1],[0,2],[1,2],[2,2]],
  lwss: [[1,0],[4,0],[0,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3]], // lightweight spaceship
  
  // Methuselahs
  rpentomino: [[1,0],[2,0],[0,1],[1,1],[1,2]],
  diehard: [[6,0],[0,1],[1,1],[1,2],[5,2],[6,2],[7,2]],
  acorn: [[1,0],[3,1],[0,2],[1,2],[4,2],[5,2],[6,2]],
  
  // Guns
  gosperGliderGun: (() => {
    const s = `........................O...........
......................O.O...........
............OO......OO............OO
...........O...O....OO............OO
OO........O.....O...OO..............
OO........O...O.OO....O.O...........
..........O.....O.......O...........
...........O...O........................
............OO..........................`;
    const cells = [];
    const lines = s.split('\n');
    for (let y = 0; y < lines.length; y++)
      for (let x = 0; x < lines[y].length; x++)
        if (lines[y][x] === 'O') cells.push([x, y]);
    return cells;
  })(),
};

// String patterns for convenience
const patternStrings = {
  block: '##\n##',
  blinker: '###',
  glider: '.#.\n..#\n###',
  lwss: '.#..#\n#....\n#...#\n####.',
  rpentomino: '.##\n##.\n.#.',
  pulsar: `..###...###..
.............
#....#.#....#
#....#.#....#
#....#.#....#
..###...###..
.............
..###...###..
#....#.#....#
#....#.#....#
#....#.#....#
.............
..###...###..`,
};

module.exports = { ElementaryCA, GameOfLife, patterns, patternStrings };
