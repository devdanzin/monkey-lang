'use strict';

// ============================================================
// L-System Engine — String rewriting + Turtle graphics
// ============================================================

class LSystem {
  constructor({ axiom, rules, angle = 90, stepSize = 10, iterations = 3 }) {
    this.axiom = axiom;
    this.rules = rules;   // Map or object: { 'F': 'F+F-F-F+F' }
    this.angle = angle;   // degrees
    this.stepSize = stepSize;
    this.iterations = iterations;
  }

  // Generate string after n iterations
  generate(iterations = this.iterations) {
    let current = this.axiom;
    for (let i = 0; i < iterations; i++) {
      let next = '';
      for (const ch of current) {
        next += (this.rules[ch] !== undefined) ? this.rules[ch] : ch;
      }
      current = next;
    }
    return current;
  }

  // Interpret string with turtle graphics
  interpret(str, opts = {}) {
    const angle = opts.angle || this.angle;
    const step = opts.stepSize || this.stepSize;
    
    let x = 0, y = 0;
    let dir = opts.startAngle || 0; // degrees, 0 = right
    const stack = [];
    const segments = [];
    let minX = 0, maxX = 0, minY = 0, maxY = 0;

    for (const ch of str) {
      switch (ch) {
        case 'F': case 'G': case 'A': case 'B': {
          // Move forward and draw
          const rad = (dir * Math.PI) / 180;
          const nx = x + step * Math.cos(rad);
          const ny = y + step * Math.sin(rad);
          segments.push({ x1: x, y1: y, x2: nx, y2: ny });
          x = nx; y = ny;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          break;
        }
        case 'f': {
          // Move forward without drawing
          const rad = (dir * Math.PI) / 180;
          x += step * Math.cos(rad);
          y += step * Math.sin(rad);
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          break;
        }
        case '+': dir += angle; break;
        case '-': dir -= angle; break;
        case '[': stack.push({ x, y, dir }); break;
        case ']': {
          const state = stack.pop();
          x = state.x; y = state.y; dir = state.dir;
          break;
        }
        case '|': dir += 180; break; // reverse direction
      }
    }

    return {
      segments,
      bounds: { minX, maxX, minY, maxY },
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  // Render to SVG
  toSVG(opts = {}) {
    const str = this.generate(opts.iterations);
    const result = this.interpret(str, opts);
    const { segments, bounds } = result;
    
    const padding = opts.padding || 10;
    const strokeWidth = opts.strokeWidth || 1;
    const stroke = opts.stroke || '#000';
    const bg = opts.background || '#fff';
    
    const width = (bounds.maxX - bounds.minX) + padding * 2;
    const height = (bounds.maxY - bounds.minY) + padding * 2;
    const offsetX = -bounds.minX + padding;
    const offsetY = -bounds.minY + padding;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}">\n`;
    svg += `<rect width="100%" height="100%" fill="${bg}"/>\n`;
    svg += `<g stroke="${stroke}" stroke-width="${strokeWidth}" fill="none">\n`;
    
    for (const seg of segments) {
      const x1 = (seg.x1 + offsetX).toFixed(2);
      const y1 = (seg.y1 + offsetY).toFixed(2);
      const x2 = (seg.x2 + offsetX).toFixed(2);
      const y2 = (seg.y2 + offsetY).toFixed(2);
      svg += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>\n`;
    }
    
    svg += `</g>\n</svg>`;
    return svg;
  }

  // Render to simple point list (for testing / other renderers)
  toPoints(opts = {}) {
    const str = this.generate(opts.iterations);
    const result = this.interpret(str, opts);
    const points = [{ x: 0, y: 0 }]; // starting point
    for (const seg of result.segments) {
      points.push({ x: seg.x2, y: seg.y2 });
    }
    return points;
  }
}

// === Predefined L-Systems ===

const presets = {
  // Koch snowflake
  kochSnowflake: () => new LSystem({
    axiom: 'F--F--F',
    rules: { F: 'F+F--F+F' },
    angle: 60,
    iterations: 4,
  }),

  // Koch curve
  kochCurve: () => new LSystem({
    axiom: 'F',
    rules: { F: 'F+F-F-F+F' },
    angle: 90,
    iterations: 4,
  }),

  // Sierpinski triangle
  sierpinski: () => new LSystem({
    axiom: 'F-G-G',
    rules: { F: 'F-G+F+G-F', G: 'GG' },
    angle: 120,
    iterations: 6,
  }),

  // Sierpinski arrowhead
  sierpinskiArrowhead: () => new LSystem({
    axiom: 'A',
    rules: { A: 'B-A-B', B: 'A+B+A' },
    angle: 60,
    iterations: 6,
  }),

  // Dragon curve
  dragonCurve: () => new LSystem({
    axiom: 'F',
    rules: { F: 'F+G', G: 'F-G' },
    angle: 90,
    iterations: 12,
  }),

  // Fractal plant (Lindenmayer's original)
  fractalPlant: () => new LSystem({
    axiom: 'X',
    rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' },
    angle: 25,
    iterations: 5,
    startAngle: -90,
  }),

  // Hilbert curve
  hilbert: () => new LSystem({
    axiom: 'A',
    rules: { A: '-BF+AFA+FB-', B: '+AF-BFB-FA+' },
    angle: 90,
    iterations: 5,
  }),

  // Penrose tiling (P3)
  penroseTiling: () => new LSystem({
    axiom: '[F]++[F]++[F]++[F]++[F]',
    rules: { F: 'F++F----F++F' },
    angle: 36,
    iterations: 4,
  }),

  // Gosper curve (flowsnake)
  gosper: () => new LSystem({
    axiom: 'A',
    rules: { A: 'A-B--B+A++AA+B-', B: '+A-BB--B-A++A+B' },
    angle: 60,
    iterations: 4,
  }),

  // Lévy C curve
  levyCCurve: () => new LSystem({
    axiom: 'F',
    rules: { F: '+F--F+' },
    angle: 45,
    iterations: 12,
  }),

  // Barnsley fern
  barnsleyFern: () => new LSystem({
    axiom: 'X',
    rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' },
    angle: 22.5,
    iterations: 6,
    startAngle: -90,
  }),

  // Square Koch island
  squareKochIsland: () => new LSystem({
    axiom: 'F+F+F+F',
    rules: { F: 'F+F-F-FF+F+F-F' },
    angle: 90,
    iterations: 3,
  }),
};

module.exports = { LSystem, presets };
