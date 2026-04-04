// server.test.js — Integration tests for HTTP server with real TCP connections

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { HttpServer } from './server.js';
import { connect } from 'node:net';

// Helper: make a raw HTTP request via TCP
function rawRequest(port, request, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const socket = connect(port, host, () => {
      socket.write(request);
    });
    let data = '';
    socket.on('data', (chunk) => { data += chunk.toString(); });
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
    // Auto-close after 2s
    setTimeout(() => { socket.destroy(); resolve(data); }, 2000);
  });
}

// Helper: parse raw HTTP response
function parseResponse(raw) {
  const [head, ...bodyParts] = raw.split('\r\n\r\n');
  const lines = head.split('\r\n');
  const [, statusCode, statusText] = lines[0].match(/HTTP\/1\.1 (\d+) (.+)/);
  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const [k, v] = lines[i].split(': ');
    headers[k.toLowerCase()] = v;
  }
  const body = bodyParts.join('\r\n\r\n');
  return { statusCode: parseInt(statusCode), statusText, headers, body };
}

describe('HTTP Server', () => {
  let server;
  let port;

  before(async () => {
    server = new HttpServer({ keepAliveTimeout: 1000 });

    // Middleware: log
    server.use((req, res, next) => {
      req._startTime = Date.now();
      next();
    });

    // Routes
    server.get('/', (req, res) => {
      res.json({ message: 'Hello, World!' });
    });

    server.get('/text', (req, res) => {
      res.text('plain text response');
    });

    server.get('/html', (req, res) => {
      res.html('<h1>Hello</h1>');
    });

    server.get('/users/:id', (req, res) => {
      res.json({ id: req.params.id });
    });

    server.get('/users/:id/posts/:postId', (req, res) => {
      res.json({ userId: req.params.id, postId: req.params.postId });
    });

    server.post('/echo', (req, res) => {
      res.json({ received: req.body, json: req.json });
    });

    server.get('/query', (req, res) => {
      res.json(req.query);
    });

    server.get('/error', (req, res) => {
      throw new Error('Intentional error');
    });

    server.get('/status/:code', (req, res) => {
      res.status(parseInt(req.params.code)).json({ status: req.params.code });
    });

    const addr = await server.listen(0);
    port = addr.port;
  });

  after(async () => {
    await server.close();
  });

  describe('Basic routes', () => {
    it('GET / returns JSON', async () => {
      const raw = await rawRequest(port, 'GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const res = parseResponse(raw);
      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['content-type'].includes('application/json'));
      assert.deepStrictEqual(JSON.parse(res.body), { message: 'Hello, World!' });
    });

    it('GET /text returns plain text', async () => {
      const raw = await rawRequest(port, 'GET /text HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const res = parseResponse(raw);
      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['content-type'].includes('text/plain'));
      assert.equal(res.body, 'plain text response');
    });

    it('GET /html returns HTML', async () => {
      const raw = await rawRequest(port, 'GET /html HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const res = parseResponse(raw);
      assert.ok(res.headers['content-type'].includes('text/html'));
      assert.equal(res.body, '<h1>Hello</h1>');
    });
  });

  describe('Route params', () => {
    it('captures :id param', async () => {
      const raw = await rawRequest(port, 'GET /users/42 HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const res = parseResponse(raw);
      assert.deepStrictEqual(JSON.parse(res.body), { id: '42' });
    });

    it('captures multiple params', async () => {
      const raw = await rawRequest(port, 'GET /users/5/posts/99 HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const res = parseResponse(raw);
      assert.deepStrictEqual(JSON.parse(res.body), { userId: '5', postId: '99' });
    });
  });

  describe('POST with body', () => {
    it('receives text body', async () => {
      const body = 'hello world';
      const raw = await rawRequest(port,
        `POST /echo HTTP/1.1\r\nHost: localhost\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`
      );
      const res = parseResponse(raw);
      const json = JSON.parse(res.body);
      assert.equal(json.received, 'hello world');
    });

    it('receives JSON body', async () => {
      const body = '{"name":"test","value":42}';
      const raw = await rawRequest(port,
        `POST /echo HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`
      );
      const res = parseResponse(raw);
      const json = JSON.parse(res.body);
      assert.deepStrictEqual(json.json, { name: 'test', value: 42 });
    });
  });

  describe('Query string', () => {
    it('parses query parameters', async () => {
      const raw = await rawRequest(port, 'GET /query?foo=bar&num=123 HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const res = parseResponse(raw);
      assert.deepStrictEqual(JSON.parse(res.body), { foo: 'bar', num: '123' });
    });
  });

  describe('Error handling', () => {
    it('returns 404 for unknown routes', async () => {
      const raw = await rawRequest(port, 'GET /nonexistent HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const res = parseResponse(raw);
      assert.equal(res.statusCode, 404);
    });

    it('returns 500 for handler errors', async () => {
      const raw = await rawRequest(port, 'GET /error HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const res = parseResponse(raw);
      assert.equal(res.statusCode, 500);
    });

    it('returns custom status codes', async () => {
      const raw = await rawRequest(port, 'GET /status/201 HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const res = parseResponse(raw);
      assert.equal(res.statusCode, 201);
    });
  });

  describe('HTTP features', () => {
    it('includes server header', async () => {
      const raw = await rawRequest(port, 'GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const res = parseResponse(raw);
      assert.ok(res.headers['server']?.includes('HenryHTTP'));
    });

    it('includes date header', async () => {
      const raw = await rawRequest(port, 'GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const res = parseResponse(raw);
      assert.ok(res.headers['date']);
    });

    it('includes content-length', async () => {
      const raw = await rawRequest(port, 'GET /text HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      const res = parseResponse(raw);
      assert.equal(res.headers['content-length'], '19'); // "plain text response"
    });
  });

  describe('Concurrent requests', () => {
    it('handles multiple simultaneous requests', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(rawRequest(port, `GET /users/${i} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`));
      }
      const results = await Promise.all(promises);
      for (let i = 0; i < 10; i++) {
        const res = parseResponse(results[i]);
        assert.equal(res.statusCode, 200);
        assert.deepStrictEqual(JSON.parse(res.body), { id: String(i) });
      }
    });
  });
});

describe('Path compilation', () => {
  it('compiles static paths', async () => {
    const { compilePath } = await import('./server.js');
    const pattern = compilePath('/api/users');
    assert.ok(pattern.test('/api/users'));
    assert.ok(!pattern.test('/api/posts'));
  });

  it('compiles parameterized paths', async () => {
    const { compilePath } = await import('./server.js');
    const pattern = compilePath('/users/:id');
    const match = pattern.exec('/users/42');
    assert.ok(match);
    assert.equal(match[1], '42');
  });

  it('compiles multi-param paths', async () => {
    const { compilePath } = await import('./server.js');
    const pattern = compilePath('/users/:id/posts/:postId');
    const match = pattern.exec('/users/5/posts/99');
    assert.ok(match);
    assert.equal(match[1], '5');
    assert.equal(match[2], '99');
  });

  it('compiles wildcard paths', async () => {
    const { compilePath } = await import('./server.js');
    const pattern = compilePath('/files/*');
    assert.ok(pattern.test('/files/path/to/file.txt'));
  });
});
