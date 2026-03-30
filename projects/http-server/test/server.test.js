import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { HTTPServer, parseRequest } from '../src/index.js';
import { connect } from 'net';

// Helper: send raw HTTP request and get response
function rawRequest(port, request) {
  return new Promise((resolve, reject) => {
    const socket = connect(port, 'localhost', () => {
      socket.write(request);
    });
    let data = '';
    socket.on('data', chunk => data += chunk.toString());
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
}

function parseResponse(raw) {
  const [headerSection, ...bodyParts] = raw.split('\r\n\r\n');
  const lines = headerSection.split('\r\n');
  const [, statusCode, ...statusMsg] = lines[0].split(' ');
  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const [key, ...val] = lines[i].split(':');
    headers[key.trim().toLowerCase()] = val.join(':').trim();
  }
  return { statusCode: parseInt(statusCode), headers, body: bodyParts.join('\r\n\r\n') };
}

describe('parseRequest', () => {
  it('parses GET request', () => {
    const req = parseRequest('GET /api/users HTTP/1.1\r\nHost: localhost', '');
    assert.equal(req.method, 'GET');
    assert.equal(req.path, '/api/users');
    assert.equal(req.headers.host, 'localhost');
  });

  it('parses query string', () => {
    const req = parseRequest('GET /search?q=hello&page=2 HTTP/1.1', '');
    assert.equal(req.query.q, 'hello');
    assert.equal(req.query.page, '2');
  });

  it('parses JSON body', () => {
    const req = parseRequest('POST /api HTTP/1.1\r\nContent-Type: application/json', '{"name":"test"}');
    assert.deepEqual(req.body, { name: 'test' });
  });
});

describe('HTTPServer', () => {
  let server;
  const PORT = 19876;

  afterEach((_, done) => {
    if (server) server.close(done);
    else done();
  });

  it('responds to GET', async () => {
    server = new HTTPServer();
    server.get('/hello', (req, res) => res.send('world'));
    await new Promise(r => server.listen(PORT, r));

    const raw = await rawRequest(PORT, 'GET /hello HTTP/1.1\r\nHost: localhost\r\n\r\n');
    const resp = parseResponse(raw);
    assert.equal(resp.statusCode, 200);
    assert.equal(resp.body, 'world');
  });

  it('returns 404 for unknown routes', async () => {
    server = new HTTPServer();
    await new Promise(r => server.listen(PORT, r));

    const raw = await rawRequest(PORT, 'GET /nope HTTP/1.1\r\nHost: localhost\r\n\r\n');
    const resp = parseResponse(raw);
    assert.equal(resp.statusCode, 404);
  });

  it('handles path params', async () => {
    server = new HTTPServer();
    server.get('/users/:id', (req, res) => res.json({ id: req.params.id }));
    await new Promise(r => server.listen(PORT, r));

    const raw = await rawRequest(PORT, 'GET /users/42 HTTP/1.1\r\nHost: localhost\r\n\r\n');
    const resp = parseResponse(raw);
    assert.equal(resp.statusCode, 200);
    const body = JSON.parse(resp.body);
    assert.equal(body.id, '42');
  });

  it('JSON response', async () => {
    server = new HTTPServer();
    server.get('/api', (req, res) => res.json({ ok: true }));
    await new Promise(r => server.listen(PORT, r));

    const raw = await rawRequest(PORT, 'GET /api HTTP/1.1\r\nHost: localhost\r\n\r\n');
    const resp = parseResponse(raw);
    assert.equal(resp.headers['content-type'], 'application/json');
    assert.deepEqual(JSON.parse(resp.body), { ok: true });
  });

  it('middleware runs before routes', async () => {
    server = new HTTPServer();
    server.use((req, res, next) => {
      req.custom = 'middleware-value';
      next();
    });
    server.get('/test', (req, res) => res.send(req.custom));
    await new Promise(r => server.listen(PORT, r));

    const raw = await rawRequest(PORT, 'GET /test HTTP/1.1\r\nHost: localhost\r\n\r\n');
    const resp = parseResponse(raw);
    assert.equal(resp.body, 'middleware-value');
  });

  it('custom status codes', async () => {
    server = new HTTPServer();
    server.get('/created', (req, res) => res.status(201).json({ created: true }));
    await new Promise(r => server.listen(PORT, r));

    const raw = await rawRequest(PORT, 'GET /created HTTP/1.1\r\nHost: localhost\r\n\r\n');
    const resp = parseResponse(raw);
    assert.equal(resp.statusCode, 201);
  });
});
