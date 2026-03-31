// Glob pattern matcher

export function match(pattern, str, { caseSensitive = true, dot = false } = {}) {
  const p = caseSensitive ? pattern : pattern.toLowerCase();
  const s = caseSensitive ? str : str.toLowerCase();

  // Dotfile protection: * and ? don't match leading dot unless dot=true
  if (!dot && s.startsWith('.') && p[0] !== '.') return false;

  return _match(p, 0, s, 0);
}

function _match(p, pi, s, si) {
  while (pi < p.length) {
    const pc = p[pi];

    if (pc === '*') {
      // ** = match path separators too (globstar)
      if (pi + 1 < p.length && p[pi + 1] === '*') {
        pi += 2;
        if (pi < p.length && p[pi] === '/') pi++; // skip trailing /
        for (let i = si; i <= s.length; i++) {
          if (_match(p, pi, s, i)) return true;
        }
        return false;
      }
      // * = match any chars except /
      pi++;
      for (let i = si; i <= s.length; i++) {
        if (i > si && s[i - 1] === '/') break; // Don't cross /
        if (_match(p, pi, s, i)) return true;
      }
      return false;
    }

    if (si >= s.length) return false;

    if (pc === '?') {
      if (s[si] === '/') return false;
      pi++; si++; continue;
    }

    if (pc === '[') {
      const { negate, chars, end } = parseCharClass(p, pi);
      const matched = chars.includes(s[si]);
      if (negate ? matched : !matched) return false;
      pi = end; si++; continue;
    }

    if (pc === '\\' && pi + 1 < p.length) {
      pi++;
      if (p[pi] !== s[si]) return false;
      pi++; si++; continue;
    }

    if (pc !== s[si]) return false;
    pi++; si++;
  }
  return si >= s.length;
}

function parseCharClass(p, pi) {
  pi++; // skip [
  let negate = false;
  if (p[pi] === '!' || p[pi] === '^') { negate = true; pi++; }
  const chars = [];
  while (pi < p.length && p[pi] !== ']') {
    if (pi + 2 < p.length && p[pi + 1] === '-') {
      const lo = p[pi].charCodeAt(0), hi = p[pi + 2].charCodeAt(0);
      for (let c = lo; c <= hi; c++) chars.push(String.fromCharCode(c));
      pi += 3;
    } else {
      chars.push(p[pi++]);
    }
  }
  return { negate, chars, end: pi + 1 };
}

export function globToRegex(pattern) {
  let regex = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') { regex += '.*'; i++; if (pattern[i + 1] === '/') i++; }
      else regex += '[^/]*';
    } else if (c === '?') regex += '[^/]';
    else if (c === '[') { regex += '['; i++; while (i < pattern.length && pattern[i] !== ']') regex += pattern[i++]; regex += ']'; }
    else if ('.+^${}()|\\'.includes(c)) regex += '\\' + c;
    else regex += c;
  }
  return new RegExp(regex + '$');
}

export function filter(pattern, strings, opts) {
  return strings.filter(s => match(pattern, s, opts));
}
