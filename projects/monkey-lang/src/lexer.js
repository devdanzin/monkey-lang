// Monkey Language Lexer
// Tokenizes source code into a stream of tokens

export const TokenType = {
  // Literals
  INT: 'INT',
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
  PIPE: '|>',
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
  ARROW: '=>',
  UNDERSCORE: '_',

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
};

export class Token {
  constructor(type, literal) {
    this.type = type;
    this.literal = literal;
  }
}

export class Lexer {
  constructor(input) {
    this.input = input;
    this.position = 0;     // current position (points to current char)
    this.readPosition = 0; // next position (after current char)
    this.ch = null;        // current char
    this.readChar();
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
    while (this.ch && isDigit(this.ch)) {
      this.readChar();
    }
    return this.input.slice(start, this.position);
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
          tok = new Token(TokenType.EQ, '==');
        } else if (this.peekChar() === '>') {
          this.readChar();
          tok = new Token(TokenType.ARROW, '=>');
        } else {
          tok = new Token(TokenType.ASSIGN, '=');
        }
        break;
      case '+':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = new Token(TokenType.PLUS_ASSIGN, '+=');
        } else if (this.peekChar() === '+') {
          this.readChar();
          tok = new Token(TokenType.PLUS_PLUS, '++');
        } else {
          tok = new Token(TokenType.PLUS, '+');
        }
        break;
      case '-':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = new Token(TokenType.MINUS_ASSIGN, '-=');
        } else if (this.peekChar() === '-') {
          this.readChar();
          tok = new Token(TokenType.MINUS_MINUS, '--');
        } else {
          tok = new Token(TokenType.MINUS, '-');
        }
        break;
      case '!':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = new Token(TokenType.NOT_EQ, '!=');
        } else {
          tok = new Token(TokenType.BANG, '!');
        }
        break;
      case '*':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = new Token(TokenType.ASTERISK_ASSIGN, '*=');
        } else {
          tok = new Token(TokenType.ASTERISK, '*');
        }
        break;
      case '/':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = new Token(TokenType.SLASH_ASSIGN, '/=');
        } else {
          tok = new Token(TokenType.SLASH, '/');
        }
        break;
      case '%':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = new Token(TokenType.PERCENT_ASSIGN, '%=');
        } else {
          tok = new Token(TokenType.PERCENT, '%');
        }
        break;
      case '&':
        if (this.peekChar() === '&') {
          this.readChar();
          tok = new Token(TokenType.AND, '&&');
        } else {
          tok = new Token(TokenType.ILLEGAL, '&');
        }
        break;
      case '|':
        if (this.peekChar() === '|') {
          this.readChar();
          tok = new Token(TokenType.OR, '||');
        } else if (this.peekChar() === '>') {
          this.readChar();
          tok = new Token(TokenType.PIPE, '|>');
        } else {
          tok = new Token(TokenType.ILLEGAL, '|');
        }
        break;
      case '<':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = new Token(TokenType.LT_EQ, '<=');
        } else {
          tok = new Token(TokenType.LT, '<');
        }
        break;
      case '>':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = new Token(TokenType.GT_EQ, '>=');
        } else {
          tok = new Token(TokenType.GT, '>');
        }
        break;
      case ',': tok = new Token(TokenType.COMMA, ','); break;
      case ':': tok = new Token(TokenType.COLON, ':'); break;
      case '?':
        if (this.peekChar() === '?') {
          this.readChar();
          tok = new Token(TokenType.NULLISH, '??');
        } else {
          tok = new Token(TokenType.QUESTION, '?');
        }
        break;
      case ';': tok = new Token(TokenType.SEMICOLON, ';'); break;
      case '(': tok = new Token(TokenType.LPAREN, '('); break;
      case ')': tok = new Token(TokenType.RPAREN, ')'); break;
      case '{': tok = new Token(TokenType.LBRACE, '{'); break;
      case '}': tok = new Token(TokenType.RBRACE, '}'); break;
      case '[': tok = new Token(TokenType.LBRACKET, '['); break;
      case ']': tok = new Token(TokenType.RBRACKET, ']'); break;
      case '"':
        return new Token(TokenType.STRING, this.readString());
      case '`':
        return new Token(TokenType.TEMPLATE_STRING, this.readTemplateString());
      case null:
        return new Token(TokenType.EOF, '');
      default:
        if (isLetter(this.ch)) {
          const ident = this.readIdentifier();
          const type = KEYWORDS[ident] || TokenType.IDENT;
          return new Token(type, ident);
        } else if (isDigit(this.ch)) {
          return new Token(TokenType.INT, this.readNumber());
        } else {
          tok = new Token(TokenType.ILLEGAL, this.ch);
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
