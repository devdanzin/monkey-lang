'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LSystem, presets } = require('./lsystem.js');

// === String Rewriting ===
test('simple rewriting', () => {
  const l = new LSystem({ axiom: 'A', rules: { A: 'AB', B: 'A' }, iterations: 1 });
  assert.equal(l.generate(1), 'AB');
});

test('multiple iterations', () => {
  const l = new LSystem({ axiom: 'A', rules: { A: 'AB', B: 'A' }, iterations: 5 });
  // Fibonacci L-system: A, AB, ABA, ABAAB, ABAABABA, ABAABABAABAAB
  assert.equal(l.generate(0), 'A');
  assert.equal(l.generate(1), 'AB');
  assert.equal(l.generate(2), 'ABA');
  assert.equal(l.generate(3), 'ABAAB');
  assert.equal(l.generate(4), 'ABAABABA');
  assert.equal(l.generate(5), 'ABAABABAABAAB');
});

test('fibonacci string lengths', () => {
  const l = new LSystem({ axiom: 'A', rules: { A: 'AB', B: 'A' } });
  // Lengths follow Fibonacci: 1, 2, 3, 5, 8, 13
  const lengths = [0, 1, 2, 3, 4, 5].map(n => l.generate(n).length);
  assert.deepEqual(lengths, [1, 2, 3, 5, 8, 13]);
});

test('Koch curve rewriting', () => {
  const l = new LSystem({ axiom: 'F', rules: { F: 'F+F-F-F+F' }, angle: 90 });
  assert.equal(l.generate(1), 'F+F-F-F+F');
});

test('identity rule (no rule for character)', () => {
  const l = new LSystem({ axiom: 'F+F', rules: { F: 'FF' } });
  assert.equal(l.generate(1), 'FF+FF');
});

// === Turtle Interpretation ===
test('straight line', () => {
  const l = new LSystem({ axiom: 'FFF', rules: {}, angle: 90, stepSize: 10 });
  const result = l.interpret(l.generate(0));
  assert.equal(result.segments.length, 3);
  assert.ok(Math.abs(result.segments[2].x2 - 30) < 0.001);
  assert.ok(Math.abs(result.segments[2].y2 - 0) < 0.001);
});

test('right angle turn', () => {
  const l = new LSystem({ axiom: 'F+F', rules: {}, angle: 90, stepSize: 10 });
  const result = l.interpret('F+F');
  assert.equal(result.segments.length, 2);
  // First segment: (0,0) -> (10,0)
  // Turn +90 (counterclockwise), second: (10,0) -> (10, 10) approximately
  assert.ok(Math.abs(result.segments[1].x2 - 10) < 0.001);
  assert.ok(Math.abs(result.segments[1].y2 - 10) < 0.001);
});

test('full square', () => {
  const l = new LSystem({ axiom: 'F+F+F+F', rules: {}, angle: 90, stepSize: 10 });
  const result = l.interpret('F+F+F+F');
  assert.equal(result.segments.length, 4);
  // Should return to approximately (0,0)
  const last = result.segments[3];
  assert.ok(Math.abs(last.x2 - 0) < 0.01);
  assert.ok(Math.abs(last.y2 - 0) < 0.01);
});

test('branching with push/pop', () => {
  const l = new LSystem({ axiom: 'F[+F]-F', rules: {}, angle: 90, stepSize: 10 });
  const result = l.interpret('F[+F]-F');
  assert.equal(result.segments.length, 3);
  // After branch returns, position should be at (10,0) + turn right -> (10,-10)
  // Wait: first F goes to (10,0), then [ saves state
  // +F draws from (10,0) at 90° -> (10,10), ] restores to (10,0)
  // -F draws from (10,0) at -90° -> (10,-10)
  assert.ok(Math.abs(result.segments[2].x2 - 10) < 0.01);
  assert.ok(Math.abs(result.segments[2].y2 + 10) < 0.01);
});

test('move without drawing (f)', () => {
  const l = new LSystem({ axiom: 'fF', rules: {}, angle: 90, stepSize: 10 });
  const result = l.interpret('fF');
  assert.equal(result.segments.length, 1);
  assert.ok(Math.abs(result.segments[0].x1 - 10) < 0.001);
});

test('reverse direction |', () => {
  const l = new LSystem({ axiom: 'F|F', rules: {}, angle: 90, stepSize: 10 });
  const result = l.interpret('F|F');
  assert.equal(result.segments.length, 2);
  // First F: (0,0)->(10,0), |: dir+=180, second F: (10,0)->(0,0)
  assert.ok(Math.abs(result.segments[1].x2 - 0) < 0.01);
});

test('bounds calculation', () => {
  const l = new LSystem({ axiom: 'F+F+F+F', rules: {}, angle: 90, stepSize: 10 });
  const result = l.interpret('F+F+F+F');
  assert.ok(result.bounds.minX <= 0);
  assert.ok(result.bounds.maxX >= 10);
  assert.ok(result.width > 0);
  assert.ok(result.height > 0);
});

// === SVG Output ===
test('SVG generation', () => {
  const l = new LSystem({ axiom: 'F+F', rules: {}, angle: 90, stepSize: 10 });
  const svg = l.toSVG({ iterations: 0 });
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('<line'));
  assert.ok(svg.includes('</svg>'));
});

test('SVG with custom options', () => {
  const l = new LSystem({ axiom: 'F', rules: {}, angle: 90, stepSize: 10 });
  const svg = l.toSVG({ iterations: 0, stroke: '#f00', strokeWidth: 2, background: '#000' });
  assert.ok(svg.includes('#f00'));
  assert.ok(svg.includes('stroke-width="2"'));
  assert.ok(svg.includes('#000'));
});

// === Points ===
test('toPoints', () => {
  const l = new LSystem({ axiom: 'FF', rules: {}, angle: 90, stepSize: 10 });
  const points = l.toPoints({ iterations: 0 });
  assert.equal(points.length, 3);
  assert.ok(Math.abs(points[2].x - 20) < 0.001);
});

// === Preset L-Systems ===
test('Koch snowflake', () => {
  const l = presets.kochSnowflake();
  const str = l.generate(2);
  assert.ok(str.length > 10);
  const result = l.interpret(str);
  assert.ok(result.segments.length > 10);
});

test('Sierpinski triangle', () => {
  const l = presets.sierpinski();
  const str = l.generate(3);
  assert.ok(str.length > 20);
  const result = l.interpret(str);
  assert.ok(result.segments.length > 10);
});

test('Dragon curve', () => {
  const l = presets.dragonCurve();
  const str = l.generate(8);
  assert.equal(str.length, 2 * (2 ** 8) - 1); // 2^n F's + 2^n-1 symbols
  const result = l.interpret(str);
  assert.ok(result.segments.length > 200);
});

test('Fractal plant', () => {
  const l = presets.fractalPlant();
  const str = l.generate(3);
  assert.ok(str.length > 50);
  const result = l.interpret(str);
  assert.ok(result.segments.length > 10);
});

test('Hilbert curve', () => {
  const l = presets.hilbert();
  const str = l.generate(3);
  const result = l.interpret(str);
  assert.ok(result.segments.length > 30);
});

test('Gosper curve', () => {
  const l = presets.gosper();
  const str = l.generate(3);
  const result = l.interpret(str);
  assert.ok(result.segments.length > 50);
});

test('Levy C curve', () => {
  const l = presets.levyCCurve();
  const str = l.generate(8);
  const result = l.interpret(str);
  assert.ok(result.segments.length > 200);
});

test('Koch curve iterations grow exponentially', () => {
  const l = presets.kochCurve();
  const sizes = [0, 1, 2, 3].map(n => {
    const str = l.generate(n);
    return l.interpret(str).segments.length;
  });
  // Koch: 1, 5, 25, 125 (5^n)
  assert.equal(sizes[0], 1);
  assert.equal(sizes[1], 5);
  assert.equal(sizes[2], 25);
  assert.equal(sizes[3], 125);
});

test('Square Koch island', () => {
  const l = presets.squareKochIsland();
  const str = l.generate(2);
  const result = l.interpret(str);
  assert.ok(result.segments.length > 50);
});

test('Barnsley fern', () => {
  const l = presets.barnsleyFern();
  const str = l.generate(3);
  const result = l.interpret(str);
  assert.ok(result.segments.length > 10);
});

test('Penrose tiling', () => {
  const l = presets.penroseTiling();
  const str = l.generate(3);
  const result = l.interpret(str);
  assert.ok(result.segments.length > 30);
});

// === Stochastic L-System ===
test('custom L-system', () => {
  const l = new LSystem({
    axiom: 'F',
    rules: { F: 'FF+[+F-F-F]-[-F+F+F]' },
    angle: 22.5,
    iterations: 2,
    stepSize: 5,
  });
  const str = l.generate();
  assert.ok(str.length > 20);
  const result = l.interpret(str);
  assert.ok(result.segments.length > 0);
  const svg = l.toSVG();
  assert.ok(svg.includes('<svg'));
});

// === Edge cases ===
test('empty axiom', () => {
  const l = new LSystem({ axiom: '', rules: { A: 'B' } });
  assert.equal(l.generate(5), '');
});

test('no matching rules', () => {
  const l = new LSystem({ axiom: 'XYZ', rules: { A: 'B' } });
  assert.equal(l.generate(5), 'XYZ');
});

test('zero iterations', () => {
  const l = new LSystem({ axiom: 'ABC', rules: { A: 'X' } });
  assert.equal(l.generate(0), 'ABC');
});

test('Sierpinski arrowhead', () => {
  const l = presets.sierpinskiArrowhead();
  const str = l.generate(4);
  const result = l.interpret(str);
  assert.ok(result.segments.length > 50);
});

test('SVG for all presets', () => {
  for (const [name, factory] of Object.entries(presets)) {
    const l = factory();
    const svg = l.toSVG({ iterations: 2 });
    assert.ok(svg.includes('<svg'), `${name} should produce valid SVG`);
    assert.ok(svg.includes('<line'), `${name} should have line segments`);
  }
});
