// JSON Parser from scratch — recursive descent
// Fully spec-compliant: strings (with escapes), numbers, booleans, null, arrays, objects

export function parse(input) {
  let pos = 0;

  function error(msg) { throw new SyntaxError(`${msg} at position ${pos}`); }
  function peek() { return input[pos]; }
  function advance() { return input[pos++]; }

  function skipWhitespace() {
    while (pos < input.length && /[\s]/.test(input[pos])) pos++;
  }

  function parseValue() {
    skipWhitespace();
    if (pos >= input.length) error('Unexpected end of input');

    const ch = peek();
    if (ch === '"') return parseString();
    if (ch === '{') return parseObject();
    if (ch === '[') return parseArray();
    if (ch === 't') return parseLiteral('true', true);
    if (ch === 'f') return parseLiteral('false', false);
    if (ch === 'n') return parseLiteral('null', null);
    if (ch === '-' || (ch >= '0' && ch <= '9')) return parseNumber();

    error(`Unexpected character '${ch}'`);
  }

  function parseLiteral(text, value) {
    if (input.slice(pos, pos + text.length) === text) {
      pos += text.length;
      return value;
    }
    error(`Expected '${text}'`);
  }

  function parseString() {
    if (advance() !== '"') error('Expected "');
    let result = '';

    while (pos < input.length) {
      const ch = advance();
      if (ch === '"') return result;
      if (ch === '\\') {
        const esc = advance();
        switch (esc) {
          case '"': result += '"'; break;
          case '\\': result += '\\'; break;
          case '/': result += '/'; break;
          case 'b': result += '\b'; break;
          case 'f': result += '\f'; break;
          case 'n': result += '\n'; break;
          case 'r': result += '\r'; break;
          case 't': result += '\t'; break;
          case 'u': {
            const hex = input.slice(pos, pos + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) error('Invalid unicode escape');
            result += String.fromCharCode(parseInt(hex, 16));
            pos += 4;
            break;
          }
          default: error(`Invalid escape \\${esc}`);
        }
      } else {
        result += ch;
      }
    }
    error('Unterminated string');
  }

  function parseNumber() {
    const start = pos;

    // Optional minus
    if (peek() === '-') advance();

    // Integer part
    if (peek() === '0') {
      advance();
    } else if (peek() >= '1' && peek() <= '9') {
      while (pos < input.length && peek() >= '0' && peek() <= '9') advance();
    } else {
      error('Invalid number');
    }

    // Fractional part
    if (peek() === '.') {
      advance();
      if (!(peek() >= '0' && peek() <= '9')) error('Expected digit after decimal point');
      while (pos < input.length && peek() >= '0' && peek() <= '9') advance();
    }

    // Exponent
    if (peek() === 'e' || peek() === 'E') {
      advance();
      if (peek() === '+' || peek() === '-') advance();
      if (!(peek() >= '0' && peek() <= '9')) error('Expected digit in exponent');
      while (pos < input.length && peek() >= '0' && peek() <= '9') advance();
    }

    const numStr = input.slice(start, pos);
    return Number(numStr);
  }

  function parseArray() {
    if (advance() !== '[') error('Expected [');
    skipWhitespace();

    const result = [];
    if (peek() === ']') { advance(); return result; }

    while (true) {
      result.push(parseValue());
      skipWhitespace();
      if (peek() === ']') { advance(); return result; }
      if (peek() !== ',') error("Expected ',' or ']'");
      advance();
    }
  }

  function parseObject() {
    if (advance() !== '{') error('Expected {');
    skipWhitespace();

    const result = {};
    if (peek() === '}') { advance(); return result; }

    while (true) {
      skipWhitespace();
      if (peek() !== '"') error('Expected string key');
      const key = parseString();
      skipWhitespace();
      if (advance() !== ':') error("Expected ':'");
      result[key] = parseValue();
      skipWhitespace();
      if (peek() === '}') { advance(); return result; }
      if (peek() !== ',') error("Expected ',' or '}'");
      advance();
    }
  }

  const result = parseValue();
  skipWhitespace();
  if (pos < input.length) error('Unexpected characters after JSON');
  return result;
}

// Stringify — convert JS value to JSON string
export function stringify(value, indent = 0) {
  return _stringify(value, indent, 0);
}

function _stringify(value, indent, depth) {
  if (value === null) return 'null';
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!isFinite(value)) return 'null';
    return String(value);
  }
  if (typeof value === 'string') return stringifyString(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map(v => _stringify(v, indent, depth + 1)).filter(v => v !== undefined);
    if (indent) {
      const pad = ' '.repeat(indent * (depth + 1));
      const endPad = ' '.repeat(indent * depth);
      return `[\n${items.map(i => pad + i).join(',\n')}\n${endPad}]`;
    }
    return `[${items.join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([k, v]) => {
        const sv = _stringify(v, indent, depth + 1);
        if (sv === undefined) return undefined;
        return [stringifyString(k), sv];
      })
      .filter(e => e !== undefined);
    if (entries.length === 0) return '{}';
    if (indent) {
      const pad = ' '.repeat(indent * (depth + 1));
      const endPad = ' '.repeat(indent * depth);
      return `{\n${entries.map(([k, v]) => `${pad}${k}: ${v}`).join(',\n')}\n${endPad}}`;
    }
    return `{${entries.map(([k, v]) => `${k}:${v}`).join(',')}}`;
  }

  return undefined;
}

function stringifyString(s) {
  let result = '"';
  for (const ch of s) {
    switch (ch) {
      case '"': result += '\\"'; break;
      case '\\': result += '\\\\'; break;
      case '\b': result += '\\b'; break;
      case '\f': result += '\\f'; break;
      case '\n': result += '\\n'; break;
      case '\r': result += '\\r'; break;
      case '\t': result += '\\t'; break;
      default:
        if (ch.charCodeAt(0) < 0x20) {
          result += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
        } else {
          result += ch;
        }
    }
  }
  return result + '"';
}
