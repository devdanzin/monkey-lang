// Parser Combinator Library

export function result(val) { return (input) => ({ success: true, value: val, rest: input }); }
export function fail(msg) { return (input) => ({ success: false, error: msg, rest: input }); }

export function char(c) {
  return (input) => input[0] === c ? { success: true, value: c, rest: input.slice(1) } : { success: false, error: `Expected '${c}'`, rest: input };
}

export function string(s) {
  return (input) => input.startsWith(s) ? { success: true, value: s, rest: input.slice(s.length) } : { success: false, error: `Expected "${s}"`, rest: input };
}

export function regex(re) {
  const anchored = new RegExp('^' + re.source, re.flags);
  return (input) => { const m = input.match(anchored); return m ? { success: true, value: m[0], rest: input.slice(m[0].length) } : { success: false, error: `Expected /${re.source}/`, rest: input }; };
}

export function seq(...parsers) {
  return (input) => {
    const values = [];
    let rest = input;
    for (const p of parsers) {
      const r = p(rest);
      if (!r.success) return r;
      values.push(r.value);
      rest = r.rest;
    }
    return { success: true, value: values, rest };
  };
}

export function alt(...parsers) {
  return (input) => {
    for (const p of parsers) {
      const r = p(input);
      if (r.success) return r;
    }
    return { success: false, error: 'No alternative matched', rest: input };
  };
}

export function many(parser) {
  return (input) => {
    const values = [];
    let rest = input;
    while (true) {
      const r = parser(rest);
      if (!r.success) break;
      values.push(r.value);
      rest = r.rest;
    }
    return { success: true, value: values, rest };
  };
}

export function many1(parser) {
  return (input) => {
    const r = many(parser)(input);
    if (r.value.length === 0) return { success: false, error: 'Expected at least one', rest: input };
    return r;
  };
}

export function optional(parser) {
  return (input) => { const r = parser(input); return r.success ? r : { success: true, value: null, rest: input }; };
}

export function map(parser, fn) {
  return (input) => { const r = parser(input); return r.success ? { ...r, value: fn(r.value) } : r; };
}

export function sepBy(parser, sep) {
  return (input) => {
    const first = parser(input);
    if (!first.success) return { success: true, value: [], rest: input };
    const values = [first.value];
    let rest = first.rest;
    while (true) {
      const s = sep(rest);
      if (!s.success) break;
      const next = parser(s.rest);
      if (!next.success) break;
      values.push(next.value);
      rest = next.rest;
    }
    return { success: true, value: values, rest };
  };
}

export function between(open, parser, close) {
  return map(seq(open, parser, close), ([, val]) => val);
}

export function lazy(fn) {
  return (input) => fn()(input);
}

export const digit = regex(/\d/);
export const digits = map(many1(digit), vs => vs.join(''));
export const letter = regex(/[a-zA-Z]/);
export const letters = map(many1(letter), vs => vs.join(''));
export const whitespace = regex(/\s+/);
export const ws = optional(whitespace);
export const integer = map(digits, Number);
