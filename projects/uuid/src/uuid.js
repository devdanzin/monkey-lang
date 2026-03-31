// UUID Generator — v4 (random) and v7 (timestamp-ordered)

const HEX = '0123456789abcdef';

function randomBytes(n) {
  const bytes = new Uint8Array(n);
  for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

function bytesToHex(bytes) {
  let hex = '';
  for (const b of bytes) hex += HEX[b >> 4] + HEX[b & 0xf];
  return hex;
}

function formatUUID(hex) {
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

// UUID v4 — random
export function v4() {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
  return formatUUID(bytesToHex(bytes));
}

// UUID v7 — timestamp-ordered (draft RFC 9562)
export function v7() {
  const now = Date.now();
  const bytes = randomBytes(16);

  // Timestamp (48 bits, ms since epoch) in bytes 0-5
  bytes[0] = (now / 2**40) & 0xff;
  bytes[1] = (now / 2**32) & 0xff;
  bytes[2] = (now / 2**24) & 0xff;
  bytes[3] = (now / 2**16) & 0xff;
  bytes[4] = (now / 2**8) & 0xff;
  bytes[5] = now & 0xff;

  bytes[6] = (bytes[6] & 0x0f) | 0x70; // Version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

  return formatUUID(bytesToHex(bytes));
}

// UUID nil
export const NIL = '00000000-0000-0000-0000-000000000000';

// Parse UUID string to bytes
export function parse(uuid) {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) throw new Error('Invalid UUID');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i*2, i*2+2), 16);
  return bytes;
}

// Validate UUID format
export function validate(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

// Get version from UUID
export function version(uuid) {
  return parseInt(uuid[14], 16);
}

// Compare UUIDs (for sorting v7)
export function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
