import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Pipeline, compose } from '../src/index.js';

describe('Pipeline', () => {
  it('executes middleware', async () => {
    const p = new Pipeline();
    p.use(async (ctx, next) => { ctx.a = 1; await next(); });
    p.use(async (ctx) => { ctx.b = 2; });
    const ctx = await p.execute();
    assert.deepEqual(ctx, { a: 1, b: 2 });
  });

  it('executes in order', async () => {
    const log = [];
    const p = new Pipeline();
    p.use(async (_, next) => { log.push('A start'); await next(); log.push('A end'); });
    p.use(async (_, next) => { log.push('B start'); await next(); log.push('B end'); });
    await p.execute();
    assert.deepEqual(log, ['A start', 'B start', 'B end', 'A end']);
  });

  it('can short-circuit', async () => {
    const p = new Pipeline();
    p.use(async (ctx) => { ctx.done = true; /* no next() */ });
    p.use(async (ctx) => { ctx.skipped = true; });
    const ctx = await p.execute();
    assert.equal(ctx.done, true);
    assert.equal(ctx.skipped, undefined);
  });

  it('error handling', async () => {
    const p = new Pipeline();
    p.use(async () => { throw new Error('oops'); });
    p.onError((err, ctx) => { ctx.error = err.message; });
    const ctx = await p.execute();
    assert.equal(ctx.error, 'oops');
  });

  it('passes context through', async () => {
    const p = new Pipeline();
    p.use(async (ctx, next) => { ctx.count = (ctx.count || 0) + 1; await next(); });
    p.use(async (ctx, next) => { ctx.count++; await next(); });
    const ctx = await p.execute({ count: 0 });
    assert.equal(ctx.count, 2);
  });
});

describe('compose', () => {
  it('composes functions', async () => {
    const fn = compose(
      async (ctx, next) => { ctx.x = 1; await next(); },
      async (ctx) => { ctx.y = 2; }
    );
    const ctx = await fn({});
    assert.deepEqual(ctx, { x: 1, y: 2 });
  });
});
