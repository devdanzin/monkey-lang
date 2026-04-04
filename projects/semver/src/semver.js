// semver.js — Semantic Versioning

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.]+))?(?:\+([a-zA-Z0-9.]+))?$/;

export function parse(version) {
  const m = SEMVER_RE.exec(version?.trim?.());
  if (!m) return null;
  return {
    major: parseInt(m[1]),
    minor: parseInt(m[2]),
    patch: parseInt(m[3]),
    prerelease: m[4] ? m[4].split('.') : [],
    build: m[5] ? m[5].split('.') : [],
  };
}

export function valid(version) { return parse(version) !== null; }

export function format(parsed) {
  let s = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  if (parsed.prerelease?.length) s += `-${parsed.prerelease.join('.')}`;
  if (parsed.build?.length) s += `+${parsed.build.join('.')}`;
  return s;
}

export function compare(a, b) {
  const pa = typeof a === 'string' ? parse(a) : a;
  const pb = typeof b === 'string' ? parse(b) : b;
  if (!pa || !pb) throw new Error('Invalid version');

  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;

  // Prerelease has lower precedence than release
  if (pa.prerelease.length === 0 && pb.prerelease.length > 0) return 1;
  if (pa.prerelease.length > 0 && pb.prerelease.length === 0) return -1;

  // Compare prerelease identifiers
  const len = Math.max(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < len; i++) {
    if (i >= pa.prerelease.length) return -1;
    if (i >= pb.prerelease.length) return 1;
    const ai = pa.prerelease[i], bi = pb.prerelease[i];
    const an = parseInt(ai), bn = parseInt(bi);
    const aIsNum = !isNaN(an), bIsNum = !isNaN(bn);
    if (aIsNum && bIsNum) { if (an !== bn) return an - bn; }
    else if (aIsNum) return -1;
    else if (bIsNum) return 1;
    else { if (ai < bi) return -1; if (ai > bi) return 1; }
  }
  return 0;
}

export function gt(a, b) { return compare(a, b) > 0; }
export function lt(a, b) { return compare(a, b) < 0; }
export function eq(a, b) { return compare(a, b) === 0; }
export function gte(a, b) { return compare(a, b) >= 0; }
export function lte(a, b) { return compare(a, b) <= 0; }

export function sort(versions) {
  return [...versions].sort((a, b) => compare(a, b));
}

export function increment(version, type) {
  const p = typeof version === 'string' ? parse(version) : { ...version };
  if (!p) throw new Error('Invalid version');
  p.prerelease = [];
  p.build = [];
  switch (type) {
    case 'major': p.major++; p.minor = 0; p.patch = 0; break;
    case 'minor': p.minor++; p.patch = 0; break;
    case 'patch': p.patch++; break;
    case 'prerelease':
      if (typeof version === 'string') {
        const orig = parse(version);
        if (orig.prerelease.length) {
          p.prerelease = [...orig.prerelease];
          const last = p.prerelease.length - 1;
          const n = parseInt(p.prerelease[last]);
          p.prerelease[last] = isNaN(n) ? p.prerelease[last] : String(n + 1);
          p.major = orig.major; p.minor = orig.minor; p.patch = orig.patch;
        } else {
          p.patch++;
          p.prerelease = ['0'];
        }
      }
      break;
    default: throw new Error(`Unknown type: ${type}`);
  }
  return format(p);
}

export function diff(a, b) {
  const pa = parse(a), pb = parse(b);
  if (!pa || !pb) return null;
  if (pa.major !== pb.major) return 'major';
  if (pa.minor !== pb.minor) return 'minor';
  if (pa.patch !== pb.patch) return 'patch';
  if (JSON.stringify(pa.prerelease) !== JSON.stringify(pb.prerelease)) return 'prerelease';
  return null;
}

export function coerce(input) {
  const m = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(input);
  if (!m) return null;
  return `${m[1]}.${m[2] || '0'}.${m[3] || '0'}`;
}

// ===== Range matching =====
export function satisfies(version, range) {
  const v = parse(version);
  if (!v) return false;
  
  // OR ranges
  for (const orPart of range.split('||').map(s => s.trim())) {
    if (matchesRange(v, orPart)) return true;
  }
  return false;
}

function matchesRange(v, range) {
  // AND conditions (space separated)
  for (const part of range.split(/\s+/)) {
    if (!matchesSingle(v, part)) return false;
  }
  return true;
}

function matchesSingle(v, cond) {
  cond = cond.trim();
  if (!cond) return true;

  // Caret range ^1.2.3
  if (cond.startsWith('^')) {
    const target = parse(cond.slice(1));
    if (!target) return false;
    if (v.major !== target.major) return false;
    if (target.major === 0) {
      if (target.minor === 0) return v.minor === 0 && v.patch >= target.patch;
      return v.minor === target.minor && v.patch >= target.patch;
    }
    return compare(v, target) >= 0;
  }

  // Tilde range ~1.2.3
  if (cond.startsWith('~')) {
    const target = parse(cond.slice(1));
    if (!target) return false;
    return v.major === target.major && v.minor === target.minor && v.patch >= target.patch;
  }

  // Comparison operators
  const opMatch = /^(>=|<=|>|<|=)(.+)$/.exec(cond);
  if (opMatch) {
    const [, op, ver] = opMatch;
    const cmp = compare(v, ver);
    switch (op) {
      case '>=': return cmp >= 0;
      case '<=': return cmp <= 0;
      case '>': return cmp > 0;
      case '<': return cmp < 0;
      case '=': return cmp === 0;
    }
  }

  // Exact match
  return compare(v, cond) === 0;
}
