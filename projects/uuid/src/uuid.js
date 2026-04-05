// uuid.js — UUID generator

import { randomBytes, createHash } from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const NIL = '00000000-0000-0000-0000-000000000000';

// Format bytes as UUID string
function format(bytes) {
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// ===== v4 (random) =====
export function v4() {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0F) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3F) | 0x80; // variant 10xx
  return format(bytes);
}

// ===== v1 (time-based) =====
let clockSeq = null;
let lastTime = 0;

export function v1() {
  // Gregorian epoch offset: Oct 15, 1582 to Jan 1, 1970 in 100ns intervals
  const GREGORIAN_OFFSET = 122192928000000000n;
  const now = BigInt(Date.now()) * 10000n + GREGORIAN_OFFSET;
  
  if (clockSeq === null) clockSeq = (randomBytes(2).readUInt16BE(0)) & 0x3FFF;
  
  const timeLow = Number(now & 0xFFFFFFFFn);
  const timeMid = Number((now >> 32n) & 0xFFFFn);
  const timeHigh = Number((now >> 48n) & 0x0FFFn) | 0x1000; // version 1
  
  const bytes = new Uint8Array(16);
  bytes[0] = (timeLow >> 24) & 0xFF;
  bytes[1] = (timeLow >> 16) & 0xFF;
  bytes[2] = (timeLow >> 8) & 0xFF;
  bytes[3] = timeLow & 0xFF;
  bytes[4] = (timeMid >> 8) & 0xFF;
  bytes[5] = timeMid & 0xFF;
  bytes[6] = (timeHigh >> 8) & 0xFF;
  bytes[7] = timeHigh & 0xFF;
  bytes[8] = ((clockSeq >> 8) & 0x3F) | 0x80; // variant
  bytes[9] = clockSeq & 0xFF;
  // Node (random)
  const node = randomBytes(6);
  for (let i = 0; i < 6; i++) bytes[10 + i] = node[i];
  
  return format(bytes);
}

// ===== v5 (name-based, SHA-1) =====
export const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
export const URL_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

export function v5(name, namespace = DNS_NAMESPACE) {
  const nsBytes = parse(namespace);
  const hash = createHash('sha1').update(Buffer.from(nsBytes)).update(name).digest();
  const bytes = new Uint8Array(hash.slice(0, 16));
  bytes[6] = (bytes[6] & 0x0F) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3F) | 0x80; // variant
  return format(bytes);
}

// ===== Parse =====
export function parse(uuid) {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) throw new Error('Invalid UUID');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

// ===== Validate =====
export function validate(uuid) { return UUID_RE.test(uuid); }

// ===== Version =====
export function version(uuid) {
  if (!validate(uuid)) return -1;
  return parseInt(uuid[14], 16);
}

// ===== Compare =====
export function compare(a, b) {
  const ba = parse(a), bb = parse(b);
  for (let i = 0; i < 16; i++) {
    if (ba[i] < bb[i]) return -1;
    if (ba[i] > bb[i]) return 1;
  }
  return 0;
}

export function isNil(uuid) { return uuid === NIL; }
