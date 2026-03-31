const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseWav, createWav, sine, square, sawtooth } = require('../src/index.js');

test('create and parse WAV roundtrip', () => {
  const samples = sine(440, 0.1, 44100);
  const wav = createWav(samples);
  const parsed = parseWav(wav);
  
  assert.equal(parsed.format.sampleRate, 44100);
  assert.equal(parsed.format.numChannels, 1);
  assert.equal(parsed.format.bitsPerSample, 16);
  assert.ok(Math.abs(parsed.duration - 0.1) < 0.001);
});

test('sine wave', () => {
  const samples = sine(440, 0.01, 44100);
  assert.equal(samples.length, 441);
  assert.ok(Math.abs(samples[0]) < 0.01); // starts near 0
});

test('square wave', () => {
  const samples = square(100, 0.01, 44100);
  assert.ok(samples.length > 0);
  // Should only be 1 or -1
  for (const s of samples) assert.ok(s === 1 || s === -1);
});

test('sawtooth wave', () => {
  const samples = sawtooth(100, 0.01, 44100);
  assert.ok(samples.length > 0);
  // Should range -1 to 1
  for (const s of samples) assert.ok(s >= -1 && s <= 1);
});

test('WAV header structure', () => {
  const wav = createWav(new Float32Array(100));
  // Check RIFF header
  assert.equal(wav[0], 'R'.charCodeAt(0));
  assert.equal(wav[1], 'I'.charCodeAt(0));
  assert.equal(wav[2], 'F'.charCodeAt(0));
  assert.equal(wav[3], 'F'.charCodeAt(0));
  assert.equal(wav[8], 'W'.charCodeAt(0));
});

test('custom sample rate', () => {
  const samples = new Float32Array(100);
  const wav = createWav(samples, { sampleRate: 22050 });
  const parsed = parseWav(wav);
  assert.equal(parsed.format.sampleRate, 22050);
});

test('sample values preserved (approximately)', () => {
  const original = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const wav = createWav(original);
  const parsed = parseWav(wav);
  for (let i = 0; i < original.length; i++) {
    assert.ok(Math.abs(parsed.samples[i] - original[i]) < 0.001);
  }
});
