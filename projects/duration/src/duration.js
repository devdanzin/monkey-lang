// Duration parser — human-readable ↔ milliseconds
const UNITS = { ms: 1, s: 1000, sec: 1000, m: 60000, min: 60000, h: 3600000, hr: 3600000, hour: 3600000, d: 86400000, day: 86400000, w: 604800000, week: 604800000, mo: 2592000000, month: 2592000000, y: 31536000000, year: 31536000000 };
export function parse(str) {
  let ms = 0;
  const re = /(-?\d+\.?\d*)\s*(ms|s|sec|min|m|hr|h|hour|day|d|week|w|month|mo|year|y)/gi;
  let m;
  while ((m = re.exec(str)) !== null) ms += parseFloat(m[1]) * (UNITS[m[2].toLowerCase()] || 0);
  return ms;
}
export function format(ms, { long = false } = {}) {
  const abs = Math.abs(ms);
  if (abs < 1000) return ms + (long ? ' milliseconds' : 'ms');
  if (abs < 60000) return (ms / 1000).toFixed(1) + (long ? ' seconds' : 's');
  if (abs < 3600000) return (ms / 60000).toFixed(1) + (long ? ' minutes' : 'm');
  if (abs < 86400000) return (ms / 3600000).toFixed(1) + (long ? ' hours' : 'h');
  if (abs < 604800000) return (ms / 86400000).toFixed(1) + (long ? ' days' : 'd');
  return (ms / 604800000).toFixed(1) + (long ? ' weeks' : 'w');
}
export function formatVerbose(ms) {
  const parts = [];
  const d = Math.floor(ms / 86400000); ms %= 86400000;
  const h = Math.floor(ms / 3600000); ms %= 3600000;
  const m = Math.floor(ms / 60000); ms %= 60000;
  const s = Math.floor(ms / 1000);
  if (d) parts.push(`${d}d`); if (h) parts.push(`${h}h`); if (m) parts.push(`${m}m`); if (s) parts.push(`${s}s`);
  return parts.join(' ') || '0s';
}
