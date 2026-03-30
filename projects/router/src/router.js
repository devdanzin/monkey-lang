// URL Router — path matching with params, wildcards, middleware, nested routes

export class Router {
  constructor() {
    this.routes = [];
    this.middleware = [];
    this._notFoundHandler = null;
  }

  // Register routes
  get(path, ...handlers) { return this._add('GET', path, handlers); }
  post(path, ...handlers) { return this._add('POST', path, handlers); }
  put(path, ...handlers) { return this._add('PUT', path, handlers); }
  delete(path, ...handlers) { return this._add('DELETE', path, handlers); }
  patch(path, ...handlers) { return this._add('PATCH', path, handlers); }
  all(path, ...handlers) { return this._add('*', path, handlers); }

  // Add middleware
  use(pathOrHandler, handler) {
    if (typeof pathOrHandler === 'function') {
      this.middleware.push({ path: null, handler: pathOrHandler });
    } else if (pathOrHandler instanceof Router) {
      // Mount sub-router
      this._mountRouter('', pathOrHandler);
    } else if (handler instanceof Router) {
      this._mountRouter(pathOrHandler, handler);
    } else {
      this.middleware.push({ path: pathOrHandler, handler });
    }
    return this;
  }

  // Not found handler
  notFound(handler) {
    this._notFoundHandler = handler;
    return this;
  }

  // Match a URL against registered routes
  match(method, url) {
    const [path, queryString] = url.split('?');
    const query = parseQuery(queryString);

    // Find matching route
    for (const route of this.routes) {
      if (route.method !== '*' && route.method !== method) continue;
      const match = matchPath(route.pattern, path);
      if (match) {
        return {
          params: match.params,
          query,
          path,
          handlers: [...this._getMiddleware(path), ...route.handlers],
          route: route.pattern,
        };
      }
    }

    return null;
  }

  // Execute matched route with middleware chain
  async handle(method, url, context = {}) {
    const result = this.match(method, url);

    if (!result) {
      if (this._notFoundHandler) return this._notFoundHandler({ method, url, ...context });
      throw new Error(`No route for ${method} ${url}`);
    }

    const req = { method, url, path: result.path, params: result.params, query: result.query, ...context };
    const res = { body: null, status: 200, headers: {} };

    // Run handler chain
    let idx = 0;
    const next = async () => {
      if (idx < result.handlers.length) {
        const handler = result.handlers[idx++];
        await handler(req, res, next);
      }
    };
    await next();

    return res;
  }

  _add(method, path, handlers) {
    const pattern = compilePath(path);
    this.routes.push({ method, path, pattern, handlers });
    return this;
  }

  _mountRouter(prefix, router) {
    for (const route of router.routes) {
      const newPath = prefix + route.path;
      this.routes.push({ ...route, path: newPath, pattern: compilePath(newPath) });
    }
    for (const mw of router.middleware) {
      this.middleware.push({ ...mw, path: mw.path ? prefix + mw.path : prefix || null });
    }
  }

  _getMiddleware(path) {
    return this.middleware
      .filter(mw => !mw.path || path.startsWith(mw.path))
      .map(mw => mw.handler);
  }
}

// Compile path pattern into regex + param names
function compilePath(path) {
  const params = [];
  const pattern = path
    .replace(/:(\w+)/g, (_, name) => { params.push(name); return '([^/]+)'; })
    .replace(/\*/g, '(.*)');
  return { regex: new RegExp(`^${pattern}$`), params, path };
}

// Match URL against compiled pattern
function matchPath(pattern, url) {
  const match = url.match(pattern.regex);
  if (!match) return null;
  const params = {};
  for (let i = 0; i < pattern.params.length; i++) {
    params[pattern.params[i]] = decodeURIComponent(match[i + 1]);
  }
  return { params };
}

// Parse query string
function parseQuery(qs) {
  if (!qs) return {};
  const result = {};
  for (const pair of qs.split('&')) {
    const [key, value] = pair.split('=');
    result[decodeURIComponent(key)] = decodeURIComponent(value || '');
  }
  return result;
}

export { compilePath, matchPath, parseQuery };
