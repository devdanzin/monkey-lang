import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { gradient, interpolate, presets } from '../src/index.js';
describe('gradient', () => {
  it('basic 2 colors', () => { const g = gradient(['#000000', '#ffffff'], 5); assert.equal(g.length, 5); assert.equal(g[0], '#000000'); assert.equal(g[4], '#ffffff'); });
  it('3 colors', () => { const g = gradient(['#ff0000', '#00ff00', '#0000ff'], 7); assert.equal(g.length, 7); });
  it('needs 2+ colors', () => assert.throws(() => gradient(['#fff'], 5)));
});
describe('interpolate', () => {
  it('midpoint', () => assert.equal(interpolate('#000000', '#ffffff', 0.5), '#808080'));
  it('start', () => assert.equal(interpolate('#ff0000', '#0000ff', 0), '#ff0000'));
  it('end', () => assert.equal(interpolate('#ff0000', '#0000ff', 1), '#0000ff'));
});
describe('presets', () => {
  it('rainbow', () => assert.equal(presets.rainbow.length, 6));
  it('grayscale', () => assert.equal(presets.grayscale[0], '#000000'));
});
