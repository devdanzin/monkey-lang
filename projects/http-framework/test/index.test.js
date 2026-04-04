import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { App, Router, cors } from '../src/index.js';

let server = null;
let currentPort = 18234;

function startApp(app) {
  const port = currentPort++;
  return new Promise((resolve) => {
    server = app.listen(port, () => resolve(port));
  });
}

function fetch(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://localhost:${port}`);
    const req = http.request({
      hostname: 'localhost', port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, data, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

afterEach(() => { if (server) { server.close(); server = null; } });

describe('Routing', () => {
  it('GET', async () => {
    const app = new App();
    app.get('/hello', (req, res) => res.json({ message: 'hello' }));
    const port = await startApp(app);
    const r = await fetch(port, '/hello');
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, { message: 'hello' });
  });

  it('POST with body', async () => {
    const app = new App();
    app.post('/data', async (req, res) => {
      await req.parseBody();
      res.json({ received: req.body });
    });
    const port = await startApp(app);
    const r = await fetch(port, '/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
    });
    assert.deepEqual(r.data.received, { name: 'test' });
  });

  it('404 for unknown', async () => {
    const app = new App();
    app.get('/exists', (req, res) => res.json({ ok: true }));
    const port = await startApp(app);
    const r = await fetch(port, '/nope');
    assert.equal(r.status, 404);
  });

  it('path params', async () => {
    const app = new App();
    app.get('/users/:id', (req, res) => res.json({ id: req.params.id }));
    const port = await startApp(app);
    const r = await fetch(port, '/users/42');
    assert.equal(r.data.id, '42');
  });

  it('multiple path params', async () => {
    const app = new App();
    app.get('/users/:uid/posts/:pid', (req, res) => res.json(req.params));
    const port = await startApp(app);
    const r = await fetch(port, '/users/5/posts/10');
    assert.equal(r.data.uid, '5');
    assert.equal(r.data.pid, '10');
  });

  it('query params', async () => {
    const app = new App();
    app.get('/search', (req, res) => res.json(req.query));
    const port = await startApp(app);
    const r = await fetch(port, '/search?q=hello&page=2');
    assert.equal(r.data.q, 'hello');
    assert.equal(r.data.page, '2');
  });
});

describe('Middleware', () => {
  it('runs before handler', async () => {
    const app = new App();
    const log = [];
    app.use((req, res, next) => { log.push('mw'); next(); });
    app.get('/', (req, res) => { log.push('handler'); res.json({ ok: true }); });
    const port = await startApp(app);
    await fetch(port, '/');
    assert.deepEqual(log, ['mw', 'handler']);
  });

  it('can short-circuit (auth)', async () => {
    const app = new App();
    app.use((req, res, next) => {
      if (req.headers['x-auth'] !== 'secret') { res.status(401).json({ error: 'no' }); return; }
      next();
    });
    app.get('/protected', (req, res) => res.json({ data: 'yes' }));
    const port = await startApp(app);
    assert.equal((await fetch(port, '/protected')).status, 401);
    assert.equal((await fetch(port, '/protected', { headers: { 'x-auth': 'secret' } })).status, 200);
  });

  it('chains', async () => {
    const app = new App();
    const order = [];
    app.use((req, res, next) => { order.push(1); next(); });
    app.use((req, res, next) => { order.push(2); next(); });
    app.get('/', (req, res) => { order.push(3); res.json({ order }); });
    const port = await startApp(app);
    const r = await fetch(port, '/');
    assert.deepEqual(r.data.order, [1, 2, 3]);
  });
});

describe('Response', () => {
  it('text response', async () => {
    const app = new App();
    app.get('/', (req, res) => res.text('hello'));
    const port = await startApp(app);
    const r = await fetch(port, '/');
    assert.equal(r.data, 'hello');
  });

  it('custom status', async () => {
    const app = new App();
    app.post('/items', (req, res) => res.status(201).json({ created: true }));
    const port = await startApp(app);
    const r = await fetch(port, '/items', { method: 'POST' });
    assert.equal(r.status, 201);
  });

  it('custom header', async () => {
    const app = new App();
    app.get('/', (req, res) => res.header('X-Custom', 'test').json({}));
    const port = await startApp(app);
    const r = await fetch(port, '/');
    assert.equal(r.headers['x-custom'], 'test');
  });
});

describe('CORS', () => {
  it('adds headers', async () => {
    const app = new App();
    app.use(cors());
    app.get('/', (req, res) => res.json({}));
    const port = await startApp(app);
    const r = await fetch(port, '/');
    assert.equal(r.headers['access-control-allow-origin'], '*');
  });
});

describe('Sub-router', () => {
  it('mounts with prefix', async () => {
    const app = new App();
    const api = new Router();
    api.get('/users', (req, res) => res.json({ users: [] }));
    app.use('/api', api);
    const port = await startApp(app);
    const r = await fetch(port, '/api/users');
    assert.deepEqual(r.data, { users: [] });
  });
});

describe('Error handling', () => {
  it('500 on throw', async () => {
    const app = new App();
    app.get('/boom', () => { throw new Error('kaboom'); });
    const port = await startApp(app);
    const r = await fetch(port, '/boom');
    assert.equal(r.status, 500);
    assert.equal(r.data.error, 'kaboom');
  });
});
