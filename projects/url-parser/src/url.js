// URL parser — parse, format, resolve, query strings

export function parse(url) {
  const m = url.match(/^(?:([a-zA-Z][a-zA-Z0-9+.-]*):)?(?:\/\/(?:([^@/?#]*)@)?([^:/?#]*)(?::(\d+))?)?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/);
  if (!m) throw new Error(`Invalid URL: ${url}`);
  const [, protocol, auth, hostname, port, pathname, search, hash] = m;
  const [username, password] = auth ? auth.split(':') : [undefined, undefined];
  return {
    protocol: protocol || '',
    username: username ? decodeURIComponent(username) : '',
    password: password ? decodeURIComponent(password) : '',
    hostname: hostname || '',
    port: port ? parseInt(port) : null,
    pathname: pathname || '/',
    search: search || '',
    hash: hash || '',
    get host() { return this.port ? `${this.hostname}:${this.port}` : this.hostname; },
    get origin() { return this.protocol ? `${this.protocol}://${this.host}` : ''; },
    get query() { return parseQuery(this.search); },
  };
}

export function format(parts) {
  let url = '';
  if (parts.protocol) url += parts.protocol + '://';
  if (parts.username) {
    url += encodeURIComponent(parts.username);
    if (parts.password) url += ':' + encodeURIComponent(parts.password);
    url += '@';
  }
  url += parts.hostname || '';
  if (parts.port) url += ':' + parts.port;
  url += parts.pathname || '/';
  if (parts.search) url += '?' + parts.search;
  if (parts.hash) url += '#' + parts.hash;
  return url;
}

export function parseQuery(qs) {
  const params = {};
  if (!qs) return params;
  for (const pair of qs.split('&')) {
    const [key, ...rest] = pair.split('=');
    const value = rest.join('=');
    const k = decodeURIComponent(key);
    const v = decodeURIComponent(value);
    if (params[k] !== undefined) {
      if (!Array.isArray(params[k])) params[k] = [params[k]];
      params[k].push(v);
    } else params[k] = v;
  }
  return params;
}

export function formatQuery(params) {
  const parts = [];
  for (const [key, val] of Object.entries(params)) {
    const vals = Array.isArray(val) ? val : [val];
    for (const v of vals) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return parts.join('&');
}

export function resolve(base, relative) {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(relative)) return relative; // absolute
  const b = parse(base);
  if (relative.startsWith('//')) return b.protocol + ':' + relative;
  if (relative.startsWith('/')) return format({ ...b, pathname: relative, search: '', hash: '' });
  // Relative path
  const basePath = b.pathname.replace(/\/[^/]*$/, '/');
  const newPath = normalizePath(basePath + relative);
  return format({ ...b, pathname: newPath, search: '', hash: '' });
}

function normalizePath(path) {
  const parts = path.split('/');
  const result = [];
  for (const p of parts) {
    if (p === '..') result.pop();
    else if (p !== '.') result.push(p);
  }
  return result.join('/') || '/';
}
