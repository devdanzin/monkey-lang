import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { debounce, throttle } from '../src/index.js';

describe('debounce', () => {
  it('delays execution', async () => {
    let count = 0;
    const fn = debounce(() => count++, 50);
    fn(); fn(); fn();
    assert.equal(count, 0);
    await new Promise(r => setTimeout(r, 70));
    assert.equal(count, 1);
  });

  it('cancel prevents execution', async () => {
    let count = 0;
    const fn = debounce(() => count++, 50);
    fn();
    fn.cancel();
    await new Promise(r => setTimeout(r, 70));
    assert.equal(count, 0);
  });

  it('flush triggers immediately', () => {
    let count = 0;
    const fn = debounce(() => count++, 1000);
    fn();
    fn.flush();
    assert.equal(count, 1);
  });

  it('pending returns status', () => {
    const fn = debounce(() => {}, 100);
    assert.equal(fn.pending(), false);
    fn();
    assert.equal(fn.pending(), true);
  });

  it('leading fires immediately', () => {
    let count = 0;
    const fn = debounce(() => count++, 100, { leading: true, trailing: false });
    fn();
    assert.equal(count, 1);
  });
});

describe('throttle', () => {
  it('limits call rate', async () => {
    let count = 0;
    const fn = throttle(() => count++, 50);
    fn(); fn(); fn(); // only first should fire immediately
    assert.equal(count, 1);
    await new Promise(r => setTimeout(r, 70));
    assert.ok(count <= 3);
  });

  it('cancel', () => {
    let count = 0;
    const fn = throttle(() => count++, 100);
    fn();
    fn.cancel();
    assert.equal(count, 1); // leading already fired
  });
});
