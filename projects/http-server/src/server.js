// HTTP Server from scratch — built on Node.js net module
// Parses raw HTTP/1.1, routing, middleware, JSON/text responses

import { createServer } from 'net';

export class HTTPServer {
  constructor() {
    this.routes = [];
    this.middleware = [];
    this.server = null;
  }

  // Add middleware
  use(fn) {
    this.middleware.push(fn);
    return this;
  }

  // Route registration
  get(path, handler) { return this._route('GET', path, handler); }
  post(path, handler) { return this._route('POST', path, handler); }
  put(path, handler) { return this._route('PUT', path, handler);  }
  delete(path, handler) { return this._route('DELETE', path, handler); }

  _route(method, path, handler) {
    // Convert path params to regex: /users/:id → /users/([^/]+)
    const paramNames = [];
    const pattern = path.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    this.routes.push({ method, pattern: new RegExp(`^${pattern}$`), handler, paramNames });
    return this;
  }

  // Start listening
  listen(port, callback) {
    this.server = createServer((socket) => {
      let data = '';

      socket.on('data', (chunk) => {
        data += chunk.toString();

        // Check if we have the full headers (double CRLF)
        const headerEnd = data.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;

        const headerSection = data.slice(0, headerEnd);
        const bodyRaw = data.slice(headerEnd + 4);

        // Parse request
        const req = parseRequest(headerSection, bodyRaw);
        const res = new Response(socket);

        // Run middleware + routing
        this._handle(req, res);
      });

      socket.on('error', () => {}); // Ignore connection errors
    });

    this.server.listen(port, callback);
    return this;
  }

  close(callback) {
    if (this.server) this.server.close(callback);
  }

  async _handle(req, res) {
    try {
      // Run middleware
      for (const mw of this.middleware) {
        let nextCalled = false;
        await mw(req, res, () => { nextCalled = true; });
        if (!nextCalled || res.finished) return;
      }

      // Find matching route
      for (const route of this.routes) {
        if (route.method !== req.method) continue;
        const match = req.path.match(route.pattern);
        if (match) {
          // Extract params
          req.params = {};
          for (let i = 0; i < route.paramNames.length; i++) {
            req.params[route.paramNames[i]] = decodeURIComponent(match[i + 1]);
          }
          await route.handler(req, res);
          return;
        }
      }

      // 404
      res.status(404).json({ error: 'Not Found' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

// Parse raw HTTP request
export function parseRequest(headerSection, body) {
  const lines = headerSection.split('\r\n');
  const [method, fullPath, version] = lines[0].split(' ');

  // Parse path and query string
  const [path, queryString] = fullPath.split('?');
  const query = {};
  if (queryString) {
    for (const pair of queryString.split('&')) {
      const [key, value] = pair.split('=');
      query[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  }

  // Parse headers
  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const colonIdx = lines[i].indexOf(':');
    if (colonIdx > 0) {
      const key = lines[i].slice(0, colonIdx).trim().toLowerCase();
      const value = lines[i].slice(colonIdx + 1).trim();
      headers[key] = value;
    }
  }

  // Parse body
  let parsedBody = body;
  if (headers['content-type']?.includes('application/json') && body) {
    try { parsedBody = JSON.parse(body); } catch {}
  }

  return { method, path, query, headers, body: parsedBody, version, params: {} };
}

// Response helper
class Response {
  constructor(socket) {
    this.socket = socket;
    this.statusCode = 200;
    this.statusMessage = 'OK';
    this.headers = { 'Content-Type': 'text/plain' };
    this.finished = false;
  }

  status(code) {
    this.statusCode = code;
    const messages = { 200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 500: 'Internal Server Error' };
    this.statusMessage = messages[code] || 'Unknown';
    return this;
  }

  header(key, value) {
    this.headers[key] = value;
    return this;
  }

  json(data) {
    this.headers['Content-Type'] = 'application/json';
    return this.send(JSON.stringify(data));
  }

  html(content) {
    this.headers['Content-Type'] = 'text/html';
    return this.send(content);
  }

  send(body = '') {
    if (this.finished) return;
    this.finished = true;

    const bodyBuf = Buffer.from(body);
    this.headers['Content-Length'] = bodyBuf.length;
    this.headers['Connection'] = 'close';

    let response = `HTTP/1.1 ${this.statusCode} ${this.statusMessage}\r\n`;
    for (const [key, value] of Object.entries(this.headers)) {
      response += `${key}: ${value}\r\n`;
    }
    response += '\r\n';

    this.socket.write(response);
    this.socket.write(bodyBuf);
    this.socket.end();
    return this;
  }
}

// Built-in middleware
export function cors() {
  return (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(204).send(); return; }
    next();
  };
}

export function logger() {
  return (req, res, next) => {
    const start = Date.now();
    const origSend = res.send.bind(res);
    res.send = (body) => {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
      return origSend(body);
    };
    next();
  };
}
