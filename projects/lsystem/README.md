# L-System Explorer

A complete L-system engine with string rewriting, turtle graphics interpretation, SVG generation, and an interactive browser demo.

## Features

- **String rewriting engine** — Apply production rules iteratively
- **Turtle graphics interpreter** — Convert L-system strings to line segments
- **SVG output** — Generate scalable vector graphics
- **Interactive browser demo** — Real-time parameter tweaking with canvas rendering
- **12 preset fractals** — Koch snowflake, Sierpinski, Dragon curve, fractal plant, Hilbert, and more

## Presets

| Fractal | Axiom | Angle | Visual |
|---------|-------|-------|--------|
| Koch Snowflake | `F--F--F` | 60° | Snowflake outline |
| Koch Curve | `F` | 90° | Quadratic fractal |
| Sierpinski Triangle | `F-G-G` | 120° | Triangle pattern |
| Sierpinski Arrowhead | `A` | 60° | Space-filling curve |
| Dragon Curve | `F` | 90° | Heighway dragon |
| Fractal Plant | `X` | 25° | Organic branching |
| Hilbert Curve | `A` | 90° | Space-filling |
| Gosper Curve | `A` | 60° | Flowsnake |
| Lévy C Curve | `F` | 45° | Self-similar |
| Barnsley Fern | `X` | 22.5° | Plant-like |
| Square Koch | `F+F+F+F` | 90° | Island fractal |
| Penrose Tiling | `[F]++...` | 36° | Quasi-crystal |

## Usage

### Node.js

```javascript
const { LSystem, presets } = require('./lsystem.js');

// Use a preset
const koch = presets.kochSnowflake();
const str = koch.generate(4);
const result = koch.interpret(str);
console.log(`${result.segments.length} line segments`);

// Generate SVG
const svg = koch.toSVG({ stroke: '#4a9eff', strokeWidth: 1 });

// Custom L-system
const custom = new LSystem({
  axiom: 'F',
  rules: { F: 'F+F-F-F+F' },
  angle: 90,
  stepSize: 5,
  iterations: 4,
});
```

### Browser

Open `index.html` — interactive demo with all 12 presets, real-time parameter sliders, and canvas rendering.

## Turtle Commands

| Symbol | Action |
|--------|--------|
| `F` `G` `A` `B` | Move forward, draw line |
| `f` | Move forward, no line |
| `+` | Turn left by angle |
| `-` | Turn right by angle |
| `[` | Push position/angle to stack |
| `]` | Pop position/angle from stack |
| `\|` | Reverse direction (180°) |

## Tests

```bash
node --test lsystem.test.js
```

32 tests covering string rewriting, turtle interpretation, SVG output, all presets, and edge cases.

## How It Works

1. **Generation**: Start with an axiom string. Apply rewriting rules in parallel for *n* iterations. Each character matching a rule is replaced; others pass through unchanged.

2. **Interpretation**: Walk through the generated string with a turtle that tracks position (x, y) and heading (angle). Drawing commands produce line segments; turn commands rotate the turtle; bracket commands save/restore state.

3. **Rendering**: Line segments can be output as SVG, rendered to canvas, or processed further.

## Zero Dependencies
Pure JavaScript, no external packages. Works in Node.js and browsers.
