// ===== Simple HTTP Framework =====
// Express-like with router, middleware, path params, query parsing

import { createServer } from 'node:http';

// ===== Router =====

export class Router {
  constructor() {
    this.routes = [];
    this.middleware = [];
  }

  use(...args) {
    if (args.length === 1 && typeof args[0] === 'function') {
      this.middleware.push({ path: null, handler: args[0] });
    } else if (args.length === 1 && args[0] instanceof Router) {
      this.middleware.push({ path: null, router: args[0] });
    } else if (args.length === 2 && args[1] instanceof Router) {
      this.middleware.push({ path: args[0], router: args[1] });
    } else if (args.length === 2 && typeof args[1] === 'function') {
      this.middleware.push({ path: args[0], handler: args[1] });
    }
  }

  _addRoute(method, path, handler) {
    const { pattern, paramNames } = compilePath(path);
    this.routes.push({ method, path, pattern, paramNames, handler });
  }

  get(path, handler) { this._addRoute('GET', path, handler); }
  post(path, handler) { this._addRoute('POST', path, handler); }
  put(path, handler) { this._addRoute('PUT', path, handler); }
  delete(path, handler) { this._addRoute('DELETE', path, handler); }
  patch(path, handler) { this._addRoute('PATCH', path, handler); }

  match(method, url) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = route.pattern.exec(url);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}

function compilePath(path) {
  const paramNames = [];
  const pattern = path.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  return { pattern: new RegExp(`^${pattern}$`), paramNames };
}

// ===== Request/Response wrappers =====

export class Request {
  constructor(raw) {
    this.raw = raw;
    this.method = raw.method;
    const urlObj = new URL(raw.url, `http://${raw.headers.host || 'localhost'}`);
    this.path = urlObj.pathname;
    this.query = Object.fromEntries(urlObj.searchParams);
    this.headers = raw.headers;
    this.params = {};
    this.body = null;
  }

  async parseBody() {
    return new Promise((resolve) => {
      let data = '';
      this.raw.on('data', chunk => data += chunk);
      this.raw.on('end', () => {
        this.body = data;
        try { this.body = JSON.parse(data); } catch {}
        resolve(this.body);
      });
    });
  }
}

export class Response {
  constructor(raw) {
    this.raw = raw;
    this.statusCode = 200;
    this._headers = { 'Content-Type': 'application/json' };
    this.sent = false;
  }

  status(code) { this.statusCode = code; return this; }
  header(key, value) { this._headers[key] = value; return this; }

  json(data) {
    this.raw.writeHead(this.statusCode, this._headers);
    this.raw.end(JSON.stringify(data));
    this.sent = true;
  }

  text(data) {
    this._headers['Content-Type'] = 'text/plain';
    this.raw.writeHead(this.statusCode, this._headers);
    this.raw.end(String(data));
    this.sent = true;
  }

  send(data) {
    if (typeof data === 'object') this.json(data);
    else this.text(data);
  }
}

// ===== Application =====

export class App extends Router {
  constructor() {
    super();
  }

  async handleRequest(req, res) {
    // Run middleware
    for (const mw of this.middleware) {
      if (mw.path && !req.path.startsWith(mw.path)) continue;
      
      if (mw.router) {
        // Sub-router
        const prefix = mw.path || '';
        const subPath = req.path.slice(prefix.length) || '/';
        const matched = mw.router.match(req.method, subPath);
        if (matched) {
          req.params = { ...req.params, ...matched.params };
          await matched.handler(req, res);
          if (res.sent) return;
        }
        continue;
      }
      
      let nextCalled = false;
      const next = () => { nextCalled = true; };
      
      await mw.handler(req, res, next);
      if (res.sent) return;
      if (!nextCalled) return;
    }

    // Match route
    const matched = this.match(req.method, req.path);
    if (matched) {
      req.params = matched.params;
      await matched.handler(req, res);
    } else {
      res.status(404).json({ error: 'Not Found' });
    }
  }

  listen(port, callback) {
    const server = createServer(async (rawReq, rawRes) => {
      const req = new Request(rawReq);
      const res = new Response(rawRes);
      try {
        await this.handleRequest(req, res);
      } catch (err) {
        if (!res.sent) res.status(500).json({ error: err.message });
      }
    });
    server.listen(port, callback);
    return server;
  }
}

// ===== Built-in middleware =====

export function jsonParser() {
  return async (req, res, next) => {
    if (req.method !== 'GET' && req.headers['content-type']?.includes('application/json')) {
      await req.parseBody();
    }
    next();
  };
}

export function logger() {
  return (req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  };
}

export function cors(options = {}) {
  const origin = options.origin || '*';
  return (req, res, next) => {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).text('');
      return;
    }
    next();
  };
}
