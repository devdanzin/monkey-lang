// glob.js — Glob pattern matching

export function match(pattern, str, options = {}) {
  const negate = pattern.startsWith('!');
  if (negate) pattern = pattern.slice(1);
  
  // Expand braces
  const patterns = expandBraces(pattern);
  const result = patterns.some(p => matchSingle(p, str, options));
  return negate ? !result : result;
}

function expandBraces(pattern) {
  const braceStart = pattern.indexOf('{');
  if (braceStart === -1) return [pattern];
  
  let depth = 0, braceEnd = -1;
  for (let i = braceStart; i < pattern.length; i++) {
    if (pattern[i] === '{') depth++;
    if (pattern[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
  }
  if (braceEnd === -1) return [pattern];
  
  const prefix = pattern.slice(0, braceStart);
  const suffix = pattern.slice(braceEnd + 1);
  const options = pattern.slice(braceStart + 1, braceEnd).split(',');
  
  return options.flatMap(opt => expandBraces(prefix + opt + suffix));
}

function matchSingle(pattern, str, options) {
  if (pattern.includes('/') || str.includes('/')) return matchPath(pattern, str, options);
  return matchSegment(pattern, str, options);
}

function matchPath(pattern, str, options) {
  const pParts = pattern.split('/');
  const sParts = str.split('/');
  
  return matchParts(pParts, 0, sParts, 0, options);
}

function matchParts(pParts, pi, sParts, si, options) {
  while (pi < pParts.length && si < sParts.length) {
    if (pParts[pi] === '**') {
      // ** matches zero or more path segments
      if (pi === pParts.length - 1) return true;
      for (let i = si; i <= sParts.length; i++) {
        if (matchParts(pParts, pi + 1, sParts, i, options)) return true;
      }
      return false;
    }
    if (!matchSegment(pParts[pi], sParts[si], options)) return false;
    pi++; si++;
  }
  
  // Handle trailing **
  while (pi < pParts.length && pParts[pi] === '**') pi++;
  
  return pi === pParts.length && si === sParts.length;
}

function matchSegment(pattern, str, options = {}) {
  const dot = options.dot || false;
  
  // Don't match dot files unless pattern starts with . or dot option
  if (!dot && str.startsWith('.') && !pattern.startsWith('.')) return false;
  
  return matchChars(pattern, 0, str, 0);
}

function matchChars(pattern, pi, str, si) {
  while (pi < pattern.length) {
    const pc = pattern[pi];
    
    if (pc === '*') {
      // * matches any sequence except /
      if (pi + 1 === pattern.length) return true; // trailing *
      for (let i = si; i <= str.length; i++) {
        if (matchChars(pattern, pi + 1, str, i)) return true;
      }
      return false;
    }
    
    if (pc === '?') {
      if (si >= str.length) return false;
      pi++; si++;
      continue;
    }
    
    if (pc === '[') {
      if (si >= str.length) return false;
      const [match, endIdx] = matchCharClass(pattern, pi, str[si]);
      if (!match) return false;
      pi = endIdx; si++;
      continue;
    }
    
    if (si >= str.length || pc !== str[si]) return false;
    pi++; si++;
  }
  
  return si === str.length;
}

function matchCharClass(pattern, start, ch) {
  let i = start + 1;
  let negate = false;
  if (pattern[i] === '!' || pattern[i] === '^') { negate = true; i++; }
  
  let matched = false;
  while (i < pattern.length && pattern[i] !== ']') {
    if (i + 2 < pattern.length && pattern[i + 1] === '-') {
      // Range
      if (ch >= pattern[i] && ch <= pattern[i + 2]) matched = true;
      i += 3;
    } else {
      if (ch === pattern[i]) matched = true;
      i++;
    }
  }
  
  if (negate) matched = !matched;
  return [matched, i + 1]; // skip ]
}

// ===== Filter =====
export function filter(pattern, list, options = {}) {
  return list.filter(item => match(pattern, item, options));
}

// ===== isGlob =====
export function isGlob(str) {
  return /[*?[\]{}!]/.test(str);
}
