// Monkey Language Lexer
// Tokenizes source code into a stream of tokens

export const TokenType = {
  // Literals
  INT: 'INT',
  FLOAT: 'FLOAT',
  STRING: 'STRING',
  TEMPLATE_STRING: 'TEMPLATE_STRING', // backtick string with ${} interpolation
  IDENT: 'IDENT',

  // Operators
  ASSIGN: '=',
  PLUS: '+',
  MINUS: '-',
  BANG: '!',
  ASTERISK: '*',
  SLASH: '/',
  PERCENT: '%',
  LT: '<',
  GT: '>',
  LT_EQ: '<=',
  GT_EQ: '>=',
  AND: '&&',
  OR: '||',
  NULLISH: '??',
  OPTIONAL_CHAIN: '?.',
  DOT: '.', DOT_DOT: '..',
  ARROW: '=>',
  THIN_ARROW: '->',
  SPREAD: '...',
  PIPE: '|>',
  BAR: '|',
  EQ: '==',
  NOT_EQ: '!=',
  PLUS_ASSIGN: '+=',
  MINUS_ASSIGN: '-=',
  PLUS_PLUS: '++',
  MINUS_MINUS: '--',
  ASTERISK_ASSIGN: '*=',
  SLASH_ASSIGN: '/=',
  PERCENT_ASSIGN: '%=',

  // Delimiters
  COMMA: ',',
  SEMICOLON: ';',
  COLON: ':',
  QUESTION: '?',
  LPAREN: '(',
  RPAREN: ')',
  LBRACE: '{',
  RBRACE: '}',
  LBRACKET: '[',
  RBRACKET: ']',

  // Keywords
  FUNCTION: 'FUNCTION',
  LET: 'LET',
  CONST: 'CONST',
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  IF: 'IF',
  ELSE: 'ELSE',
  RETURN: 'RETURN',
  WHILE: 'WHILE',
  FOR: 'FOR',
  BREAK: 'BREAK',
  CONTINUE: 'CONTINUE',
  NULL_LIT: 'NULL_LIT',
  MATCH: 'MATCH',
  DO: 'DO',
  UNDERSCORE: '_',
  IMPORT: 'IMPORT',
  ENUM: 'ENUM',
  TRY: 'TRY',
  CATCH: 'CATCH',
  THROW: 'THROW',
  FINALLY: 'FINALLY',
  GEN: 'GEN',
  YIELD: 'YIELD',

  // Special
  EOF: 'EOF',
  ILLEGAL: 'ILLEGAL',
};

const KEYWORDS = {
  fn: TokenType.FUNCTION,
  let: TokenType.LET,
  const: TokenType.CONST,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
  if: TokenType.IF,
  else: TokenType.ELSE,
  return: TokenType.RETURN,
  while: TokenType.WHILE,
  for: TokenType.FOR,
  break: TokenType.BREAK,
  continue: TokenType.CONTINUE,
  null: TokenType.NULL_LIT,
  match: TokenType.MATCH,
  do: TokenType.DO,
  import: TokenType.IMPORT,
  enum: TokenType.ENUM,
  try: TokenType.TRY,
  catch: TokenType.CATCH,
  throw: TokenType.THROW,
  finally: TokenType.FINALLY,
  gen: TokenType.GEN,
  yield: TokenType.YIELD,
};

export class Token {
  constructor(type, literal, line) {
    this.type = type;
    this.literal = literal;
    if (line !== undefined) this.line = line;
  }
}

export class Lexer {
  constructor(input) {
    this.input = input;
    this.position = 0;     // current position (points to current char)
    this.readPosition = 0; // next position (after current char)
    this.ch = null;        // current char
    this.line = 1;         // current line number (1-indexed)
    this.readChar();
  }

  makeToken(type, literal) {
    const t = new Token(type, literal);
    t.line = this.line;
    return t;
  }

  readChar() {
    this.ch = this.readPosition >= this.input.length
      ? null
      : this.input[this.readPosition];
    this.position = this.readPosition;
    this.readPosition++;
  }

  peekChar() {
    return this.readPosition >= this.input.length
      ? null
      : this.input[this.readPosition];
  }

  skipWhitespace() {
    while (this.ch === ' ' || this.ch === '\t' || this.ch === '\n' || this.ch === '\r') {
      if (this.ch === '\n') this.line++;
      this.readChar();
    }
    // Skip single-line comments
    if (this.ch === '/' && this.peekChar() === '/') {
      while (this.ch !== '\n' && this.ch !== '\0') {
        this.readChar();
      }
      this.skipWhitespace(); // Continue skipping after comment
    }
    // Skip multi-line comments
    if (this.ch === '/' && this.peekChar() === '*') {
      this.readChar(); // skip /
      this.readChar(); // skip *
      while (!(this.ch === '*' && this.peekChar() === '/') && this.ch !== '\0') {
        if (this.ch === '\n') this.line++;
        this.readChar();
      }
      if (this.ch === '*') {
        this.readChar(); // skip *
        this.readChar(); // skip /
      }
      this.skipWhitespace(); // Continue skipping after comment
    }
  }

  readIdentifier() {
    const start = this.position;
    while (this.ch && (isLetter(this.ch) || this.ch === '_' || isDigit(this.ch))) {
      this.readChar();
    }
    return this.input.slice(start, this.position);
  }

  readNumber() {
    const start = this.position;
    let isFloat = false;
    while (this.ch && isDigit(this.ch)) {
      this.readChar();
    }
    if (this.ch === '.' && isDigit(this.peekChar())) {
      isFloat = true;
      this.readChar(); // consume .
      while (this.ch && isDigit(this.ch)) {
        this.readChar();
      }
    }
    return { value: this.input.slice(start, this.position), isFloat };
  }

  readString() {
    this.readChar(); // skip opening quote
    let str = '';
    while (this.ch !== null && this.ch !== '"') {
      if (this.ch === '\\') {
        this.readChar(); // skip backslash
        switch (this.ch) {
          case 'n': str += '\n'; break;
          case 't': str += '\t'; break;
          case 'r': str += '\r'; break;
          case '\\': str += '\\'; break;
          case '"': str += '"'; break;
          case '0': str += '\0'; break;
          default: str += '\\' + this.ch; break;
        }
      } else {
        str += this.ch;
      }
      this.readChar();
    }
    this.readChar(); // skip closing quote
    return str;
  }

  readTemplateString() {
    this.readChar(); // skip opening backtick
    let str = '';
    while (this.ch !== null && this.ch !== '`') {
      if (this.ch === '\\') {
        this.readChar();
        switch (this.ch) {
          case 'n': str += '\n'; break;
          case 't': str += '\t'; break;
          case 'r': str += '\r'; break;
          case '\\': str += '\\'; break;
          case '`': str += '`'; break;
          case '$': str += '$'; break;
          default: str += '\\' + this.ch; break;
        }
      } else {
        str += this.ch;
      }
      this.readChar();
    }
    this.readChar(); // skip closing backtick
    return str;
  }

  nextToken() {
    this.skipWhitespace();

    let tok;
    switch (this.ch) {
      case '=':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = this.makeToken(TokenType.EQ, '==');
        } else if (this.peekChar() === '>') {
          this.readChar();
          tok = this.makeToken(TokenType.ARROW, '=>');
        } else {
          tok = this.makeToken(TokenType.ASSIGN, '=');
        }
        break;
      case '+':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = this.makeToken(TokenType.PLUS_ASSIGN, '+=');
        } else if (this.peekChar() === '+') {
          this.readChar();
          tok = this.makeToken(TokenType.PLUS_PLUS, '++');
        } else {
          tok = this.makeToken(TokenType.PLUS, '+');
        }
        break;
      case '-':
        if (this.peekChar() === '>') {
          this.readChar();
          tok = this.makeToken(TokenType.THIN_ARROW, '->');
        } else if (this.peekChar() === '=') {
          this.readChar();
          tok = this.makeToken(TokenType.MINUS_ASSIGN, '-=');
        } else if (this.peekChar() === '-') {
          this.readChar();
          tok = this.makeToken(TokenType.MINUS_MINUS, '--');
        } else {
          tok = this.makeToken(TokenType.MINUS, '-');
        }
        break;
      case '!':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = this.makeToken(TokenType.NOT_EQ, '!=');
        } else {
          tok = this.makeToken(TokenType.BANG, '!');
        }
        break;
      case '*':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = this.makeToken(TokenType.ASTERISK_ASSIGN, '*=');
        } else {
          tok = this.makeToken(TokenType.ASTERISK, '*');
        }
        break;
      case '/':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = this.makeToken(TokenType.SLASH_ASSIGN, '/=');
        } else {
          tok = this.makeToken(TokenType.SLASH, '/');
        }
        break;
      case '%':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = this.makeToken(TokenType.PERCENT_ASSIGN, '%=');
        } else {
          tok = this.makeToken(TokenType.PERCENT, '%');
        }
        break;
      case '&':
        if (this.peekChar() === '&') {
          this.readChar();
          tok = this.makeToken(TokenType.AND, '&&');
        } else {
          tok = this.makeToken(TokenType.ILLEGAL, '&');
        }
        break;
      case '|':
        if (this.peekChar() === '|') {
          this.readChar();
          tok = this.makeToken(TokenType.OR, '||');
        } else if (this.peekChar() === '>') {
          this.readChar();
          tok = this.makeToken(TokenType.PIPE, '|>');
        } else {
          tok = this.makeToken(TokenType.BAR, '|');
        }
        break;
      case '<':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = this.makeToken(TokenType.LT_EQ, '<=');
        } else {
          tok = this.makeToken(TokenType.LT, '<');
        }
        break;
      case '>':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = this.makeToken(TokenType.GT_EQ, '>=');
        } else {
          tok = this.makeToken(TokenType.GT, '>');
        }
        break;
      case ',': tok = this.makeToken(TokenType.COMMA, ','); break;
      case ':': tok = this.makeToken(TokenType.COLON, ':'); break;
      case '?':
        if (this.peekChar() === '?') {
          this.readChar();
          tok = this.makeToken(TokenType.NULLISH, '??');
        } else if (this.peekChar() === '.') {
          this.readChar();
          tok = this.makeToken(TokenType.OPTIONAL_CHAIN, '?.');
        } else {
          tok = this.makeToken(TokenType.QUESTION, '?');
        }
        break;
      case ';': tok = this.makeToken(TokenType.SEMICOLON, ';'); break;
      case '(': tok = this.makeToken(TokenType.LPAREN, '('); break;
      case ')': tok = this.makeToken(TokenType.RPAREN, ')'); break;
      case '{': tok = this.makeToken(TokenType.LBRACE, '{'); break;
      case '}': tok = this.makeToken(TokenType.RBRACE, '}'); break;
      case '[': tok = this.makeToken(TokenType.LBRACKET, '['); break;
      case ']': tok = this.makeToken(TokenType.RBRACKET, ']'); break;
      case '"':
        { const t = this.makeToken(TokenType.STRING, this.readString()); t.line = this.line; return t; };
      case '`':
        return this.makeToken(TokenType.TEMPLATE_STRING, this.readTemplateString());
      case '.':
        if (this.peekChar() === '.' && this.input[this.readPosition + 1] === '.') {
          this.readChar();
          this.readChar();
          tok = this.makeToken(TokenType.SPREAD, '...');
        } else if (this.peekChar() === '.') {
          this.readChar();
          tok = this.makeToken(TokenType.DOT_DOT, '..');
        } else {
          tok = this.makeToken(TokenType.DOT, '.');
        }
        break;
      case null:
        return this.makeToken(TokenType.EOF, '');
      default:
        if (isLetter(this.ch)) {
          const ident = this.readIdentifier();
          const type = KEYWORDS[ident] || TokenType.IDENT;
          return this.makeToken(type, ident);
        } else if (isDigit(this.ch)) {
          const num = this.readNumber();
          return this.makeToken(num.isFloat ? TokenType.FLOAT : TokenType.INT, num.value);
        } else {
          tok = this.makeToken(TokenType.ILLEGAL, this.ch);
        }
    }

    this.readChar();
    return tok;
  }

  /** Tokenize all remaining input */
  tokenize() {
    const tokens = [];
    let tok;
    do {
      tok = this.nextToken();
      tokens.push(tok);
    } while (tok.type !== TokenType.EOF);
    return tokens;
  }
}

function isLetter(ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}
