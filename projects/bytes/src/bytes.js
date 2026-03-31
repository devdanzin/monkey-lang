// Byte formatter — humanize file sizes
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
const UNITS_IEC = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'];

export function format(bytes, { iec = false, decimals = 2 } = {}) {
  if (bytes === 0) return '0 B';
  const base = iec ? 1024 : 1000;
  const units = iec ? UNITS_IEC : UNITS;
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(base));
  const idx = Math.min(i, units.length - 1);
  return (bytes / Math.pow(base, idx)).toFixed(decimals) + ' ' + units[idx];
}

export function parse(str) {
  const m = str.match(/^(-?\d+\.?\d*)\s*(B|KB|KiB|MB|MiB|GB|GiB|TB|TiB|PB|PiB|EB|EiB)$/i);
  if (!m) throw new Error(`Invalid byte string: ${str}`);
  const val = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  const multipliers = { B: 1, KB: 1e3, KIB: 1024, MB: 1e6, MIB: 1048576, GB: 1e9, GIB: 1073741824, TB: 1e12, TIB: 1099511627776, PB: 1e15, PIB: 1125899906842624, EB: 1e18, EIB: 1152921504606846976 };
  return Math.round(val * (multipliers[unit] || 1));
}
