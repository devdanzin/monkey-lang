// ===== JSON Parser from Scratch =====
// Tokenizer + recursive descent parser + stringify

// ===== Tokenizer =====

const TokenType = {
  LBRACE: '{', RBRACE: '}',
  LBRACKET: '[', RBRACKET: ']',
  COMMA: ',', COLON: ':',
  STRING: 'STRING', NUMBER: 'NUMBER',
  TRUE: 'TRUE', FALSE: 'FALSE', NULL: 'NULL',
  EOF: 'EOF',
};

class Token {
  constructor(type, value, pos) {
    this.type = type;
    this.value = value;
    this.pos = pos;
  }
}

export function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }

    // Structural
    if (ch === '{') { tokens.push(new Token(TokenType.LBRACE, ch, i)); i++; continue; }
    if (ch === '}') { tokens.push(new Token(TokenType.RBRACE, ch, i)); i++; continue; }
    if (ch === '[') { tokens.push(new Token(TokenType.LBRACKET, ch, i)); i++; continue; }
    if (ch === ']') { tokens.push(new Token(TokenType.RBRACKET, ch, i)); i++; continue; }
    if (ch === ',') { tokens.push(new Token(TokenType.COMMA, ch, i)); i++; continue; }
    if (ch === ':') { tokens.push(new Token(TokenType.COLON, ch, i)); i++; continue; }

    // String
    if (ch === '"') {
      let str = '';
      i++; // skip opening quote
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\') {
          i++;
          const esc = input[i];
          if (esc === '"') str += '"';
          else if (esc === '\\') str += '\\';
          else if (esc === '/') str += '/';
          else if (esc === 'b') str += '\b';
          else if (esc === 'f') str += '\f';
          else if (esc === 'n') str += '\n';
          else if (esc === 'r') str += '\r';
          else if (esc === 't') str += '\t';
          else if (esc === 'u') {
            const hex = input.substring(i + 1, i + 5);
            str += String.fromCharCode(parseInt(hex, 16));
            i += 4;
          }
          else throw new SyntaxError(`Invalid escape \\${esc} at position ${i}`);
        } else {
          str += input[i];
        }
        i++;
      }
      if (i >= input.length) throw new SyntaxError('Unterminated string');
      i++; // skip closing quote
      tokens.push(new Token(TokenType.STRING, str, i));
      continue;
    }

    // Number
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      let num = '';
      if (ch === '-') { num += '-'; i++; }
      // Integer part
      if (input[i] === '0') { num += '0'; i++; }
      else { while (i < input.length && input[i] >= '0' && input[i] <= '9') { num += input[i]; i++; } }
      // Fraction
      if (i < input.length && input[i] === '.') {
        num += '.'; i++;
        while (i < input.length && input[i] >= '0' && input[i] <= '9') { num += input[i]; i++; }
      }
      // Exponent
      if (i < input.length && (input[i] === 'e' || input[i] === 'E')) {
        num += input[i]; i++;
        if (i < input.length && (input[i] === '+' || input[i] === '-')) { num += input[i]; i++; }
        while (i < input.length && input[i] >= '0' && input[i] <= '9') { num += input[i]; i++; }
      }
      tokens.push(new Token(TokenType.NUMBER, Number(num), i));
      continue;
    }

    // Keywords
    if (input.startsWith('true', i)) { tokens.push(new Token(TokenType.TRUE, true, i)); i += 4; continue; }
    if (input.startsWith('false', i)) { tokens.push(new Token(TokenType.FALSE, false, i)); i += 5; continue; }
    if (input.startsWith('null', i)) { tokens.push(new Token(TokenType.NULL, null, i)); i += 4; continue; }

    throw new SyntaxError(`Unexpected character '${ch}' at position ${i}`);
  }

  tokens.push(new Token(TokenType.EOF, null, i));
  return tokens;
}

// ===== Parser =====

export function parse(input) {
  const tokens = tokenize(input);
  let pos = 0;

  function peek() { return tokens[pos]; }
  function advance() { return tokens[pos++]; }
  function expect(type) {
    const token = advance();
    if (token.type !== type) throw new SyntaxError(`Expected ${type} but got ${token.type} at position ${token.pos}`);
    return token;
  }

  function parseValue() {
    const token = peek();
    switch (token.type) {
      case TokenType.STRING: advance(); return token.value;
      case TokenType.NUMBER: advance(); return token.value;
      case TokenType.TRUE: advance(); return true;
      case TokenType.FALSE: advance(); return false;
      case TokenType.NULL: advance(); return null;
      case TokenType.LBRACE: return parseObject();
      case TokenType.LBRACKET: return parseArray();
      default: throw new SyntaxError(`Unexpected token ${token.type} at position ${token.pos}`);
    }
  }

  function parseObject() {
    expect(TokenType.LBRACE);
    const obj = {};
    
    if (peek().type !== TokenType.RBRACE) {
      do {
        const key = expect(TokenType.STRING).value;
        expect(TokenType.COLON);
        obj[key] = parseValue();
      } while (peek().type === TokenType.COMMA && advance());
    }
    
    expect(TokenType.RBRACE);
    return obj;
  }

  function parseArray() {
    expect(TokenType.LBRACKET);
    const arr = [];
    
    if (peek().type !== TokenType.RBRACKET) {
      do {
        arr.push(parseValue());
      } while (peek().type === TokenType.COMMA && advance());
    }
    
    expect(TokenType.RBRACKET);
    return arr;
  }

  const result = parseValue();
  if (peek().type !== TokenType.EOF) {
    throw new SyntaxError(`Unexpected token after value at position ${peek().pos}`);
  }
  return result;
}

// ===== Stringify =====

export function stringify(value, indent = 0) {
  return _stringify(value, indent, 0);
}

function _stringify(value, indent, depth) {
  if (value === null) return 'null';
  if (value === undefined) return undefined;
  
  switch (typeof value) {
    case 'boolean': return value ? 'true' : 'false';
    case 'number': {
      if (!isFinite(value)) return 'null';
      return String(value);
    }
    case 'string': return escapeString(value);
    case 'object': {
      if (Array.isArray(value)) return stringifyArray(value, indent, depth);
      return stringifyObject(value, indent, depth);
    }
    default: return undefined;
  }
}

function escapeString(str) {
  let result = '"';
  for (const ch of str) {
    if (ch === '"') result += '\\"';
    else if (ch === '\\') result += '\\\\';
    else if (ch === '\n') result += '\\n';
    else if (ch === '\r') result += '\\r';
    else if (ch === '\t') result += '\\t';
    else if (ch === '\b') result += '\\b';
    else if (ch === '\f') result += '\\f';
    else if (ch.charCodeAt(0) < 0x20) result += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
    else result += ch;
  }
  return result + '"';
}

function stringifyArray(arr, indent, depth) {
  if (arr.length === 0) return '[]';
  
  const items = arr.map(v => _stringify(v, indent, depth + 1)).filter(v => v !== undefined);
  
  if (!indent) return '[' + items.join(',') + ']';
  
  const pad = ' '.repeat(indent * (depth + 1));
  const closePad = ' '.repeat(indent * depth);
  return '[\n' + items.map(item => pad + item).join(',\n') + '\n' + closePad + ']';
}

function stringifyObject(obj, indent, depth) {
  const entries = Object.entries(obj)
    .filter(([, v]) => v !== undefined && typeof v !== 'function')
    .map(([k, v]) => {
      const val = _stringify(v, indent, depth + 1);
      if (val === undefined) return undefined;
      return [escapeString(k), val];
    })
    .filter(Boolean);
  
  if (entries.length === 0) return '{}';
  
  if (!indent) {
    return '{' + entries.map(([k, v]) => k + ':' + v).join(',') + '}';
  }
  
  const pad = ' '.repeat(indent * (depth + 1));
  const closePad = ' '.repeat(indent * depth);
  return '{\n' + entries.map(([k, v]) => pad + k + ': ' + v).join(',\n') + '\n' + closePad + '}';
}

export { TokenType, tokenize as lex };
