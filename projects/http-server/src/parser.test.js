// parser.test.js — Tests for HTTP request parser and response builder

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HttpParser, HttpResponse, HttpError, parseQueryString, parseChunkedBody } from './parser.js';

describe('HTTP Parser', () => {
  const parser = new HttpParser();

  describe('Request line', () => {
    it('parses GET request', () => {
      const req = parser.parse('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert.equal(req.method, 'GET');
      assert.equal(req.path, '/');
      assert.equal(req.httpVersion, 'HTTP/1.1');
    });

    it('parses POST request', () => {
      const req = parser.parse('POST /api/data HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert.equal(req.method, 'POST');
      assert.equal(req.path, '/api/data');
    });

    it('parses request with query string', () => {
      const req = parser.parse('GET /search?q=hello&page=1 HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert.equal(req.path, '/search');
      assert.equal(req.query.q, 'hello');
      assert.equal(req.query.page, '1');
    });

    it('parses encoded URL', () => {
      const req = parser.parse('GET /path%20with%20spaces HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert.equal(req.path, '/path with spaces');
    });

    it('rejects invalid request line', () => {
      assert.throws(() => parser.parse('INVALID\r\n\r\n'), /Invalid request line/);
    });

    it('rejects incomplete headers', () => {
      assert.throws(() => parser.parse('GET / HTTP/1.1\r\n'), /Incomplete headers/);
    });
  });

  describe('Headers', () => {
    it('parses headers case-insensitively', () => {
      const req = parser.parse('GET / HTTP/1.1\r\nHost: example.com\r\nContent-Type: text/html\r\n\r\n');
      assert.equal(req.headers.get('host'), 'example.com');
      assert.equal(req.headers.get('content-type'), 'text/html');
    });

    it('handles multiple headers', () => {
      const req = parser.parse('GET / HTTP/1.1\r\nHost: localhost\r\nAccept: */*\r\nUser-Agent: test\r\n\r\n');
      assert.equal(req.headers.get('accept'), '*/*');
      assert.equal(req.headers.get('user-agent'), 'test');
    });
  });

  describe('Body', () => {
    it('parses body with content-length', () => {
      const req = parser.parse(
        'POST /data HTTP/1.1\r\nHost: localhost\r\nContent-Length: 13\r\n\r\nHello, World!'
      );
      assert.equal(req.body, 'Hello, World!');
    });

    it('parses JSON body', () => {
      const body = '{"name":"test"}';
      const req = parser.parse(
        `POST /api HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body}`
      );
      assert.deepStrictEqual(req.json, { name: 'test' });
    });

    it('rejects invalid JSON body', () => {
      assert.throws(() => parser.parse(
        'POST /api HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 3\r\n\r\n{{{' 
      ), /Invalid JSON/);
    });

    it('parses chunked body', () => {
      const req = parser.parse(
        'POST /data HTTP/1.1\r\nHost: localhost\r\nTransfer-Encoding: chunked\r\n\r\n' +
        '5\r\nHello\r\n6\r\n World\r\n0\r\n\r\n'
      );
      assert.equal(req.body, 'Hello World');
    });

    it('rejects oversized body', () => {
      const small = new HttpParser({ maxBodySize: 10 });
      assert.throws(() => small.parse(
        'POST /data HTTP/1.1\r\nHost: localhost\r\nContent-Length: 100\r\n\r\n' + 'x'.repeat(100)
      ), /Payload too large/);
    });
  });

  describe('Keep-Alive', () => {
    it('HTTP/1.1 defaults to keep-alive', () => {
      const req = parser.parse('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
      assert.equal(req.keepAlive, true);
    });

    it('respects Connection: close', () => {
      const req = parser.parse('GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      assert.equal(req.keepAlive, false);
    });

    it('HTTP/1.0 defaults to close', () => {
      const req = parser.parse('GET / HTTP/1.0\r\nHost: localhost\r\n\r\n');
      assert.equal(req.keepAlive, false);
    });

    it('HTTP/1.0 with keep-alive header', () => {
      const req = parser.parse('GET / HTTP/1.0\r\nHost: localhost\r\nConnection: keep-alive\r\n\r\n');
      assert.equal(req.keepAlive, true);
    });
  });
});

describe('Query String Parser', () => {
  it('parses empty string', () => {
    assert.deepStrictEqual(parseQueryString(''), {});
  });

  it('parses key=value pairs', () => {
    assert.deepStrictEqual(parseQueryString('a=1&b=2'), { a: '1', b: '2' });
  });

  it('handles encoded values', () => {
    assert.deepStrictEqual(parseQueryString('name=hello%20world'), { name: 'hello world' });
  });

  it('handles empty values', () => {
    assert.deepStrictEqual(parseQueryString('flag='), { flag: '' });
  });
});

describe('Chunked Body Parser', () => {
  it('parses single chunk', () => {
    assert.equal(parseChunkedBody('5\r\nHello\r\n0\r\n\r\n'), 'Hello');
  });

  it('parses multiple chunks', () => {
    assert.equal(parseChunkedBody('3\r\nabc\r\n4\r\ndefg\r\n0\r\n\r\n'), 'abcdefg');
  });

  it('handles hex chunk sizes', () => {
    assert.equal(parseChunkedBody('a\r\n0123456789\r\n0\r\n\r\n'), '0123456789');
  });
});

describe('HTTP Response', () => {
  it('builds 200 OK response', () => {
    const res = new HttpResponse();
    res.text('Hello');
    const raw = res.serialize();
    assert.ok(raw.startsWith('HTTP/1.1 200 OK\r\n'));
    assert.ok(raw.includes('content-type: text/plain'));
    assert.ok(raw.includes('content-length: 5'));
    assert.ok(raw.endsWith('\r\n\r\nHello'));
  });

  it('builds JSON response', () => {
    const res = new HttpResponse();
    res.json({ message: 'ok' });
    const raw = res.serialize();
    assert.ok(raw.includes('application/json'));
    assert.ok(raw.includes('{"message":"ok"}'));
  });

  it('builds HTML response', () => {
    const res = new HttpResponse();
    res.html('<h1>Hi</h1>');
    const raw = res.serialize();
    assert.ok(raw.includes('text/html'));
    assert.ok(raw.includes('<h1>Hi</h1>'));
  });

  it('sets custom status code', () => {
    const res = new HttpResponse();
    res.status(404).text('Not Found');
    const raw = res.serialize();
    assert.ok(raw.startsWith('HTTP/1.1 404 Not Found\r\n'));
  });

  it('sets custom headers', () => {
    const res = new HttpResponse();
    res.header('X-Custom', 'value').text('ok');
    const raw = res.serialize();
    assert.ok(raw.includes('x-custom: value'));
  });

  it('sends object as JSON', () => {
    const res = new HttpResponse();
    res.send({ data: 42 });
    const raw = res.serialize();
    assert.ok(raw.includes('application/json'));
    assert.ok(raw.includes('"data":42'));
  });

  it('sends string as text', () => {
    const res = new HttpResponse();
    res.send('plain text');
    const raw = res.serialize();
    assert.ok(raw.includes('text/plain'));
    assert.ok(raw.includes('plain text'));
  });

  it('includes connection header', () => {
    const res = new HttpResponse();
    res.text('ok');
    const keepAliveRes = res.serialize(true);
    assert.ok(keepAliveRes.includes('connection: keep-alive'));
    const closeRes = res.serialize(false);
    assert.ok(closeRes.includes('connection: close'));
  });
});

describe('HttpError', () => {
  it('has status and message', () => {
    const err = new HttpError(404, 'Not Found');
    assert.equal(err.status, 404);
    assert.equal(err.message, 'Not Found');
    assert.equal(err.name, 'HttpError');
  });
});
