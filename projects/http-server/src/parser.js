// parser.js — HTTP/1.1 request parser
// Parses raw bytes from TCP socket into structured Request objects

const CRLF = '\r\n';
const DOUBLE_CRLF = '\r\n\r\n';

const STATUS_TEXTS = {
  200: 'OK', 201: 'Created', 204: 'No Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 405: 'Method Not Allowed', 408: 'Request Timeout',
  411: 'Length Required', 413: 'Payload Too Large', 414: 'URI Too Long',
  415: 'Unsupported Media Type',
  500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway',
  503: 'Service Unavailable',
};

// ===== Request Parser =====
export class HttpParser {
  constructor(options = {}) {
    this.maxHeaderSize = options.maxHeaderSize || 8192;  // 8KB
    this.maxBodySize = options.maxBodySize || 1048576;   // 1MB
  }

  // Parse a complete HTTP request from a buffer
  parse(buffer) {
    const text = typeof buffer === 'string' ? buffer : buffer.toString('utf8');

    // Split headers and body
    const headerEnd = text.indexOf(DOUBLE_CRLF);
    if (headerEnd === -1) throw new HttpError(400, 'Incomplete headers');

    const headerSection = text.slice(0, headerEnd);
    const bodyStart = headerEnd + 4;

    // Parse request line
    const lines = headerSection.split(CRLF);
    const requestLine = lines[0];
    const parts = requestLine.split(' ');
    if (parts.length < 3) throw new HttpError(400, 'Invalid request line');

    const method = parts[0].toUpperCase();
    const rawUrl = parts[1];
    const httpVersion = parts[2];

    if (!httpVersion.startsWith('HTTP/')) {
      throw new HttpError(400, 'Invalid HTTP version');
    }

    // Parse URL and query string
    const [path, queryString] = rawUrl.split('?');
    const query = parseQueryString(queryString || '');

    // Parse headers
    const headers = new Headers();
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const name = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();
      headers.set(name, value);
    }

    // Parse body
    let body = null;
    const contentLength = parseInt(headers.get('content-length') || '0');
    const transferEncoding = headers.get('transfer-encoding');

    if (transferEncoding === 'chunked') {
      body = parseChunkedBody(text.slice(bodyStart));
    } else if (contentLength > 0) {
      if (contentLength > this.maxBodySize) {
        throw new HttpError(413, 'Payload too large');
      }
      body = text.slice(bodyStart, bodyStart + contentLength);
    }

    // Parse JSON body if content-type is application/json
    let json = undefined;
    if (body && headers.get('content-type')?.includes('application/json')) {
      try {
        json = JSON.parse(body);
      } catch (e) {
        throw new HttpError(400, 'Invalid JSON body');
      }
    }

    return {
      method,
      path: decodeURIComponent(path),
      url: rawUrl,
      httpVersion,
      headers,
      query,
      body,
      json,
      keepAlive: shouldKeepAlive(httpVersion, headers),
    };
  }
}

// ===== Chunked Transfer Decoding =====
function parseChunkedBody(text) {
  const parts = [];
  let pos = 0;

  while (pos < text.length) {
    const lineEnd = text.indexOf(CRLF, pos);
    if (lineEnd === -1) break;

    const sizeStr = text.slice(pos, lineEnd).trim();
    const chunkSize = parseInt(sizeStr, 16);
    if (isNaN(chunkSize)) break;
    if (chunkSize === 0) break; // final chunk

    pos = lineEnd + 2;
    parts.push(text.slice(pos, pos + chunkSize));
    pos += chunkSize + 2; // skip chunk data + CRLF
  }

  return parts.join('');
}

// ===== Query String Parser =====
function parseQueryString(qs) {
  const params = {};
  if (!qs) return params;
  for (const pair of qs.split('&')) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  }
  return params;
}

// ===== Keep-Alive =====
function shouldKeepAlive(version, headers) {
  const connection = headers.get('connection')?.toLowerCase();
  if (connection === 'close') return false;
  if (connection === 'keep-alive') return true;
  // HTTP/1.1 defaults to keep-alive
  return version === 'HTTP/1.1';
}

// ===== Response Builder =====
export class HttpResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = new Map();
    this._body = null;
    this._sent = false;
    this.headers.set('server', 'HenryHTTP/1.0');
    this.headers.set('date', new Date().toUTCString());
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  header(name, value) {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }

  json(data) {
    this._body = JSON.stringify(data);
    this.headers.set('content-type', 'application/json; charset=utf-8');
    this.headers.set('content-length', Buffer.byteLength(this._body).toString());
    return this;
  }

  text(data) {
    this._body = data;
    this.headers.set('content-type', 'text/plain; charset=utf-8');
    this.headers.set('content-length', Buffer.byteLength(this._body).toString());
    return this;
  }

  html(data) {
    this._body = data;
    this.headers.set('content-type', 'text/html; charset=utf-8');
    this.headers.set('content-length', Buffer.byteLength(this._body).toString());
    return this;
  }

  send(data) {
    if (typeof data === 'object' && data !== null && !(data instanceof Buffer)) {
      return this.json(data);
    }
    this._body = typeof data === 'string' ? data : (data?.toString() || '');
    if (!this.headers.has('content-type')) {
      this.headers.set('content-type', 'text/plain; charset=utf-8');
    }
    this.headers.set('content-length', Buffer.byteLength(this._body).toString());
    return this;
  }

  // Build raw HTTP response bytes
  serialize(keepAlive = true) {
    const statusText = STATUS_TEXTS[this.statusCode] || 'Unknown';
    let response = `HTTP/1.1 ${this.statusCode} ${statusText}${CRLF}`;

    if (!keepAlive) {
      this.headers.set('connection', 'close');
    } else {
      this.headers.set('connection', 'keep-alive');
    }

    for (const [name, value] of this.headers) {
      response += `${name}: ${value}${CRLF}`;
    }
    response += CRLF;

    if (this._body) {
      response += this._body;
    }

    return response;
  }
}

// ===== Headers wrapper =====
class Headers {
  constructor() {
    this._map = new Map();
  }

  set(name, value) {
    this._map.set(name.toLowerCase(), value);
  }

  get(name) {
    return this._map.get(name.toLowerCase()) || null;
  }

  has(name) {
    return this._map.has(name.toLowerCase());
  }

  delete(name) {
    this._map.delete(name.toLowerCase());
  }

  entries() {
    return this._map.entries();
  }

  [Symbol.iterator]() {
    return this._map[Symbol.iterator]();
  }
}

// ===== HTTP Error =====
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export { STATUS_TEXTS, parseQueryString, parseChunkedBody, shouldKeepAlive, Headers };
