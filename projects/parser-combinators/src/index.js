// ===== Parser Combinator Library =====
//
// A parser is a function: (input, pos) → { value, pos } | null
// Combinators compose parsers into larger parsers

// ===== Core Types =====

export class ParseResult {
  constructor(value, pos) { this.value = value; this.pos = pos; }
}

// ===== Basic Parsers =====

// Match a single character satisfying a predicate
export function satisfy(pred) {
  return (input, pos) => {
    if (pos < input.length && pred(input[pos])) {
      return new ParseResult(input[pos], pos + 1);
    }
    return null;
  };
}

// Match a specific character
export function char(c) {
  return satisfy(ch => ch === c);
}

// Match a specific string
export function string(str) {
  return (input, pos) => {
    if (input.startsWith(str, pos)) {
      return new ParseResult(str, pos + str.length);
    }
    return null;
  };
}

// Match a regex at current position
export function regex(re) {
  const anchored = new RegExp(`^(?:${re.source})`, re.flags);
  return (input, pos) => {
    const m = anchored.exec(input.slice(pos));
    if (m) return new ParseResult(m[0], pos + m[0].length);
    return null;
  };
}

// Always succeed with a value
export function succeed(value) {
  return (input, pos) => new ParseResult(value, pos);
}

// Always fail
export function fail() {
  return () => null;
}

// ===== Combinators =====

// Try parsers in order, return first success
export function alt(...parsers) {
  return (input, pos) => {
    for (const p of parsers) {
      const r = p(input, pos);
      if (r) return r;
    }
    return null;
  };
}

// Sequence: run parsers in order, return array of results
export function seq(...parsers) {
  return (input, pos) => {
    const results = [];
    let currentPos = pos;
    for (const p of parsers) {
      const r = p(input, currentPos);
      if (!r) return null;
      results.push(r.value);
      currentPos = r.pos;
    }
    return new ParseResult(results, currentPos);
  };
}

// Map: transform the result of a parser
export function map(parser, fn) {
  return (input, pos) => {
    const r = parser(input, pos);
    if (!r) return null;
    return new ParseResult(fn(r.value), r.pos);
  };
}

// Zero or more repetitions
export function many(parser) {
  return (input, pos) => {
    const results = [];
    let currentPos = pos;
    while (true) {
      const r = parser(input, currentPos);
      if (!r) break;
      results.push(r.value);
      currentPos = r.pos;
      if (currentPos === pos && results.length > 100) break; // infinite loop guard
    }
    return new ParseResult(results, currentPos);
  };
}

// One or more repetitions
export function many1(parser) {
  return (input, pos) => {
    const r = many(parser)(input, pos);
    if (!r || r.value.length === 0) return null;
    return r;
  };
}

// Optional: try parser, return default if fails
export function optional(parser, defaultValue = null) {
  return alt(parser, succeed(defaultValue));
}

// Lazy: for recursive parsers
export function lazy(fn) {
  return (input, pos) => fn()(input, pos);
}

// Between: match content between left and right delimiters
export function between(left, content, right) {
  return map(seq(left, content, right), ([, value]) => value);
}

// Separated by: content separated by delimiter
export function sepBy(content, separator) {
  return (input, pos) => {
    const first = content(input, pos);
    if (!first) return new ParseResult([], pos);
    
    const rest = many(map(seq(separator, content), ([, v]) => v))(input, first.pos);
    return new ParseResult([first.value, ...rest.value], rest.pos);
  };
}

export function sepBy1(content, separator) {
  return (input, pos) => {
    const r = sepBy(content, separator)(input, pos);
    if (!r || r.value.length === 0) return null;
    return r;
  };
}

// Skip whitespace
export const ws = map(many(satisfy(c => ' \t\n\r'.includes(c))), () => null);

// Lexeme: parse content then skip trailing whitespace
export function lexeme(parser) {
  return map(seq(parser, ws), ([value]) => value);
}

// ===== JSON Parser (Example) =====

const jNull = map(string('null'), () => null);
const jTrue = map(string('true'), () => true);
const jFalse = map(string('false'), () => false);

const jNumber = map(
  regex(/[-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/),
  Number,
);

const jStringContent = (input, pos) => {
  if (input[pos] !== '"') return null;
  let i = pos + 1;
  let str = '';
  while (i < input.length && input[i] !== '"') {
    if (input[i] === '\\') {
      i++;
      switch (input[i]) {
        case '"': str += '"'; break;
        case '\\': str += '\\'; break;
        case '/': str += '/'; break;
        case 'n': str += '\n'; break;
        case 't': str += '\t'; break;
        case 'r': str += '\r'; break;
        case 'b': str += '\b'; break;
        case 'f': str += '\f'; break;
        case 'u': {
          const hex = input.slice(i + 1, i + 5);
          str += String.fromCharCode(parseInt(hex, 16));
          i += 4;
          break;
        }
        default: str += input[i];
      }
    } else {
      str += input[i];
    }
    i++;
  }
  if (i >= input.length) return null;
  return new ParseResult(str, i + 1); // skip closing "
};

const jString = jStringContent;

const jValue = lazy(() => lexeme(alt(jNull, jTrue, jFalse, jNumber, jString, jArray, jObject)));

const jArray = between(
  lexeme(char('[')),
  sepBy(jValue, lexeme(char(','))),
  lexeme(char(']')),
);

const jKeyValue = map(
  seq(lexeme(jString), lexeme(char(':')), jValue),
  ([key, , value]) => [key, value],
);

const jObject = map(
  between(
    lexeme(char('{')),
    sepBy(jKeyValue, lexeme(char(','))),
    lexeme(char('}')),
  ),
  (entries) => Object.fromEntries(entries),
);

export function parseJSON(input) {
  const r = seq(ws, jValue)(input, 0);
  if (!r) throw new Error('Invalid JSON');
  return r.value[1];
}
