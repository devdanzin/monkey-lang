// server.js — HTTP/1.1 server built on raw TCP sockets

import { createServer } from 'node:net';
import { HttpParser, HttpResponse, HttpError, STATUS_TEXTS } from './parser.js';

export class HttpServer {
  constructor(options = {}) {
    this.parser = new HttpParser(options);
    this.routes = [];
    this.middleware = [];
    this.errorHandler = defaultErrorHandler;
    this._server = null;
    this.keepAliveTimeout = options.keepAliveTimeout || 5000;
  }

  // ===== Routing =====
  use(fn) {
    this.middleware.push(fn);
    return this;
  }

  route(method, path, ...handlers) {
    const pattern = compilePath(path);
    this.routes.push({ method: method.toUpperCase(), pattern, path, handlers });
    return this;
  }

  get(path, ...handlers) { return this.route('GET', path, ...handlers); }
  post(path, ...handlers) { return this.route('POST', path, ...handlers); }
  put(path, ...handlers) { return this.route('PUT', path, ...handlers); }
  delete(path, ...handlers) { return this.route('DELETE', path, ...handlers); }
  patch(path, ...handlers) { return this.route('PATCH', path, ...handlers); }

  onError(fn) {
    this.errorHandler = fn;
    return this;
  }

  // ===== Server Lifecycle =====
  listen(port, host = '127.0.0.1') {
    return new Promise((resolve) => {
      this._server = createServer((socket) => this._handleConnection(socket));
      this._server.listen(port, host, () => {
        const addr = this._server.address();
        resolve(addr);
      });
    });
  }

  close() {
    return new Promise((resolve) => {
      if (this._server) {
        this._server.close(resolve);
      } else {
        resolve();
      }
    });
  }

  get address() {
    return this._server?.address();
  }

  // ===== Connection Handling =====
  _handleConnection(socket) {
    let buffer = '';
    let timeout = null;

    const resetTimeout = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => socket.destroy(), this.keepAliveTimeout);
    };

    resetTimeout();

    socket.on('data', async (chunk) => {
      buffer += chunk.toString('utf8');
      resetTimeout();

      // Try to parse a complete request
      while (buffer.includes('\r\n\r\n')) {
        try {
          const request = this.parser.parse(buffer);

          // Calculate how much of the buffer we consumed
          const headerEnd = buffer.indexOf('\r\n\r\n') + 4;
          const contentLength = parseInt(request.headers.get('content-length') || '0');
          const consumed = headerEnd + contentLength;
          buffer = buffer.slice(consumed);

          // Handle the request
          const response = new HttpResponse();
          await this._handleRequest(request, response);

          // Send response
          const keepAlive = request.keepAlive;
          socket.write(response.serialize(keepAlive));

          if (!keepAlive) {
            socket.end();
            if (timeout) clearTimeout(timeout);
            return;
          }
        } catch (e) {
          const response = new HttpResponse();
          if (e instanceof HttpError) {
            response.status(e.status).json({ error: e.message });
          } else {
            response.status(500).json({ error: 'Internal Server Error' });
          }
          socket.write(response.serialize(false));
          socket.end();
          if (timeout) clearTimeout(timeout);
          return;
        }
      }
    });

    socket.on('error', () => {
      if (timeout) clearTimeout(timeout);
    });

    socket.on('close', () => {
      if (timeout) clearTimeout(timeout);
    });
  }

  async _handleRequest(request, response) {
    // Run middleware
    for (const mw of this.middleware) {
      let nextCalled = false;
      await mw(request, response, () => { nextCalled = true; });
      if (!nextCalled) return; // middleware didn't call next — response already sent
    }

    // Find matching route
    const match = this._matchRoute(request.method, request.path);
    if (!match) {
      response.status(404).json({ error: 'Not Found' });
      return;
    }

    request.params = match.params;

    // Run route handlers
    try {
      for (const handler of match.route.handlers) {
        await handler(request, response);
      }
    } catch (e) {
      await this.errorHandler(e, request, response);
    }
  }

  _matchRoute(method, path) {
    for (const route of this.routes) {
      if (route.method !== method && route.method !== '*') continue;
      const match = route.pattern.exec(path);
      if (match) {
        const params = {};
        const names = route.pattern._paramNames || [];
        for (let i = 0; i < names.length; i++) {
          params[names[i]] = match[i + 1];
        }
        return { route, params };
      }
    }
    return null;
  }
}

// ===== Path Compiler =====
function compilePath(path) {
  if (path instanceof RegExp) return path;

  const paramNames = [];
  const pattern = path
    .replace(/:([a-zA-Z_]\w*)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    })
    .replace(/\*/g, '(.*)');

  const regex = new RegExp(`^${pattern}$`);
  regex._paramNames = paramNames;
  return regex;
}

// ===== Default Error Handler =====
function defaultErrorHandler(error, request, response) {
  const status = error.status || 500;
  response.status(status).json({
    error: error.message || 'Internal Server Error',
  });
}

export { compilePath };
