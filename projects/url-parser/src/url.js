// url.js — URL parser from scratch

const URL_RE = /^(?:([a-zA-Z][a-zA-Z0-9+.-]*):)?(?:\/\/(?:([^@/?#]*)@)?([^:/?#]*)(?::(\d+))?)?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/;

export function parseUrl(url) {
  const m = URL_RE.exec(url);
  if (!m) throw new Error(`Invalid URL: ${url}`);
  
  const [, scheme, auth, host, port, path, query, fragment] = m;
  
  let username = '', password = '';
  if (auth) {
    const [u, p] = auth.split(':');
    username = decodeURIComponent(u || '');
    password = decodeURIComponent(p || '');
  }
  
  return {
    scheme: scheme || '',
    username,
    password,
    host: host || '',
    port: port ? parseInt(port) : null,
    path: path || '/',
    query: query || '',
    fragment: fragment || '',
    get origin() { return `${this.scheme}://${this.host}${this.port ? ':' + this.port : ''}`; },
    get href() { return buildUrl(this); },
    get searchParams() { return parseSearchParams(this.query); },
  };
}

export function buildUrl(parts) {
  let url = '';
  if (parts.scheme) url += `${parts.scheme}://`;
  if (parts.username) {
    url += encodeURIComponent(parts.username);
    if (parts.password) url += `:${encodeURIComponent(parts.password)}`;
    url += '@';
  }
  url += parts.host || '';
  if (parts.port) url += `:${parts.port}`;
  url += parts.path || '/';
  if (parts.query) url += `?${parts.query}`;
  if (parts.fragment) url += `#${parts.fragment}`;
  return url;
}

// ===== SearchParams =====
export function parseSearchParams(query) {
  const params = new Map();
  if (!query) {
    // still return functional object
  } else for (const pair of query.split('&')) {
    const eq = pair.indexOf('=');
    const key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq));
    const value = eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1));
    if (!params.has(key)) params.set(key, []);
    params.get(key).push(value);
  }
  
  return {
    get(key) { return params.get(key)?.[0] ?? null; },
    getAll(key) { return params.get(key) || []; },
    has(key) { return params.has(key); },
    set(key, value) { params.set(key, [value]); },
    append(key, value) { if (!params.has(key)) params.set(key, []); params.get(key).push(value); },
    delete(key) { params.delete(key); },
    keys() { return [...params.keys()]; },
    entries() { return [...params.entries()].flatMap(([k, v]) => v.map(val => [k, val])); },
    toString() {
      return [...params.entries()].flatMap(([k, v]) => v.map(val => `${encodeURIComponent(k)}=${encodeURIComponent(val)}`)).join('&');
    },
  };
}

// ===== Relative URL Resolution =====
export function resolveUrl(base, relative) {
  const b = parseUrl(base);
  
  if (relative.startsWith('//')) {
    return `${b.scheme}:${relative}`;
  }
  if (relative.startsWith('/')) {
    return `${b.scheme}://${b.host}${b.port ? ':' + b.port : ''}${relative}`;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(relative)) {
    return relative; // absolute URL
  }
  
  // Relative path
  const basePath = b.path.slice(0, b.path.lastIndexOf('/') + 1);
  let resolved = basePath + relative;
  
  // Normalize path (remove . and ..)
  resolved = normalizePath(resolved);
  
  return `${b.scheme}://${b.host}${b.port ? ':' + b.port : ''}${resolved}`;
}

export function normalizePath(path) {
  const parts = path.split('/');
  const result = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') { result.pop(); continue; }
    result.push(part);
  }
  return result.join('/') || '/';
}

// ===== Default ports =====
const DEFAULT_PORTS = { http: 80, https: 443, ftp: 21, ssh: 22, ws: 80, wss: 443 };

export function getDefaultPort(scheme) {
  return DEFAULT_PORTS[scheme?.toLowerCase()] ?? null;
}

export function isDefaultPort(scheme, port) {
  return getDefaultPort(scheme) === port;
}
