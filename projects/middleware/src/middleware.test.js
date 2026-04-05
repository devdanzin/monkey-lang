import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compose, named, when, errorHandler, App } from './middleware.js';

describe('compose', () => {
  it('executes in order', async () => {
    const order = [];
    const mw = compose([
      async (ctx, next) => { order.push(1); await next(); order.push(4); },
      async (ctx, next) => { order.push(2); await next(); order.push(3); },
    ]);
    await mw({});
    assert.deepStrictEqual(order, [1, 2, 3, 4]); // onion model
  });

  it('propagates context', async () => {
    const ctx = {};
    const mw = compose([
      async (ctx, next) => { ctx.a = 1; await next(); },
      async (ctx, next) => { ctx.b = ctx.a + 1; await next(); },
    ]);
    await mw(ctx);
    assert.equal(ctx.b, 2);
  });

  it('handles async', async () => {
    const mw = compose([
      async (ctx, next) => { await new Promise(r => setTimeout(r, 5)); ctx.val = 42; await next(); },
    ]);
    const ctx = {};
    await mw(ctx);
    assert.equal(ctx.val, 42);
  });

  it('throws on multiple next()', async () => {
    const mw = compose([
      async (ctx, next) => { await next(); await next(); },
    ]);
    await assert.rejects(() => mw({}), /multiple times/);
  });

  it('empty middleware', async () => {
    const mw = compose([]);
    await mw({}); // should not throw
  });

  it('error propagation', async () => {
    const mw = compose([
      async () => { throw new Error('boom'); },
    ]);
    await assert.rejects(() => mw({}), /boom/);
  });
});

describe('named', () => {
  it('assigns name', () => {
    const fn = named('logger', (ctx, next) => next());
    assert.equal(fn._name, 'logger');
  });
});

describe('when', () => {
  it('runs when true', async () => {
    const ctx = {};
    const mw = compose([
      when(true, async (ctx, next) => { ctx.ran = true; await next(); }),
    ]);
    await mw(ctx);
    assert.ok(ctx.ran);
  });

  it('skips when false', async () => {
    const ctx = {};
    const mw = compose([
      when(false, async (ctx, next) => { ctx.ran = true; await next(); }),
    ]);
    await mw(ctx);
    assert.equal(ctx.ran, undefined);
  });

  it('function condition', async () => {
    const ctx = { admin: true };
    const mw = compose([
      when(ctx => ctx.admin, async (ctx, next) => { ctx.access = true; await next(); }),
    ]);
    await mw(ctx);
    assert.ok(ctx.access);
  });
});

describe('errorHandler', () => {
  it('catches errors', async () => {
    let caught;
    const mw = compose([
      errorHandler((err) => { caught = err.message; }),
      async () => { throw new Error('test error'); },
    ]);
    await mw({});
    assert.equal(caught, 'test error');
  });
});

describe('App', () => {
  it('runs middleware', async () => {
    const app = new App();
    app.use(async (ctx, next) => { ctx.x = 1; await next(); });
    app.use(async (ctx, next) => { ctx.y = 2; await next(); });
    const ctx = await app.run({});
    assert.equal(ctx.x, 1);
    assert.equal(ctx.y, 2);
  });

  it('chaining use', () => {
    const app = new App();
    const result = app.use(() => {}).use(() => {});
    assert.ok(result instanceof App);
  });
});
