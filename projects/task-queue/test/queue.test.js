import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TaskQueue } from '../src/index.js';

const delay = ms => new Promise(r => setTimeout(r, ms));

describe('Basic queue', () => {
  it('executes tasks', async () => {
    const q = new TaskQueue();
    const result = await q.add(() => Promise.resolve(42));
    assert.equal(result, 42);
  });

  it('sequential by default (concurrency 1)', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const order = [];
    const p1 = q.add(async () => { order.push('start-1'); await delay(10); order.push('end-1'); });
    const p2 = q.add(async () => { order.push('start-2'); await delay(10); order.push('end-2'); });
    await Promise.all([p1, p2]);
    assert.deepEqual(order, ['start-1', 'end-1', 'start-2', 'end-2']);
  });

  it('parallel with concurrency > 1', async () => {
    const q = new TaskQueue({ concurrency: 3 });
    let maxConcurrent = 0, current = 0;
    const tasks = Array.from({ length: 6 }, () => async () => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await delay(10);
      current--;
    });
    await q.addAll(tasks);
    assert.ok(maxConcurrent <= 3);
    assert.ok(maxConcurrent > 1);
  });
});

describe('Priority', () => {
  it('higher priority runs first', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const order = [];
    // First task blocks while others are added
    const p1 = q.add(async () => { await delay(10); order.push('normal'); });
    const p2 = q.add(async () => { order.push('low'); }, { priority: 0 });
    const p3 = q.add(async () => { order.push('high'); }, { priority: 10 });
    await Promise.all([p1, p2, p3]);
    assert.equal(order[0], 'normal'); // Already started
    assert.equal(order[1], 'high');   // Higher priority
    assert.equal(order[2], 'low');
  });
});

describe('Retries', () => {
  it('retries failed tasks', async () => {
    const q = new TaskQueue({ retries: 2, retryDelay: 10 });
    let attempts = 0;
    const result = await q.add(async () => {
      attempts++;
      if (attempts < 3) throw new Error('fail');
      return 'success';
    });
    assert.equal(result, 'success');
    assert.equal(attempts, 3);
  });

  it('fails after exhausting retries', async () => {
    const q = new TaskQueue({ retries: 1, retryDelay: 10 });
    try {
      await q.add(async () => { throw new Error('always fails'); });
      assert.fail();
    } catch (err) {
      assert.equal(err.message, 'always fails');
    }
  });
});

describe('Timeout', () => {
  it('times out slow tasks', async () => {
    const q = new TaskQueue({ timeout: 50 });
    try {
      await q.add(() => delay(200));
      assert.fail();
    } catch (err) {
      assert.equal(err.message, 'Task timeout');
    }
  });
});

describe('Pause/Resume', () => {
  it('pauses and resumes', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    const order = [];

    q.add(async () => { order.push(1); });
    q.pause();
    q.add(async () => { order.push(2); });

    await delay(20);
    assert.deepEqual(order, [1]); // Only first ran

    q.resume();
    await q.onIdle();
    assert.deepEqual(order, [1, 2]);
  });
});

describe('Stats', () => {
  it('tracks completed and failed', async () => {
    const q = new TaskQueue({ concurrency: 2 });
    await q.add(() => Promise.resolve());
    try { await q.add(() => Promise.reject(new Error('x'))); } catch {}
    assert.equal(q.completed, 1);
    assert.equal(q.failed, 1);
  });
});

describe('Events', () => {
  it('fires done event', async () => {
    const q = new TaskQueue();
    const results = [];
    q.on('done', r => results.push(r));
    await q.add(() => Promise.resolve(42));
    assert.deepEqual(results, [42]);
  });

  it('fires drain event', async () => {
    const q = new TaskQueue({ concurrency: 2 });
    let drained = false;
    q.on('drain', () => { drained = true; });
    await q.addAll([() => delay(5), () => delay(5)]);
    await delay(20);
    assert.equal(drained, true);
  });
});

describe('Clear', () => {
  it('rejects pending tasks', async () => {
    const q = new TaskQueue({ concurrency: 1 });
    q.add(() => delay(100));
    const p = q.add(() => Promise.resolve('never'));
    q.clear();
    try { await p; assert.fail(); }
    catch (e) { assert.equal(e.message, 'Queue cleared'); }
  });
});
