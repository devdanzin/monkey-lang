// capture.js — Capture group extraction and backreference matching
// Uses NFA simulation with capture tracking (Thompson-style with augmented states)

import { State, Fragment } from './regex.js';

// ===== Enhanced Parser with Group Numbering =====
export function parseWithCaptures(pattern) {
  let pos = 0;
  let groupCount = 0;

  function parseExpr() {
    let node = parseTerm();
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++;
      node = { type: 'alt', left: node, right: parseTerm() };
    }
    return node;
  }

  function parseTerm() {
    const factors = [];
    while (pos < pattern.length && pattern[pos] !== ')' && pattern[pos] !== '|') {
      factors.push(parseFactor());
    }
    if (factors.length === 0) return { type: 'empty' };
    if (factors.length === 1) return factors[0];
    return { type: 'concat', parts: factors };
  }

  function parseFactor() {
    let node = parseAtom();
    if (pos < pattern.length) {
      if (pattern[pos] === '*') { pos++; node = { type: 'star', child: node, greedy: true }; }
      else if (pattern[pos] === '+') { pos++; node = { type: 'plus', child: node, greedy: true }; }
      else if (pattern[pos] === '?') {
        pos++;
        // Check for lazy quantifier
        if (pos < pattern.length && pattern[pos] === '?') {
          pos++;
          node = { type: 'optional', child: node, greedy: false };
        } else {
          node = { type: 'optional', child: node, greedy: true };
        }
      }
    }
    return node;
  }

  function parseAtom() {
    if (pattern[pos] === '(') {
      pos++; // skip (
      // Check for non-capturing group (?:...)
      let capturing = true;
      let groupId = -1;
      if (pos + 1 < pattern.length && pattern[pos] === '?' && pattern[pos + 1] === ':') {
        capturing = false;
        pos += 2;
      }
      if (capturing) {
        groupId = ++groupCount;
      }
      const node = parseExpr();
      if (pos < pattern.length && pattern[pos] === ')') pos++;
      return { type: 'group', child: node, capturing, groupId };
    }
    if (pattern[pos] === '[') return parseCharClass();
    if (pattern[pos] === '^') { pos++; return { type: 'anchor', which: 'start' }; }
    if (pattern[pos] === '$') { pos++; return { type: 'anchor', which: 'end' }; }
    if (pattern[pos] === '.') { pos++; return { type: 'dot' }; }
    if (pattern[pos] === '\\') {
      pos++;
      const ch = pattern[pos++];
      // Backreference: \1, \2, etc.
      if (ch >= '1' && ch <= '9') {
        return { type: 'backref', ref: parseInt(ch) };
      }
      if (ch === 'd') return { type: 'class', chars: '0123456789' };
      if (ch === 'w') return { type: 'class', chars: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_' };
      if (ch === 's') return { type: 'class', chars: ' \t\n\r' };
      if (ch === 'D') return { type: 'class', chars: '0123456789', negate: true };
      if (ch === 'W') return { type: 'class', chars: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_', negate: true };
      if (ch === 'S') return { type: 'class', chars: ' \t\n\r', negate: true };
      return { type: 'char', char: ch };
    }
    const ch = pattern[pos++];
    return { type: 'char', char: ch };
  }

  function parseCharClass() {
    pos++; // skip [
    let negate = false;
    if (pos < pattern.length && pattern[pos] === '^') { negate = true; pos++; }
    let chars = '';
    while (pos < pattern.length && pattern[pos] !== ']') {
      if (pos + 2 < pattern.length && pattern[pos + 1] === '-') {
        const start = pattern[pos].charCodeAt(0);
        const end = pattern[pos + 2].charCodeAt(0);
        for (let c = start; c <= end; c++) chars += String.fromCharCode(c);
        pos += 3;
      } else {
        chars += pattern[pos++];
      }
    }
    if (pos < pattern.length) pos++;
    return { type: 'class', chars, negate };
  }

  const ast = parseExpr();
  return { ast, groupCount };
}

// ===== NFA Simulation with Capture Tracking =====
// Each "thread" in the NFA simulation carries its own capture state

class Thread {
  constructor(state, captures, pos = 0) {
    this.state = state;
    this.captures = captures; // Map<groupId, { start, end }>
    this.pos = pos;
  }

  clone(newState) {
    return new Thread(newState, new Map(this.captures), this.pos);
  }
}

// Recursive backtracking matcher with capture groups
// Returns generator of { pos, captures } for all possible matches
function* matchAST(ast, text, pos, captures, groupCount) {
  switch (ast.type) {
    case 'char': {
      if (pos < text.length && text[pos] === ast.char) {
        yield { pos: pos + 1, captures };
      }
      return;
    }
    case 'dot': {
      if (pos < text.length) {
        yield { pos: pos + 1, captures };
      }
      return;
    }
    case 'class': {
      if (pos < text.length) {
        const inClass = ast.chars.includes(text[pos]);
        if (ast.negate ? !inClass : inClass) {
          yield { pos: pos + 1, captures };
        }
      }
      return;
    }
    case 'concat': {
      function* matchConcat(parts, idx, p, caps) {
        if (idx >= parts.length) {
          yield { pos: p, captures: caps };
          return;
        }
        for (const result of matchAST(parts[idx], text, p, new Map(caps), groupCount)) {
          yield* matchConcat(parts, idx + 1, result.pos, result.captures);
        }
      }
      yield* matchConcat(ast.parts, 0, pos, captures);
      return;
    }
    case 'alt': {
      yield* matchAST(ast.left, text, pos, new Map(captures), groupCount);
      yield* matchAST(ast.right, text, pos, new Map(captures), groupCount);
      return;
    }
    case 'star': {
      if (ast.greedy !== false) {
        // Greedy: try matching one more first, then zero
        for (const childResult of matchAST(ast.child, text, pos, new Map(captures), groupCount)) {
          if (childResult.pos > pos) { // must make progress
            yield* matchAST(ast, text, childResult.pos, childResult.captures, groupCount);
          }
        }
        // Zero matches
        yield { pos, captures };
      } else {
        // Lazy: zero first, then try more
        yield { pos, captures };
        for (const childResult of matchAST(ast.child, text, pos, new Map(captures), groupCount)) {
          if (childResult.pos > pos) {
            yield* matchAST(ast, text, childResult.pos, childResult.captures, groupCount);
          }
        }
      }
      return;
    }
    case 'plus': {
      for (const first of matchAST(ast.child, text, pos, new Map(captures), groupCount)) {
        if (first.pos > pos) {
          const starAST = { type: 'star', child: ast.child, greedy: ast.greedy };
          yield* matchAST(starAST, text, first.pos, first.captures, groupCount);
        }
      }
      return;
    }
    case 'optional': {
      if (ast.greedy !== false) {
        yield* matchAST(ast.child, text, pos, new Map(captures), groupCount);
        yield { pos, captures };
      } else {
        yield { pos, captures };
        yield* matchAST(ast.child, text, pos, new Map(captures), groupCount);
      }
      return;
    }
    case 'group': {
      const startPos = pos;
      for (const result of matchAST(ast.child, text, pos, new Map(captures), groupCount)) {
        const newCaps = new Map(result.captures);
        if (ast.capturing && ast.groupId > 0) {
          newCaps.set(ast.groupId, {
            start: startPos,
            end: result.pos,
            value: text.slice(startPos, result.pos)
          });
        }
        yield { pos: result.pos, captures: newCaps };
      }
      return;
    }
    case 'backref': {
      const cap = captures.get(ast.ref);
      if (!cap) return;
      const refText = cap.value;
      if (text.slice(pos, pos + refText.length) === refText) {
        yield { pos: pos + refText.length, captures };
      }
      return;
    }
    case 'anchor': {
      if (ast.which === 'start' && pos === 0) yield { pos, captures };
      else if (ast.which === 'end' && pos === text.length) yield { pos, captures };
      return;
    }
    case 'empty': {
      yield { pos, captures };
      return;
    }
    default:
      throw new Error(`Unknown AST node: ${ast.type}`);
  }
}

// ===== Public API =====

/**
 * Match entire string against pattern, returning captures
 */
export function matchCaptures(pattern, text) {
  const { ast, groupCount } = parseWithCaptures(pattern);
  for (const result of matchAST(ast, text, 0, new Map(), groupCount)) {
    if (result.pos === text.length) {
      const groups = [text];
      for (let i = 1; i <= groupCount; i++) {
        const cap = result.captures.get(i);
        groups.push(cap ? cap.value : undefined);
      }
      return groups;
    }
  }
  return null;
}

/**
 * Search for first match anywhere in text, returning captures and position
 */
export function searchCaptures(pattern, text) {
  const { ast, groupCount } = parseWithCaptures(pattern);

  for (let start = 0; start <= text.length; start++) {
    for (const result of matchAST(ast, text, start, new Map(), groupCount)) {
      if (result.pos > start) {
        const matchedText = text.slice(start, result.pos);
        const groups = [matchedText];
        for (let i = 1; i <= groupCount; i++) {
          const cap = result.captures.get(i);
          groups.push(cap ? cap.value : undefined);
        }
        return {
          match: matchedText,
          index: start,
          groups,
        };
      }
    }
  }
  return null;
}

/**
 * Find all non-overlapping matches
 */
export function matchAll(pattern, text) {
  const { ast, groupCount } = parseWithCaptures(pattern);
  const matches = [];
  let searchStart = 0;

  while (searchStart <= text.length) {
    let found = false;
    for (let start = searchStart; start <= text.length; start++) {
      let matched = false;
      for (const result of matchAST(ast, text, start, new Map(), groupCount)) {
        if (result.pos > start) {
          const matchedText = text.slice(start, result.pos);
          const groups = [matchedText];
          for (let i = 1; i <= groupCount; i++) {
            const cap = result.captures.get(i);
            groups.push(cap ? cap.value : undefined);
          }
          matches.push({
            match: matchedText,
            index: start,
            groups,
          });
          searchStart = result.pos;
          found = true;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (!found) break;
  }

  return matches;
}

/**
 * Replace first match
 */
export function replace(pattern, text, replacement) {
  const result = searchCaptures(pattern, text);
  if (!result) return text;

  // Handle backreferences in replacement: $1, $2, etc.
  let rep = replacement;
  for (let i = 0; i < result.groups.length; i++) {
    rep = rep.replace(new RegExp('\\$' + i, 'g'), result.groups[i] || '');
  }

  return text.slice(0, result.index) + rep + text.slice(result.index + result.match.length);
}

/**
 * Replace all matches
 */
export function replaceAll(pattern, text, replacement) {
  const allMatches = matchAll(pattern, text);
  if (allMatches.length === 0) return text;

  let result = '';
  let lastEnd = 0;
  for (const m of allMatches) {
    result += text.slice(lastEnd, m.index);
    let rep = replacement;
    for (let i = 0; i < m.groups.length; i++) {
      rep = rep.replace(new RegExp('\\$' + i, 'g'), m.groups[i] || '');
    }
    result += rep;
    lastEnd = m.index + m.match.length;
  }
  result += text.slice(lastEnd);
  return result;
}

/**
 * Split text by pattern
 */
export function split(pattern, text) {
  const allMatches = matchAll(pattern, text);
  if (allMatches.length === 0) return [text];

  const parts = [];
  let lastEnd = 0;
  for (const m of allMatches) {
    parts.push(text.slice(lastEnd, m.index));
    lastEnd = m.index + m.match.length;
  }
  parts.push(text.slice(lastEnd));
  return parts;
}
