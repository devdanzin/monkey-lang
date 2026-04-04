// ===== Cellular Automata =====

// ===== Conway's Game of Life =====

export class GameOfLife {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.grid = Array.from({ length: height }, () => new Uint8Array(width));
    this.generation = 0;
  }

  get(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.grid[y][x];
  }

  set(x, y, value = 1) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.grid[y][x] = value ? 1 : 0;
    }
  }

  countNeighbors(x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        count += this.get(x + dx, y + dy);
      }
    }
    return count;
  }

  step() {
    const next = Array.from({ length: this.height }, () => new Uint8Array(this.width));
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const neighbors = this.countNeighbors(x, y);
        const alive = this.grid[y][x];
        
        if (alive) {
          // Survive with 2 or 3 neighbors
          next[y][x] = (neighbors === 2 || neighbors === 3) ? 1 : 0;
        } else {
          // Birth with exactly 3 neighbors
          next[y][x] = neighbors === 3 ? 1 : 0;
        }
      }
    }
    
    this.grid = next;
    this.generation++;
  }

  // Run multiple steps
  run(steps) {
    for (let i = 0; i < steps; i++) this.step();
  }

  // Count live cells
  get population() {
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        count += this.grid[y][x];
      }
    }
    return count;
  }

  // Load pattern from string (. = dead, O = alive)
  static fromPattern(pattern, width, height) {
    const lines = pattern.trim().split('\n').map(l => l.trim());
    const h = height || lines.length + 4;
    const w = width || Math.max(...lines.map(l => l.length)) + 4;
    const life = new GameOfLife(w, h);
    
    const offsetY = Math.floor((h - lines.length) / 2);
    const offsetX = Math.floor((w - (lines[0]?.length || 0)) / 2);
    
    for (let y = 0; y < lines.length; y++) {
      for (let x = 0; x < lines[y].length; x++) {
        if (lines[y][x] === 'O' || lines[y][x] === '#' || lines[y][x] === '1') {
          life.set(x + offsetX, y + offsetY);
        }
      }
    }
    
    return life;
  }

  toString() {
    return this.grid.map(row => 
      [...row].map(c => c ? 'O' : '.').join('')
    ).join('\n');
  }
}

// ===== Elementary Cellular Automata =====
// 1D automata with 3-cell neighborhoods (Wolfram's classification)

export class ElementaryCA {
  constructor(size, rule) {
    this.size = size;
    this.rule = rule;
    this.cells = new Uint8Array(size);
    this.history = [];
  }

  // Set initial state
  setCell(i, value = 1) {
    this.cells[i] = value ? 1 : 0;
  }

  // Single center cell
  seedCenter() {
    this.cells.fill(0);
    this.cells[Math.floor(this.size / 2)] = 1;
  }

  // Random initial state
  seedRandom(density = 0.5) {
    for (let i = 0; i < this.size; i++) {
      this.cells[i] = Math.random() < density ? 1 : 0;
    }
  }

  step() {
    this.history.push(new Uint8Array(this.cells));
    const next = new Uint8Array(this.size);
    
    for (let i = 0; i < this.size; i++) {
      const left = this.cells[(i - 1 + this.size) % this.size];
      const center = this.cells[i];
      const right = this.cells[(i + 1) % this.size];
      
      // The neighborhood (left, center, right) forms a 3-bit number
      const pattern = (left << 2) | (center << 1) | right;
      
      // The rule determines the output for each pattern
      next[i] = (this.rule >> pattern) & 1;
    }
    
    this.cells = next;
  }

  run(steps) {
    for (let i = 0; i < steps; i++) this.step();
    this.history.push(new Uint8Array(this.cells));
  }

  toString() {
    return [...this.cells].map(c => c ? '#' : '.').join('');
  }

  // Render history as 2D string
  renderHistory() {
    return this.history.map(row => 
      [...row].map(c => c ? '#' : '.').join('')
    ).join('\n');
  }

  get population() {
    return this.cells.reduce((s, c) => s + c, 0);
  }
}

// ===== Langton's Ant =====
// A 2D Turing machine that moves on a grid:
//   - On white: turn right, flip color, move forward
//   - On black: turn left, flip color, move forward

export class LangtonsAnt {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.grid = Array.from({ length: height }, () => new Uint8Array(width));
    this.x = Math.floor(width / 2);
    this.y = Math.floor(height / 2);
    this.direction = 0; // 0=up, 1=right, 2=down, 3=left
    this.steps = 0;
  }

  static DX = [0, 1, 0, -1];
  static DY = [-1, 0, 1, 0];

  step() {
    const cell = this.grid[this.y][this.x];
    
    if (cell === 0) {
      // White: turn right
      this.direction = (this.direction + 1) % 4;
    } else {
      // Black: turn left
      this.direction = (this.direction + 3) % 4;
    }
    
    // Flip color
    this.grid[this.y][this.x] = cell ? 0 : 1;
    
    // Move forward
    this.x = (this.x + LangtonsAnt.DX[this.direction] + this.width) % this.width;
    this.y = (this.y + LangtonsAnt.DY[this.direction] + this.height) % this.height;
    
    this.steps++;
  }

  run(steps) {
    for (let i = 0; i < steps; i++) this.step();
  }

  get population() {
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        count += this.grid[y][x];
      }
    }
    return count;
  }
}

// ===== Well-known patterns =====

export const patterns = {
  // Still lifes
  block: `OO\nOO`,
  beehive: `.OO.\nO..O\n.OO.`,
  loaf: `.OO.\nO..O\n.O.O\n..O.`,
  
  // Oscillators
  blinker: `OOO`,
  toad: `.OOO\nOOO.`,
  beacon: `OO..\nOO..\n..OO\n..OO`,
  
  // Spaceships
  glider: `.O.\n..O\nOOO`,
  lwss: `.O..O\nO....\nO...O\n.OOOO`,
  
  // Methuselahs
  rpentomino: `.OO\nOO.\n.O.`,
};
