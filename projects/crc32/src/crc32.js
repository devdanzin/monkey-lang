// CRC32 calculator

const TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let crc = i;
  for (let j = 0; j < 8; j++) crc = crc & 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
  TABLE[i] = crc;
}

export function crc32(input) {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ TABLE[(crc ^ data[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function crc32hex(input) { return crc32(input).toString(16).padStart(8, '0'); }

// Streaming CRC32
export class CRC32Stream {
  constructor() { this._crc = 0xFFFFFFFF; }
  update(input) {
    const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
    for (let i = 0; i < data.length; i++) this._crc = (this._crc >>> 8) ^ TABLE[(this._crc ^ data[i]) & 0xFF];
    return this;
  }
  digest() { return (this._crc ^ 0xFFFFFFFF) >>> 0; }
  hex() { return this.digest().toString(16).padStart(8, '0'); }
  reset() { this._crc = 0xFFFFFFFF; return this; }
}
