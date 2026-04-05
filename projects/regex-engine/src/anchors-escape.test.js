// anchors-escape.test.js — Anchor and escape sequence tests

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { match } from './regex.js';

describe('Anchors and Escapes', () => {
  it('escaped dot matches literal dot', () => {
    assert.ok(match('\\.', '.'));
    assert.ok(!match('\\.', 'a'));
  });

  it('escaped star matches literal star', () => {
    assert.ok(match('\\*', '*'));
    assert.ok(!match('\\*', 'a'));
  });

  it('escaped plus matches literal plus', () => {
    assert.ok(match('\\+', '+'));
    assert.ok(!match('\\+', 'a'));
  });

  it('escaped question mark', () => {
    assert.ok(match('\\?', '?'));
    assert.ok(!match('\\?', 'a'));
  });

  it('escaped parentheses', () => {
    assert.ok(match('\\(\\)', '()'));
    assert.ok(!match('\\(\\)', 'ab'));
  });

  it('escaped pipe', () => {
    assert.ok(match('\\|', '|'));
    assert.ok(!match('\\|', 'a'));
  });

  it('escaped backslash', () => {
    assert.ok(match('\\\\', '\\'));
  });

  it('dot matches any character', () => {
    assert.ok(match('.', 'a'));
    assert.ok(match('.', '1'));
    assert.ok(match('.', ' '));
    assert.ok(!match('.', '')); // dot needs exactly one char
  });

  it('mixed literal and special', () => {
    assert.ok(match('a\\.b', 'a.b'));
    assert.ok(!match('a\\.b', 'axb'));
  });

  it('escaped in repetition', () => {
    assert.ok(match('\\.+', '...'));
    assert.ok(!match('\\.+', ''));
  });
});
