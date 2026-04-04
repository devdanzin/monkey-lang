// ===== URL Router =====

export class Router {
  constructor() { this._routes = []; }

  add(method, pattern, handler) {
    const { regex, paramNames } = compile(pattern);
    this._routes.push({ method: method.toUpperCase(), pattern, regex, paramNames, handler });
    return this;
  }

  get(pattern, handler) { return this.add('GET', pattern, handler); }
  post(pattern, handler) { return this.add('POST', pattern, handler); }
  put(pattern, handler) { return this.add('PUT', pattern, handler);  }
  delete(pattern, handler) { return this.add('DELETE', pattern, handler); }

  match(method, path) {
    for (const route of this._routes) {
      if (route.method !== '*' && route.method !== method.toUpperCase()) continue;
      const match = route.regex.exec(path);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
        return { handler: route.handler, params, pattern: route.pattern };
      }
    }
    return null;
  }

  // Resolve: match and call handler
  resolve(method, path) {
    const matched = this.match(method, path);
    if (!matched) return null;
    return matched.handler(matched.params);
  }

  get routes() { return this._routes.map(r => ({ method: r.method, pattern: r.pattern })); }
}

function compile(pattern) {
  const paramNames = [];
  let regexStr = pattern
    .replace(/:([^/]+)/g, (_, name) => { paramNames.push(name); return '([^/]+)'; })
    .replace(/\*/g, '(.*)');
  return { regex: new RegExp(`^${regexStr}$`), paramNames };
}

// ===== Nested Router =====

export class NestedRouter extends Router {
  constructor() { super(); this._children = []; }

  mount(prefix, router) {
    this._children.push({ prefix, router });
    return this;
  }

  match(method, path) {
    // Check own routes first
    const own = super.match(method, path);
    if (own) return own;

    // Check children
    for (const { prefix, router } of this._children) {
      if (path.startsWith(prefix)) {
        const subPath = path.slice(prefix.length) || '/';
        const result = router.match(method, subPath);
        if (result) return result;
      }
    }
    return null;
  }
}
