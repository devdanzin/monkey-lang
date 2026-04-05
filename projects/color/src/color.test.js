import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Color } from './color.js';

describe('Parse', () => {
  it('hex 6-digit', () => { const c = Color.parse('#ff8000'); assert.equal(c.r, 255); assert.equal(c.g, 128); assert.equal(c.b, 0); });
  it('hex 3-digit', () => { const c = Color.parse('#f00'); assert.equal(c.r, 255); assert.equal(c.g, 0); });
  it('hex 8-digit', () => { const c = Color.parse('#ff000080'); assert.equal(c.r, 255); assert.ok(Math.abs(c.a - 0.502) < 0.01); });
  it('rgb', () => { const c = Color.parse('rgb(100, 150, 200)'); assert.equal(c.r, 100); assert.equal(c.g, 150); });
  it('rgba', () => { const c = Color.parse('rgba(100, 150, 200, 0.5)'); assert.equal(c.a, 0.5); });
  it('named', () => { const c = Color.parse('red'); assert.equal(c.r, 255); assert.equal(c.g, 0); });
  it('hsl', () => { const c = Color.parse('hsl(0, 100%, 50%)'); assert.equal(c.r, 255); assert.equal(c.g, 0); });
});

describe('Convert', () => {
  it('toHex', () => { assert.equal(new Color(255, 128, 0).toHex(), '#ff8000'); });
  it('toRgb', () => { assert.equal(new Color(100, 150, 200).toRgb(), 'rgb(100, 150, 200)'); });
  it('toRgba', () => { assert.ok(new Color(100, 150, 200, 0.5).toRgb().startsWith('rgba')); });
  it('toHSL', () => { const hsl = new Color(255, 0, 0).toHSL(); assert.equal(hsl.h, 0); assert.equal(hsl.s, 100); assert.equal(hsl.l, 50); });
  it('roundtrip hex', () => { assert.equal(Color.parse('#1a2b3c').toHex(), '#1a2b3c'); });
});

describe('Manipulation', () => {
  it('lighten', () => { const c = Color.parse('#800000').lighten(20); assert.ok(c.toHSL().l > 25); });
  it('darken', () => { const c = Color.parse('#ff0000').darken(20); assert.ok(c.toHSL().l < 50); });
  it('saturate', () => { const c = Color.parse('hsl(0, 50%, 50%)').saturate(20); assert.ok(c.toHSL().s >= 70); });
  it('desaturate', () => { const c = Color.parse('hsl(0, 50%, 50%)').desaturate(20); assert.ok(c.toHSL().s <= 30); });
  it('grayscale', () => { const c = new Color(255, 0, 0).grayscale(); assert.equal(c.r, c.g); assert.equal(c.g, c.b); });
  it('invert', () => { const c = new Color(100, 150, 200).invert(); assert.equal(c.r, 155); assert.equal(c.g, 105); });
  it('alpha', () => { const c = Color.parse('#ff0000').alpha(0.5); assert.equal(c.a, 0.5); });
  it('mix', () => { const c = Color.parse('#ff0000').mix(Color.parse('#0000ff'), 0.5); assert.ok(c.r > 100 && c.b > 100); });
});

describe('Accessibility', () => {
  it('contrast ratio black/white', () => {
    const ratio = Color.parse('#000000').contrastRatio(Color.parse('#ffffff'));
    assert.ok(ratio > 20);
  });
  it('isAccessible AA', () => { assert.ok(Color.parse('#000000').isAccessible(Color.parse('#ffffff'), 'AA')); });
  it('isAccessible fails low contrast', () => { assert.ok(!Color.parse('#777777').isAccessible(Color.parse('#888888'), 'AA')); });
});

describe('Palette', () => {
  it('complementary', () => { const c = Color.parse('#ff0000').complementary(); assert.ok(Math.abs(c.toHSL().h - 180) < 5); });
  it('triadic', () => { const [a, b] = Color.parse('#ff0000').triadic(); assert.equal(a.toHSL().h, 120); assert.equal(b.toHSL().h, 240); });
  it('analogous', () => { const [a, b] = Color.parse('#ff0000').analogous(); assert.equal(a.toHSL().h, 30); assert.equal(b.toHSL().h, 330); });
});

describe('Equals', () => {
  it('equal colors', () => { assert.ok(new Color(255, 0, 0).equals(new Color(255, 0, 0))); });
  it('not equal', () => { assert.ok(!new Color(255, 0, 0).equals(new Color(0, 0, 255))); });
});
