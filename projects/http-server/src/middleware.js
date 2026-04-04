// middleware.js — Built-in middleware for HenryHTTP

import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.xml': 'application/xml',
  '.wasm': 'application/wasm',
};

// ===== Static File Serving =====
export function staticFiles(root, options = {}) {
  const absRoot = resolve(root);
  const prefix = options.prefix || '';
  const index = options.index || 'index.html';
  const maxAge = options.maxAge || 3600;

  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    let filePath = req.path;
    if (prefix && filePath.startsWith(prefix)) {
      filePath = filePath.slice(prefix.length);
    }

    // Prevent directory traversal
    const normalized = resolve(absRoot, '.' + filePath);
    if (!normalized.startsWith(absRoot)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    try {
      let stats = await stat(normalized);
      let target = normalized;

      // Serve index file for directories
      if (stats.isDirectory()) {
        target = join(normalized, index);
        stats = await stat(target);
      }

      if (!stats.isFile()) {
        return next();
      }

      const ext = extname(target);
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      const content = await readFile(target);

      res.status(200);
      res.header('content-type', mime);
      res.header('content-length', content.length.toString());
      res.header('cache-control', `public, max-age=${maxAge}`);
      res._body = content.toString();

    } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'ENOTDIR') {
        return next();
      }
      throw e;
    }
  };
}

// ===== CORS Middleware =====
export function cors(options = {}) {
  const origin = options.origin || '*';
  const methods = options.methods || 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
  const headers = options.headers || 'Content-Type, Authorization';
  const maxAge = options.maxAge || 86400;

  return (req, res, next) => {
    res.header('access-control-allow-origin', origin);
    res.header('access-control-allow-methods', methods);
    res.header('access-control-allow-headers', headers);
    res.header('access-control-max-age', String(maxAge));

    if (req.method === 'OPTIONS') {
      res.status(204);
      res._body = '';
      return;
    }

    next();
  };
}

// ===== Body Parser Middleware =====
export function bodyParser() {
  return (req, res, next) => {
    // Body is already parsed by HttpParser, this is a no-op middleware
    // but included for Express-like API compatibility
    next();
  };
}

// ===== Logger Middleware =====
export function logger(options = {}) {
  const format = options.format || 'short';

  return (req, res, next) => {
    const start = Date.now();
    req._logStart = start;
    next();
  };
}
