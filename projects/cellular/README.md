# Cellular Automata

A cellular automaton engine with 1D Elementary CA (all 256 Wolfram rules) and 2D Game of Life, plus an interactive browser demo.

## Features

### 1D Elementary Cellular Automata
- All 256 Wolfram rules (0-255)
- Configurable width and step count
- Rule table visualization
- Wolfram classification (Class 1-4) for known rules
- History tracking, ASCII output

### 2D Game of Life
- Conway's B3/S23 rules with toroidal wrapping
- Double-buffered stepping for correctness
- Pattern library: still lifes, oscillators, spaceships, methuselahs, guns
- Place patterns programmatically or from strings
- Population counting, bounds detection, state hashing

### Interactive Demo
- **Game of Life**: Click to draw, place patterns, play/pause/step
- **1D CA**: Enter any rule number (0-255), generate visualizations
- Speed control, random fill, clear

## Usage

### Node.js

```javascript
const { ElementaryCA, GameOfLife, patterns } = require('./automaton.js');

// 1D: Rule 30 (chaotic)
const ca = new ElementaryCA(30, 101);
ca.run(50);
console.log(ca.toCompactASCII());

// 2D: Game of Life
const gol = new GameOfLife(50, 50);
gol.place(patterns.glider, 10, 10);
gol.place(patterns.gosperGliderGun, 2, 2);
gol.run(100);
console.log(`Generation ${gol.generation}, Population: ${gol.population()}`);
```

### Browser

Open `index.html` for the interactive demo.

## Pattern Library

### Still Lifes
Block, Beehive, Loaf, Boat, Tub

### Oscillators
Blinker (p2), Toad (p2), Beacon (p2), Pulsar (p15)

### Spaceships
Glider, Lightweight Spaceship (LWSS)

### Methuselahs
R-pentomino, Diehard (dies at gen 130), Acorn

### Guns
Gosper Glider Gun (period 30)

## Notable Rules (1D)

| Rule | Class | Behavior |
|------|-------|----------|
| 30 | 3 (Chaotic) | Aperiodic, used as PRNG |
| 90 | 3 (Chaotic) | Sierpinski triangle pattern |
| 110 | 4 (Complex) | Turing-complete |
| 184 | 2 (Periodic) | Traffic flow model |
| 0 | 1 (Uniform) | All cells die |
| 255 | 1 (Uniform) | All cells live |

## Tests

```bash
node --test automaton.test.js
```

34 tests covering 1D rules, Game of Life mechanics, patterns, cycle detection, and edge cases.

## Zero Dependencies
Pure JavaScript, no external packages. Works in Node.js and browsers.
