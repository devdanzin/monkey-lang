// Semver parser and comparator
export function parse(version) {
  const m = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.]+))?(?:\+([a-zA-Z0-9.]+))?$/);
  if (!m) throw new Error(`Invalid semver: ${version}`);
  return { major: +m[1], minor: +m[2], patch: +m[3], prerelease: m[4] || '', build: m[5] || '' };
}

export function format(v) { let s = `${v.major}.${v.minor}.${v.patch}`; if (v.prerelease) s += '-' + v.prerelease; if (v.build) s += '+' + v.build; return s; }

export function compare(a, b) {
  const va = typeof a === 'string' ? parse(a) : a;
  const vb = typeof b === 'string' ? parse(b) : b;
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  if (va.patch !== vb.patch) return va.patch - vb.patch;
  if (va.prerelease && !vb.prerelease) return -1;
  if (!va.prerelease && vb.prerelease) return 1;
  return va.prerelease < vb.prerelease ? -1 : va.prerelease > vb.prerelease ? 1 : 0;
}

export function gt(a, b) { return compare(a, b) > 0; }
export function lt(a, b) { return compare(a, b) < 0; }
export function eq(a, b) { return compare(a, b) === 0; }
export function gte(a, b) { return compare(a, b) >= 0; }
export function lte(a, b) { return compare(a, b) <= 0; }
export function sort(versions) { return [...versions].sort(compare); }

export function inc(version, type) {
  const v = typeof version === 'string' ? parse(version) : { ...version };
  v.prerelease = ''; v.build = '';
  if (type === 'major') { v.major++; v.minor = 0; v.patch = 0; }
  else if (type === 'minor') { v.minor++; v.patch = 0; }
  else if (type === 'patch') { v.patch++; }
  return format(v);
}

export function satisfies(version, range) {
  if (range === '*') return true;
  if (range.startsWith('^')) { const min = parse(range.slice(1)); const v = parse(version); return v.major === min.major && gte(v, min); }
  if (range.startsWith('~')) { const min = parse(range.slice(1)); const v = parse(version); return v.major === min.major && v.minor === min.minor && gte(v, min); }
  return eq(version, range);
}

export function valid(s) { try { parse(s); return true; } catch { return false; } }
