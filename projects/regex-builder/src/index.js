// ===== Regex Builder DSL =====

export class RegexBuilder {
  constructor() { this._parts = []; this._flags = ''; }

  // Literal string (escaped)
  literal(str) { this._parts.push(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); return this; }

  // Character classes
  digit() { this._parts.push('\\d'); return this; }
  digits() { this._parts.push('\\d+'); return this; }
  word() { this._parts.push('\\w'); return this; }
  words() { this._parts.push('\\w+'); return this; }
  whitespace() { this._parts.push('\\s'); return this; }
  any() { this._parts.push('.'); return this; }
  anyOf(chars) { this._parts.push(`[${chars.replace(/[\]\\]/g, '\\$&')}]`); return this; }
  noneOf(chars) { this._parts.push(`[^${chars.replace(/[\]\\]/g, '\\$&')}]`); return this; }

  // Quantifiers
  optional() { this._modifyLast('?'); return this; }
  zeroOrMore() { this._modifyLast('*'); return this; }
  oneOrMore() { this._modifyLast('+'); return this; }
  repeat(n) { this._modifyLast(`{${n}}`); return this; }
  repeatRange(min, max) { this._modifyLast(`{${min},${max ?? ''}}`); return this; }
  lazy() { this._modifyLast('?'); return this; }

  // Groups
  group(fn) {
    const sub = new RegexBuilder();
    fn(sub);
    this._parts.push(`(${sub._parts.join('')})`);
    return this;
  }
  namedGroup(name, fn) {
    const sub = new RegexBuilder();
    fn(sub);
    this._parts.push(`(?<${name}>${sub._parts.join('')})`);
    return this;
  }
  nonCapturing(fn) {
    const sub = new RegexBuilder();
    fn(sub);
    this._parts.push(`(?:${sub._parts.join('')})`);
    return this;
  }

  // Alternation
  or(...alternatives) {
    const alts = alternatives.map(fn => {
      const sub = new RegexBuilder();
      fn(sub);
      return sub._parts.join('');
    });
    this._parts.push(`(?:${alts.join('|')})`);
    return this;
  }

  // Anchors
  startOfLine() { this._parts.push('^'); return this; }
  endOfLine() { this._parts.push('$'); return this; }
  wordBoundary() { this._parts.push('\\b'); return this; }

  // Lookahead
  lookahead(fn) {
    const sub = new RegexBuilder();
    fn(sub);
    this._parts.push(`(?=${sub._parts.join('')})`);
    return this;
  }

  // Flags
  global() { this._flags += 'g'; return this; }
  caseInsensitive() { this._flags += 'i'; return this; }
  multiline() { this._flags += 'm'; return this; }

  // Build
  build() { return new RegExp(this._parts.join(''), this._flags); }
  toString() { return this._parts.join(''); }

  _modifyLast(suffix) {
    if (this._parts.length > 0) {
      this._parts[this._parts.length - 1] += suffix;
    }
  }
}

export function regex() { return new RegexBuilder(); }
