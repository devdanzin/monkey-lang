import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Router, parseQuery } from '../src/index.js';

describe('Route matching', () => {
  it('exact path', () => {
    const r = new Router();
    r.get('/hello', (req, res) => { res.body = 'world'; });
    const m = r.match('GET', '/hello');
    assert.ok(m);
    assert.equal(m.params && Object.keys(m.params).length, 0);
  });

  it('path params', () => {
    const r = new Router();
    r.get('/users/:id', (req, res) => {});
    const m = r.match('GET', '/users/42');
    assert.equal(m.params.id, '42');
  });

  it('multiple params', () => {
    const r = new Router();
    r.get('/users/:userId/posts/:postId', () => {});
    const m = r.match('GET', '/users/5/posts/10');
    assert.equal(m.params.userId, '5');
    assert.equal(m.params.postId, '10');
  });

  it('wildcard', () => {
    const r = new Router();
    r.get('/files/*', () => {});
    const m = r.match('GET', '/files/path/to/file.txt');
    assert.ok(m);
  });

  it('method filtering', () => {
    const r = new Router();
    r.get('/x', () => {});
    assert.ok(r.match('GET', '/x'));
    assert.equal(r.match('POST', '/x'), null);
  });

  it('all() matches any method', () => {
    const r = new Router();
    r.all('/x', () => {});
    assert.ok(r.match('GET', '/x'));
    assert.ok(r.match('POST', '/x'));
    assert.ok(r.match('DELETE', '/x'));
  });

  it('no match returns null', () => {
    const r = new Router();
    r.get('/hello', () => {});
    assert.equal(r.match('GET', '/nope'), null);
  });
});

describe('Query string', () => {
  it('parses query params', () => {
    const r = new Router();
    r.get('/search', () => {});
    const m = r.match('GET', '/search?q=hello&page=2');
    assert.equal(m.query.q, 'hello');
    assert.equal(m.query.page, '2');
  });

  it('parseQuery', () => {
    assert.deepEqual(parseQuery('a=1&b=2'), { a: '1', b: '2' });
    assert.deepEqual(parseQuery(''), {});
    assert.deepEqual(parseQuery(undefined), {});
  });
});

describe('handle()', () => {
  it('executes handler', async () => {
    const r = new Router();
    r.get('/hello', (req, res) => { res.body = 'world'; });
    const result = await r.handle('GET', '/hello');
    assert.equal(result.body, 'world');
  });

  it('handler gets params', async () => {
    const r = new Router();
    r.get('/users/:id', (req, res) => { res.body = `User ${req.params.id}`; });
    const result = await r.handle('GET', '/users/42');
    assert.equal(result.body, 'User 42');
  });
});

describe('Middleware', () => {
  it('runs before route handler', async () => {
    const r = new Router();
    const order = [];
    r.use((req, res, next) => { order.push('mw'); next(); });
    r.get('/x', (req, res) => { order.push('handler'); res.body = 'ok'; });
    await r.handle('GET', '/x');
    assert.deepEqual(order, ['mw', 'handler']);
  });

  it('path-scoped middleware', async () => {
    const r = new Router();
    const log = [];
    r.use('/api', (req, res, next) => { log.push('api-mw'); next(); });
    r.get('/api/data', (req, res) => { res.body = 'data'; });
    r.get('/other', (req, res) => { res.body = 'other'; });

    await r.handle('GET', '/api/data');
    assert.deepEqual(log, ['api-mw']);
    log.length = 0;

    await r.handle('GET', '/other');
    assert.deepEqual(log, []); // API middleware didn't run
  });
});

describe('Sub-routers', () => {
  it('mounts sub-router', async () => {
    const api = new Router();
    api.get('/users', (req, res) => { res.body = 'users'; });
    api.get('/posts', (req, res) => { res.body = 'posts'; });

    const r = new Router();
    r.use('/api', api);

    const result1 = await r.handle('GET', '/api/users');
    assert.equal(result1.body, 'users');

    const result2 = await r.handle('GET', '/api/posts');
    assert.equal(result2.body, 'posts');
  });
});

describe('Not found', () => {
  it('custom 404', async () => {
    const r = new Router();
    r.notFound((ctx) => ({ body: '404', status: 404 }));
    const result = await r.handle('GET', '/nope');
    assert.equal(result.body, '404');
  });
});
