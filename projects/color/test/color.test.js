import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Color } from '../src/index.js';

describe('Construction', () => {
  it('from RGB', () => { const c = new Color(255, 128, 0); assert.equal(c.r, 255); assert.equal(c.g, 128); assert.equal(c.b, 0); });
  it('fromHex', () => { const c = Color.fromHex('#ff8000'); assert.equal(c.r, 255); assert.equal(c.g, 128); assert.equal(c.b, 0); });
  it('fromHex short', () => { const c = Color.fromHex('#f00'); assert.equal(c.r, 255); assert.equal(c.g, 0); assert.equal(c.b, 0); });
  it('fromHsl', () => { const c = Color.fromHsl(0, 100, 50); assert.equal(c.r, 255); assert.equal(c.g, 0); assert.equal(c.b, 0); });
});

describe('Conversion', () => {
  it('toHex', () => { assert.equal(new Color(255, 0, 128).toHex(), '#ff0080'); });
  it('toRgb', () => { assert.equal(new Color(255, 0, 0).toRgb(), 'rgb(255, 0, 0)'); });
  it('toHsl', () => { const hsl = new Color(255, 0, 0).toHsl(); assert.equal(hsl.h, 0); assert.equal(hsl.s, 100); assert.equal(hsl.l, 50); });
  it('roundtrips hex', () => { const c = Color.fromHex('#3498db'); assert.equal(c.toHex(), '#3498db'); });
});

describe('Manipulation', () => {
  it('lighten', () => { const c = new Color(128, 0, 0).lighten(20); assert.ok(c.toHsl().l > 25); });
  it('darken', () => { const c = new Color(128, 0, 0).darken(10); assert.ok(c.toHsl().l < 25); });
  it('invert', () => { const c = new Color(255, 0, 128).invert(); assert.equal(c.r, 0); assert.equal(c.g, 255); assert.equal(c.b, 127); });
  it('grayscale', () => { const c = new Color(255, 0, 0).grayscale(); assert.ok(c.r === c.g && c.g === c.b); });
  it('rotate', () => { const { h } = new Color(255, 0, 0).rotate(120).toHsl(); assert.ok(h >= 118 && h <= 122); });
  it('opacity', () => { assert.equal(new Color(255, 0, 0).opacity(0.5).a, 0.5); });
});

describe('Analysis', () => {
  it('luminance', () => { assert.ok(Color.WHITE.luminance() > 0.9); assert.ok(Color.BLACK.luminance() < 0.01); });
  it('contrastRatio', () => { const ratio = Color.WHITE.contrastRatio(Color.BLACK); assert.ok(ratio > 20); });
  it('isLight/isDark', () => { assert.equal(Color.WHITE.isLight(), true); assert.equal(Color.BLACK.isDark(), true); });
  it('equals', () => { assert.equal(new Color(255, 0, 0).equals(Color.RED), true); });
});

describe('Interpolation', () => {
  it('lerp midpoint', () => { const c = Color.lerp(Color.BLACK, Color.WHITE, 0.5); assert.ok(c.r >= 127 && c.r <= 128); });
  it('gradient', () => { const g = Color.gradient(Color.BLACK, Color.WHITE, 5); assert.equal(g.length, 5); assert.equal(g[0].r, 0); assert.equal(g[4].r, 255); });
});

describe('Palettes', () => {
  it('complementary', () => { const p = Color.complementary(Color.RED); assert.equal(p.length, 2); });
  it('triadic', () => { assert.equal(Color.triadic(Color.RED).length, 3); });
  it('analogous', () => { assert.equal(Color.analogous(Color.RED).length, 3); });
  it('splitComplementary', () => { assert.equal(Color.splitComplementary(Color.RED).length, 3); });
});
