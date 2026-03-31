// Base64 encoder/decoder from scratch

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const DECODE_MAP = new Map();
for (let i = 0; i < 64; i++) DECODE_MAP.set(CHARS[i], i);
const URL_DECODE_MAP = new Map();
for (let i = 0; i < 64; i++) URL_DECODE_MAP.set(URL_CHARS[i], i);

// Encode string to base64
export function encode(input, { urlSafe = false, padding = true } = {}) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const chars = urlSafe ? URL_CHARS : CHARS;
  let result = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];

    if (i + 1 < bytes.length) {
      result += chars[((b1 & 0xf) << 2) | (b2 >> 6)];
    } else if (padding) {
      result += '=';
    }

    if (i + 2 < bytes.length) {
      result += chars[b2 & 0x3f];
    } else if (padding) {
      result += '=';
    }
  }

  return result;
}

// Decode base64 to string
export function decode(input, { urlSafe = false } = {}) {
  const bytes = decodeToBytes(input, { urlSafe });
  return new TextDecoder().decode(bytes);
}

// Decode base64 to Uint8Array
export function decodeToBytes(input, { urlSafe = false } = {}) {
  const map = urlSafe ? URL_DECODE_MAP : DECODE_MAP;
  // Remove padding
  const str = input.replace(/=+$/, '');
  const bytes = [];

  for (let i = 0; i < str.length; i += 4) {
    const c0 = map.get(str[i]) || 0;
    const c1 = map.get(str[i + 1]) || 0;
    const c2 = i + 2 < str.length ? map.get(str[i + 2]) || 0 : 0;
    const c3 = i + 3 < str.length ? map.get(str[i + 3]) || 0 : 0;

    bytes.push((c0 << 2) | (c1 >> 4));
    if (i + 2 < str.length) bytes.push(((c1 & 0xf) << 4) | (c2 >> 2));
    if (i + 3 < str.length) bytes.push(((c2 & 3) << 6) | c3);
  }

  return new Uint8Array(bytes);
}

// Check if string is valid base64
export function isValid(input) {
  return /^[A-Za-z0-9+/]*={0,2}$/.test(input) && input.length % 4 === 0;
}

export function isValidUrlSafe(input) {
  return /^[A-Za-z0-9_-]*={0,2}$/.test(input.replace(/=+$/, ''));
}
