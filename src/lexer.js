// Monkey Language Lexer
// Tokenizes source code into a stream of tokens

export const TokenType = {
  // Literals
  INT: 'INT',
  STRING: 'STRING',
  IDENT: 'IDENT',

  // Operators
  ASSIGN: '=',
  PLUS: '+',
  MINUS: '-',
  BANG: '!',
  ASTERISK: '*',
  SLASH: '/',
  LT: '<',
  GT: '>',
  EQ: '==',
  NOT_EQ: '!=',

  // Delimiters
  COMMA: ',',
  SEMICOLON: ';',
  COLON: ':',
  LPAREN: '(',
  RPAREN: ')',
  LBRACE: '{',
  RBRACE: '}',
  LBRACKET: '[',
  RBRACKET: ']',

  // Keywords
  FUNCTION: 'FUNCTION',
  LET: 'LET',
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  IF: 'IF',
  ELSE: 'ELSE',
  RETURN: 'RETURN',

  // Special
  EOF: 'EOF',
  ILLEGAL: 'ILLEGAL',
};

const KEYWORDS = {
  fn: TokenType.FUNCTION,
  let: TokenType.LET,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
  if: TokenType.IF,
  else: TokenType.ELSE,
  return: TokenType.RETURN,
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
  }

  readIdentifier() {
    const start = this.position;
    while (this.ch && (isLetter(this.ch) || this.ch === '_' || (this.position > start && isDigit(this.ch)))) {
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
    const start = this.position + 1;
    this.readChar(); // skip opening quote
    while (this.ch !== null && this.ch !== '"') {
      this.readChar();
    }
    const str = this.input.slice(start, this.position);
    this.readChar(); // skip closing quote
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
        } else {
          tok = new Token(TokenType.ASSIGN, '=');
        }
        break;
      case '+': tok = new Token(TokenType.PLUS, '+'); break;
      case '-': tok = new Token(TokenType.MINUS, '-'); break;
      case '!':
        if (this.peekChar() === '=') {
          this.readChar();
          tok = new Token(TokenType.NOT_EQ, '!=');
        } else {
          tok = new Token(TokenType.BANG, '!');
        }
        break;
      case '*': tok = new Token(TokenType.ASTERISK, '*'); break;
      case '/': tok = new Token(TokenType.SLASH, '/'); break;
      case '<': tok = new Token(TokenType.LT, '<'); break;
      case '>': tok = new Token(TokenType.GT, '>'); break;
      case ',': tok = new Token(TokenType.COMMA, ','); break;
      case ';': tok = new Token(TokenType.SEMICOLON, ';'); break;
      case ':': tok = new Token(TokenType.COLON, ':'); break;
      case '(': tok = new Token(TokenType.LPAREN, '('); break;
      case ')': tok = new Token(TokenType.RPAREN, ')'); break;
      case '{': tok = new Token(TokenType.LBRACE, '{'); break;
      case '}': tok = new Token(TokenType.RBRACE, '}'); break;
      case '[': tok = new Token(TokenType.LBRACKET, '['); break;
      case ']': tok = new Token(TokenType.RBRACKET, ']'); break;
      case '"':
        return new Token(TokenType.STRING, this.readString());
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
