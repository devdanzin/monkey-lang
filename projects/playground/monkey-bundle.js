// src/lexer.js
var TokenType = {
  // Literals
  INT: "INT",
  FLOAT: "FLOAT",
  STRING: "STRING",
  TEMPLATE_STRING: "TEMPLATE_STRING",
  // backtick string with ${} interpolation
  IDENT: "IDENT",
  // Operators
  ASSIGN: "=",
  PLUS: "+",
  MINUS: "-",
  BANG: "!",
  ASTERISK: "*",
  SLASH: "/",
  PERCENT: "%",
  LT: "<",
  GT: ">",
  LT_EQ: "<=",
  GT_EQ: ">=",
  AND: "&&",
  OR: "||",
  NULLISH: "??",
  OPTIONAL_CHAIN: "?.",
  DOT: ".",
  DOT_DOT: "..",
  ARROW: "=>",
  THIN_ARROW: "->",
  SPREAD: "...",
  PIPE: "|>",
  BAR: "|",
  EQ: "==",
  NOT_EQ: "!=",
  PLUS_ASSIGN: "+=",
  MINUS_ASSIGN: "-=",
  PLUS_PLUS: "++",
  MINUS_MINUS: "--",
  ASTERISK_ASSIGN: "*=",
  SLASH_ASSIGN: "/=",
  PERCENT_ASSIGN: "%=",
  // Delimiters
  COMMA: ",",
  SEMICOLON: ";",
  COLON: ":",
  QUESTION: "?",
  LPAREN: "(",
  RPAREN: ")",
  LBRACE: "{",
  RBRACE: "}",
  LBRACKET: "[",
  RBRACKET: "]",
  // Keywords
  FUNCTION: "FUNCTION",
  LET: "LET",
  CONST: "CONST",
  TRUE: "TRUE",
  FALSE: "FALSE",
  IF: "IF",
  ELSE: "ELSE",
  RETURN: "RETURN",
  WHILE: "WHILE",
  FOR: "FOR",
  BREAK: "BREAK",
  CONTINUE: "CONTINUE",
  NULL_LIT: "NULL_LIT",
  MATCH: "MATCH",
  DO: "DO",
  UNDERSCORE: "_",
  IMPORT: "IMPORT",
  ENUM: "ENUM",
  // Special
  EOF: "EOF",
  ILLEGAL: "ILLEGAL"
};
var KEYWORDS = {
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
  enum: TokenType.ENUM
};
var Token = class {
  constructor(type, literal) {
    this.type = type;
    this.literal = literal;
  }
};
var Lexer = class {
  constructor(input) {
    this.input = input;
    this.position = 0;
    this.readPosition = 0;
    this.ch = null;
    this.readChar();
  }
  readChar() {
    this.ch = this.readPosition >= this.input.length ? null : this.input[this.readPosition];
    this.position = this.readPosition;
    this.readPosition++;
  }
  peekChar() {
    return this.readPosition >= this.input.length ? null : this.input[this.readPosition];
  }
  skipWhitespace() {
    while (this.ch === " " || this.ch === "	" || this.ch === "\n" || this.ch === "\r") {
      this.readChar();
    }
    if (this.ch === "/" && this.peekChar() === "/") {
      while (this.ch !== "\n" && this.ch !== "\0") {
        this.readChar();
      }
      this.skipWhitespace();
    }
    if (this.ch === "/" && this.peekChar() === "*") {
      this.readChar();
      this.readChar();
      while (!(this.ch === "*" && this.peekChar() === "/") && this.ch !== "\0") {
        this.readChar();
      }
      if (this.ch === "*") {
        this.readChar();
        this.readChar();
      }
      this.skipWhitespace();
    }
  }
  readIdentifier() {
    const start = this.position;
    while (this.ch && (isLetter(this.ch) || this.ch === "_" || isDigit(this.ch))) {
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
    if (this.ch === "." && isDigit(this.peekChar())) {
      isFloat = true;
      this.readChar();
      while (this.ch && isDigit(this.ch)) {
        this.readChar();
      }
    }
    return { value: this.input.slice(start, this.position), isFloat };
  }
  readString() {
    this.readChar();
    let str = "";
    while (this.ch !== null && this.ch !== '"') {
      if (this.ch === "\\") {
        this.readChar();
        switch (this.ch) {
          case "n":
            str += "\n";
            break;
          case "t":
            str += "	";
            break;
          case "r":
            str += "\r";
            break;
          case "\\":
            str += "\\";
            break;
          case '"':
            str += '"';
            break;
          case "0":
            str += "\0";
            break;
          default:
            str += "\\" + this.ch;
            break;
        }
      } else {
        str += this.ch;
      }
      this.readChar();
    }
    this.readChar();
    return str;
  }
  readTemplateString() {
    this.readChar();
    let str = "";
    while (this.ch !== null && this.ch !== "`") {
      if (this.ch === "\\") {
        this.readChar();
        switch (this.ch) {
          case "n":
            str += "\n";
            break;
          case "t":
            str += "	";
            break;
          case "r":
            str += "\r";
            break;
          case "\\":
            str += "\\";
            break;
          case "`":
            str += "`";
            break;
          case "$":
            str += "$";
            break;
          default:
            str += "\\" + this.ch;
            break;
        }
      } else {
        str += this.ch;
      }
      this.readChar();
    }
    this.readChar();
    return str;
  }
  nextToken() {
    this.skipWhitespace();
    let tok;
    switch (this.ch) {
      case "=":
        if (this.peekChar() === "=") {
          this.readChar();
          tok = new Token(TokenType.EQ, "==");
        } else if (this.peekChar() === ">") {
          this.readChar();
          tok = new Token(TokenType.ARROW, "=>");
        } else {
          tok = new Token(TokenType.ASSIGN, "=");
        }
        break;
      case "+":
        if (this.peekChar() === "=") {
          this.readChar();
          tok = new Token(TokenType.PLUS_ASSIGN, "+=");
        } else if (this.peekChar() === "+") {
          this.readChar();
          tok = new Token(TokenType.PLUS_PLUS, "++");
        } else {
          tok = new Token(TokenType.PLUS, "+");
        }
        break;
      case "-":
        if (this.peekChar() === ">") {
          this.readChar();
          tok = new Token(TokenType.THIN_ARROW, "->");
        } else if (this.peekChar() === "=") {
          this.readChar();
          tok = new Token(TokenType.MINUS_ASSIGN, "-=");
        } else if (this.peekChar() === "-") {
          this.readChar();
          tok = new Token(TokenType.MINUS_MINUS, "--");
        } else {
          tok = new Token(TokenType.MINUS, "-");
        }
        break;
      case "!":
        if (this.peekChar() === "=") {
          this.readChar();
          tok = new Token(TokenType.NOT_EQ, "!=");
        } else {
          tok = new Token(TokenType.BANG, "!");
        }
        break;
      case "*":
        if (this.peekChar() === "=") {
          this.readChar();
          tok = new Token(TokenType.ASTERISK_ASSIGN, "*=");
        } else {
          tok = new Token(TokenType.ASTERISK, "*");
        }
        break;
      case "/":
        if (this.peekChar() === "=") {
          this.readChar();
          tok = new Token(TokenType.SLASH_ASSIGN, "/=");
        } else {
          tok = new Token(TokenType.SLASH, "/");
        }
        break;
      case "%":
        if (this.peekChar() === "=") {
          this.readChar();
          tok = new Token(TokenType.PERCENT_ASSIGN, "%=");
        } else {
          tok = new Token(TokenType.PERCENT, "%");
        }
        break;
      case "&":
        if (this.peekChar() === "&") {
          this.readChar();
          tok = new Token(TokenType.AND, "&&");
        } else {
          tok = new Token(TokenType.ILLEGAL, "&");
        }
        break;
      case "|":
        if (this.peekChar() === "|") {
          this.readChar();
          tok = new Token(TokenType.OR, "||");
        } else if (this.peekChar() === ">") {
          this.readChar();
          tok = new Token(TokenType.PIPE, "|>");
        } else {
          tok = new Token(TokenType.BAR, "|");
        }
        break;
      case "<":
        if (this.peekChar() === "=") {
          this.readChar();
          tok = new Token(TokenType.LT_EQ, "<=");
        } else {
          tok = new Token(TokenType.LT, "<");
        }
        break;
      case ">":
        if (this.peekChar() === "=") {
          this.readChar();
          tok = new Token(TokenType.GT_EQ, ">=");
        } else {
          tok = new Token(TokenType.GT, ">");
        }
        break;
      case ",":
        tok = new Token(TokenType.COMMA, ",");
        break;
      case ":":
        tok = new Token(TokenType.COLON, ":");
        break;
      case "?":
        if (this.peekChar() === "?") {
          this.readChar();
          tok = new Token(TokenType.NULLISH, "??");
        } else if (this.peekChar() === ".") {
          this.readChar();
          tok = new Token(TokenType.OPTIONAL_CHAIN, "?.");
        } else {
          tok = new Token(TokenType.QUESTION, "?");
        }
        break;
      case ";":
        tok = new Token(TokenType.SEMICOLON, ";");
        break;
      case "(":
        tok = new Token(TokenType.LPAREN, "(");
        break;
      case ")":
        tok = new Token(TokenType.RPAREN, ")");
        break;
      case "{":
        tok = new Token(TokenType.LBRACE, "{");
        break;
      case "}":
        tok = new Token(TokenType.RBRACE, "}");
        break;
      case "[":
        tok = new Token(TokenType.LBRACKET, "[");
        break;
      case "]":
        tok = new Token(TokenType.RBRACKET, "]");
        break;
      case '"':
        return new Token(TokenType.STRING, this.readString());
      case "`":
        return new Token(TokenType.TEMPLATE_STRING, this.readTemplateString());
      case ".":
        if (this.peekChar() === "." && this.input[this.readPosition + 1] === ".") {
          this.readChar();
          this.readChar();
          tok = new Token(TokenType.SPREAD, "...");
        } else if (this.peekChar() === ".") {
          this.readChar();
          tok = new Token(TokenType.DOT_DOT, "..");
        } else {
          tok = new Token(TokenType.DOT, ".");
        }
        break;
      case null:
        return new Token(TokenType.EOF, "");
      default:
        if (isLetter(this.ch)) {
          const ident = this.readIdentifier();
          const type = KEYWORDS[ident] || TokenType.IDENT;
          return new Token(type, ident);
        } else if (isDigit(this.ch)) {
          const num = this.readNumber();
          return new Token(num.isFloat ? TokenType.FLOAT : TokenType.INT, num.value);
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
};
function isLetter(ch) {
  return ch >= "a" && ch <= "z" || ch >= "A" && ch <= "Z" || ch === "_";
}
function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}

// src/ast.js
var Program = class {
  constructor() {
    this.statements = [];
  }
  tokenLiteral() {
    return this.statements.length > 0 ? this.statements[0].tokenLiteral() : "";
  }
  toString() {
    return this.statements.map((s) => s.toString()).join("");
  }
};
var LetStatement = class {
  constructor(token, name, value) {
    this.token = token;
    this.name = name;
    this.value = value;
    this.isConst = token.type === "CONST";
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `${this.isConst ? "const" : "let"} ${this.name} = ${this.value};`;
  }
};
var ReturnStatement = class {
  constructor(token, returnValue) {
    this.token = token;
    this.returnValue = returnValue;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `return ${this.returnValue};`;
  }
};
var ImportStatement = class {
  constructor(token, moduleName, bindings = null, alias = null) {
    this.token = token;
    this.moduleName = moduleName;
    this.bindings = bindings;
    this.alias = alias;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    if (this.bindings) {
      return `import "${this.moduleName}" for ${this.bindings.join(", ")};`;
    }
    if (this.alias) {
      return `import "${this.moduleName}" as ${this.alias};`;
    }
    return `import "${this.moduleName}";`;
  }
};
var ExpressionStatement = class {
  constructor(token, expression) {
    this.token = token;
    this.expression = expression;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return this.expression ? this.expression.toString() : "";
  }
};
var BlockStatement = class {
  constructor(token, statements) {
    this.token = token;
    this.statements = statements;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return this.statements.map((s) => s.toString()).join("");
  }
};
var Identifier = class {
  constructor(token, value) {
    this.token = token;
    this.value = value;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return this.value;
  }
};
var IntegerLiteral = class {
  constructor(token, value) {
    this.token = token;
    this.value = value;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return this.token.literal;
  }
};
var FloatLiteral = class {
  constructor(token, value) {
    this.token = token;
    this.value = value;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return this.token.literal;
  }
};
var StringLiteral = class {
  constructor(token, value) {
    this.token = token;
    this.value = value;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `"${this.value}"`;
  }
};
var BooleanLiteral = class {
  constructor(token, value) {
    this.token = token;
    this.value = value;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return this.token.literal;
  }
};
var PrefixExpression = class {
  constructor(token, operator, right) {
    this.token = token;
    this.operator = operator;
    this.right = right;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `(${this.operator}${this.right})`;
  }
};
var InfixExpression = class {
  constructor(token, left, operator, right) {
    this.token = token;
    this.left = left;
    this.operator = operator;
    this.right = right;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `(${this.left} ${this.operator} ${this.right})`;
  }
};
var IfExpression = class {
  constructor(token, condition, consequence, alternative) {
    this.token = token;
    this.condition = condition;
    this.consequence = consequence;
    this.alternative = alternative;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    let s = `if${this.condition} ${this.consequence}`;
    if (this.alternative) s += `else ${this.alternative}`;
    return s;
  }
};
var FunctionLiteral = class {
  constructor(token, parameters, body) {
    this.token = token;
    this.parameters = parameters;
    this.body = body;
    this.restParam = null;
    this.paramTypes = null;
    this.returnType = null;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    const params = this.parameters.map((p, i) => {
      const type = this.paramTypes && this.paramTypes[i] ? `: ${this.paramTypes[i]}` : "";
      return `${p}${type}`;
    });
    const ret = this.returnType ? ` -> ${this.returnType}` : "";
    return `fn(${params.join(", ")})${ret} ${this.body}`;
  }
};
var CallExpression = class {
  constructor(token, fn, args) {
    this.token = token;
    this.function = fn;
    this.arguments = args;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `${this.function}(${this.arguments.join(", ")})`;
  }
};
var ArrayLiteral = class {
  constructor(token, elements) {
    this.token = token;
    this.elements = elements;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `[${this.elements.join(", ")}]`;
  }
};
var ArrayComprehension = class {
  constructor(token, body, variable, iterable, condition) {
    this.token = token;
    this.body = body;
    this.variable = variable;
    this.iterable = iterable;
    this.condition = condition;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    const cond = this.condition ? ` if ${this.condition}` : "";
    return `[${this.body} for ${this.variable} in ${this.iterable}${cond}]`;
  }
};
var IndexExpression = class {
  constructor(token, left, index) {
    this.token = token;
    this.left = left;
    this.index = index;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `(${this.left}[${this.index}])`;
  }
};
var OptionalChainExpression = class {
  constructor(token, left, index) {
    this.token = token;
    this.left = left;
    this.index = index;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `(${this.left}?.[${this.index}])`;
  }
};
var SpreadElement = class {
  constructor(token, expression) {
    this.token = token;
    this.expression = expression;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `...${this.expression}`;
  }
};
var HashLiteral = class {
  constructor(token, pairs) {
    this.token = token;
    this.pairs = pairs;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    const entries = [];
    for (const [k, v] of this.pairs) entries.push(`${k}:${v}`);
    return `{${entries.join(", ")}}`;
  }
};
var WhileExpression = class {
  constructor(token, condition, body) {
    this.token = token;
    this.condition = condition;
    this.body = body;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `while(${this.condition}) ${this.body}`;
  }
};
var AssignExpression = class {
  constructor(token, name, value) {
    this.token = token;
    this.name = name;
    this.value = value;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `${this.name} = ${this.value}`;
  }
};
var ForExpression = class {
  constructor(token, init, condition, update, body) {
    this.token = token;
    this.init = init;
    this.condition = condition;
    this.update = update;
    this.body = body;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `for (...) { ... }`;
  }
};
var ForInExpression = class {
  constructor(token, variable, iterable, body) {
    this.token = token;
    this.variable = variable;
    this.iterable = iterable;
    this.body = body;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `for (${this.variable} in ...) { ... }`;
  }
};
var BreakStatement = class {
  constructor(token) {
    this.token = token;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return "break";
  }
};
var ContinueStatement = class {
  constructor(token) {
    this.token = token;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return "continue";
  }
};
var EnumStatement = class {
  constructor(token, name, variants) {
    this.token = token;
    this.name = name;
    this.variants = variants;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `enum ${this.name} { ${this.variants.join(", ")} }`;
  }
};
var TemplateLiteral = class {
  constructor(token, parts) {
    this.token = token;
    this.parts = parts;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return "`...`";
  }
};
var IndexAssignExpression = class {
  constructor(token, left, index, value) {
    this.token = token;
    this.left = left;
    this.index = index;
    this.value = value;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `${this.left}[${this.index}] = ${this.value}`;
  }
};
var NullLiteral = class {
  constructor(token) {
    this.token = token;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return "null";
  }
};
var SliceExpression = class {
  constructor(token, left, start, end) {
    this.token = token;
    this.left = left;
    this.start = start;
    this.end = end;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `${this.left}[${this.start}:${this.end}]`;
  }
};
var TernaryExpression = class {
  constructor(token, condition, consequence, alternative) {
    this.token = token;
    this.condition = condition;
    this.consequence = consequence;
    this.alternative = alternative;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `${this.condition} ? ${this.consequence} : ${this.alternative}`;
  }
};
var MatchExpression = class {
  constructor(token, subject, arms) {
    this.token = token;
    this.subject = subject;
    this.arms = arms;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return "match { ... }";
  }
};
var TypePattern = class {
  constructor(typeName, binding) {
    this.typeName = typeName;
    this.binding = binding;
  }
  toString() {
    return `${this.typeName}(${this.binding.value})`;
  }
};
var OrPattern = class {
  constructor(patterns) {
    this.patterns = patterns;
  }
  toString() {
    return this.patterns.map((p) => p.toString()).join(" | ");
  }
};
var DestructuringLet = class {
  constructor(token, names, value) {
    this.token = token;
    this.names = names;
    this.value = value;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `let [${this.names.map((n) => n ? n.value : "_").join(", ")}] = ...`;
  }
};
var HashDestructuringLet = class {
  constructor(token, names, value) {
    this.token = token;
    this.names = names;
    this.value = value;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `let {${this.names.map((n) => n.value).join(", ")}} = ...`;
  }
};
var DoWhileExpression = class {
  constructor(token, body, condition) {
    this.token = token;
    this.body = body;
    this.condition = condition;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return "do { ... } while (...)";
  }
};
var RangeExpression = class {
  constructor(token, start, end) {
    this.token = token;
    this.start = start;
    this.end = end;
  }
  tokenLiteral() {
    return this.token.literal;
  }
  toString() {
    return `${this.start}..${this.end}`;
  }
};

// src/parser.js
var Precedence = {
  LOWEST: 1,
  ASSIGN: 2,
  // =
  PIPE: 3,
  // |>
  NULLISH: 4,
  // ??
  OR: 5,
  // ||
  AND: 6,
  // &&
  EQUALS: 7,
  // ==
  LESSGREATER: 8,
  // > or <
  SUM: 9,
  // +
  PRODUCT: 10,
  // *
  PREFIX: 11,
  // -X or !X
  CALL: 12,
  // myFunction(X)
  INDEX: 13
  // array[index]
};
var TOKEN_PRECEDENCE = {
  [TokenType.ASSIGN]: Precedence.ASSIGN,
  [TokenType.PLUS_ASSIGN]: Precedence.ASSIGN,
  [TokenType.MINUS_ASSIGN]: Precedence.ASSIGN,
  [TokenType.ASTERISK_ASSIGN]: Precedence.ASSIGN,
  [TokenType.SLASH_ASSIGN]: Precedence.ASSIGN,
  [TokenType.PERCENT_ASSIGN]: Precedence.ASSIGN,
  [TokenType.QUESTION]: Precedence.OR,
  [TokenType.NULLISH]: Precedence.NULLISH,
  [TokenType.PIPE]: Precedence.PIPE,
  [TokenType.DOT_DOT]: Precedence.PIPE,
  [TokenType.OPTIONAL_CHAIN]: Precedence.INDEX,
  [TokenType.DOT]: Precedence.INDEX,
  [TokenType.PLUS_PLUS]: Precedence.CALL,
  // postfix, high precedence
  [TokenType.MINUS_MINUS]: Precedence.CALL,
  // ternary has same precedence as OR
  [TokenType.EQ]: Precedence.EQUALS,
  [TokenType.NOT_EQ]: Precedence.EQUALS,
  [TokenType.AND]: Precedence.AND,
  [TokenType.OR]: Precedence.OR,
  [TokenType.LT]: Precedence.LESSGREATER,
  [TokenType.GT]: Precedence.LESSGREATER,
  [TokenType.LT_EQ]: Precedence.LESSGREATER,
  [TokenType.GT_EQ]: Precedence.LESSGREATER,
  [TokenType.PLUS]: Precedence.SUM,
  [TokenType.MINUS]: Precedence.SUM,
  [TokenType.SLASH]: Precedence.PRODUCT,
  [TokenType.ASTERISK]: Precedence.PRODUCT,
  [TokenType.PERCENT]: Precedence.PRODUCT,
  [TokenType.LPAREN]: Precedence.CALL,
  [TokenType.LBRACKET]: Precedence.INDEX
};
var Parser = class _Parser {
  constructor(lexer) {
    this.lexer = lexer;
    this.errors = [];
    this.curToken = null;
    this.peekToken = null;
    this.prefixParseFns = {};
    this.infixParseFns = {};
    this.registerPrefix(TokenType.IDENT, () => this.parseIdentifier());
    this.registerPrefix(TokenType.INT, () => this.parseIntegerLiteral());
    this.registerPrefix(TokenType.FLOAT, () => this.parseFloatLiteral());
    this.registerPrefix(TokenType.STRING, () => this.parseStringLiteral());
    this.registerPrefix(TokenType.TEMPLATE_STRING, () => this.parseTemplateLiteral());
    this.registerPrefix(TokenType.TRUE, () => this.parseBooleanLiteral());
    this.registerPrefix(TokenType.FALSE, () => this.parseBooleanLiteral());
    this.registerPrefix(TokenType.BANG, () => this.parsePrefixExpression());
    this.registerPrefix(TokenType.MINUS, () => this.parsePrefixExpression());
    this.registerPrefix(TokenType.LPAREN, () => this.parseGroupedExpression());
    this.registerPrefix(TokenType.IF, () => this.parseIfExpression());
    this.registerPrefix(TokenType.FUNCTION, () => this.parseFunctionLiteral());
    this.registerPrefix(TokenType.LBRACKET, () => this.parseArrayLiteral());
    this.registerPrefix(TokenType.LBRACE, () => this.parseHashLiteral());
    this.registerPrefix(TokenType.WHILE, () => this.parseWhileExpression());
    this.registerPrefix(TokenType.FOR, () => this.parseForExpression());
    this.registerPrefix(TokenType.BREAK, () => new BreakStatement(this.curToken));
    this.registerPrefix(TokenType.CONTINUE, () => new ContinueStatement(this.curToken));
    this.registerPrefix(TokenType.NULL_LIT, () => new NullLiteral(this.curToken));
    this.registerPrefix(TokenType.MATCH, () => this.parseMatchExpression());
    this.registerPrefix(TokenType.DO, () => this.parseDoWhileExpression());
    for (const op of [
      TokenType.PLUS,
      TokenType.MINUS,
      TokenType.SLASH,
      TokenType.ASTERISK,
      TokenType.PERCENT,
      TokenType.EQ,
      TokenType.NOT_EQ,
      TokenType.LT,
      TokenType.GT,
      TokenType.LT_EQ,
      TokenType.GT_EQ,
      TokenType.AND,
      TokenType.OR,
      TokenType.NULLISH
    ]) {
      this.registerInfix(op, (left) => this.parseInfixExpression(left));
    }
    this.registerInfix(TokenType.PIPE, (left) => this.parsePipeExpression(left));
    this.registerInfix(TokenType.DOT_DOT, (left) => this.parseRangeExpression(left));
    this.registerInfix(TokenType.OPTIONAL_CHAIN, (left) => this.parseOptionalChainExpression(left));
    this.registerInfix(TokenType.DOT, (left) => this.parseDotExpression(left));
    this.registerInfix(TokenType.LPAREN, (left) => this.parseCallExpression(left));
    this.registerInfix(TokenType.LBRACKET, (left) => this.parseIndexExpression(left));
    this.registerInfix(TokenType.ASSIGN, (left) => this.parseAssignExpression(left));
    this.registerInfix(TokenType.QUESTION, (left) => this.parseTernaryExpression(left));
    this.registerInfix(TokenType.PLUS_PLUS, (left) => this.parsePostfixExpression(left, "+"));
    this.registerInfix(TokenType.MINUS_MINUS, (left) => this.parsePostfixExpression(left, "-"));
    for (const op of [
      TokenType.PLUS_ASSIGN,
      TokenType.MINUS_ASSIGN,
      TokenType.ASTERISK_ASSIGN,
      TokenType.SLASH_ASSIGN,
      TokenType.PERCENT_ASSIGN
    ]) {
      this.registerInfix(op, (left) => this.parseCompoundAssignExpression(left));
    }
    this.nextToken();
    this.nextToken();
  }
  registerPrefix(type, fn) {
    this.prefixParseFns[type] = fn;
  }
  registerInfix(type, fn) {
    this.infixParseFns[type] = fn;
  }
  nextToken() {
    this.curToken = this.peekToken;
    this.peekToken = this.lexer.nextToken();
  }
  curTokenIs(t) {
    return this.curToken.type === t;
  }
  peekTokenIs(t) {
    return this.peekToken.type === t;
  }
  expectPeek(t) {
    if (this.peekTokenIs(t)) {
      this.nextToken();
      return true;
    }
    this.peekError(t);
    return false;
  }
  peekError(t) {
    this.errors.push(`expected next token to be ${t}, got ${this.peekToken.type} instead`);
  }
  peekPrecedence() {
    return TOKEN_PRECEDENCE[this.peekToken.type] || Precedence.LOWEST;
  }
  curPrecedence() {
    return TOKEN_PRECEDENCE[this.curToken.type] || Precedence.LOWEST;
  }
  // --- Entry point ---
  parseProgram() {
    const program = new Program();
    while (!this.curTokenIs(TokenType.EOF)) {
      const stmt = this.parseStatement();
      if (stmt) program.statements.push(stmt);
      this.nextToken();
    }
    return program;
  }
  // --- Statements ---
  parseStatement() {
    switch (this.curToken.type) {
      case TokenType.LET:
        return this.parseLetStatement();
      case TokenType.CONST:
        return this.parseLetStatement();
      case TokenType.RETURN:
        return this.parseReturnStatement();
      case TokenType.IMPORT:
        return this.parseImportStatement();
      case TokenType.ENUM:
        return this.parseEnumStatement();
      default:
        return this.parseExpressionStatement();
    }
  }
  parseLetStatement() {
    const token = this.curToken;
    if (this.peekTokenIs(TokenType.LBRACKET)) {
      return this.parseDestructuringLet(token);
    }
    if (this.peekTokenIs(TokenType.LBRACE)) {
      return this.parseHashDestructuringLet(token);
    }
    if (!this.expectPeek(TokenType.IDENT)) return null;
    const name = new Identifier(this.curToken, this.curToken.literal);
    if (!this.expectPeek(TokenType.ASSIGN)) return null;
    this.nextToken();
    const value = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new LetStatement(token, name, value);
  }
  parseDestructuringLet(token) {
    this.nextToken();
    const names = [];
    if (!this.peekTokenIs(TokenType.RBRACKET)) {
      this.nextToken();
      names.push(new Identifier(this.curToken, this.curToken.literal));
      while (this.peekTokenIs(TokenType.COMMA)) {
        this.nextToken();
        this.nextToken();
        if (this.curTokenIs(TokenType.IDENT) && this.curToken.literal === "_") {
          names.push(null);
        } else {
          names.push(new Identifier(this.curToken, this.curToken.literal));
        }
      }
    }
    if (!this.expectPeek(TokenType.RBRACKET)) return null;
    if (!this.expectPeek(TokenType.ASSIGN)) return null;
    this.nextToken();
    const value = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new DestructuringLet(token, names, value);
  }
  parseHashDestructuringLet(token) {
    this.nextToken();
    const names = [];
    if (!this.peekTokenIs(TokenType.RBRACE)) {
      this.nextToken();
      names.push(new Identifier(this.curToken, this.curToken.literal));
      while (this.peekTokenIs(TokenType.COMMA)) {
        this.nextToken();
        this.nextToken();
        names.push(new Identifier(this.curToken, this.curToken.literal));
      }
    }
    if (!this.expectPeek(TokenType.RBRACE)) return null;
    if (!this.expectPeek(TokenType.ASSIGN)) return null;
    this.nextToken();
    const value = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new HashDestructuringLet(token, names, value);
  }
  parseReturnStatement() {
    const token = this.curToken;
    this.nextToken();
    const returnValue = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ReturnStatement(token, returnValue);
  }
  parseImportStatement() {
    const token = this.curToken;
    this.nextToken();
    if (this.curToken.type !== TokenType.STRING) {
      this.errors.push(`expected module name as string, got ${this.curToken.type}`);
      return null;
    }
    const moduleName = this.curToken.literal;
    let bindings = null;
    let alias = null;
    if (this.peekToken.type === TokenType.FOR) {
      this.nextToken();
      bindings = [];
      do {
        this.nextToken();
        if (this.curToken.type !== TokenType.IDENT) {
          this.errors.push(`expected identifier in import binding, got ${this.curToken.type}`);
          return null;
        }
        bindings.push(this.curToken.literal);
        if (!this.peekTokenIs(TokenType.COMMA)) break;
        this.nextToken();
      } while (true);
    } else if (this.peekToken.type === TokenType.IDENT && this.peekToken.literal === "as") {
      this.nextToken();
      this.nextToken();
      if (this.curToken.type !== TokenType.IDENT) {
        this.errors.push(`expected identifier after 'as', got ${this.curToken.type}`);
        return null;
      }
      alias = this.curToken.literal;
    }
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ImportStatement(token, moduleName, bindings, alias);
  }
  parseExpressionStatement() {
    const token = this.curToken;
    const expression = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ExpressionStatement(token, expression);
  }
  parseEnumStatement() {
    const token = this.curToken;
    this.nextToken();
    if (this.curToken.type !== TokenType.IDENT) {
      this.errors.push(`expected enum name, got ${this.curToken.type}`);
      return null;
    }
    const name = this.curToken.literal;
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const variants = [];
    while (!this.peekTokenIs(TokenType.RBRACE)) {
      this.nextToken();
      if (this.curToken.type !== TokenType.IDENT) {
        this.errors.push(`expected variant name, got ${this.curToken.type}`);
        return null;
      }
      variants.push(this.curToken.literal);
      if (this.peekTokenIs(TokenType.COMMA)) this.nextToken();
    }
    if (!this.expectPeek(TokenType.RBRACE)) return null;
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new EnumStatement(token, name, variants);
  }
  parseBlockStatement() {
    const token = this.curToken;
    const statements = [];
    this.nextToken();
    while (!this.curTokenIs(TokenType.RBRACE) && !this.curTokenIs(TokenType.EOF)) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
      this.nextToken();
    }
    return new BlockStatement(token, statements);
  }
  // --- Expressions (Pratt) ---
  parseExpression(precedence) {
    const prefix = this.prefixParseFns[this.curToken.type];
    if (!prefix) {
      this.errors.push(`no prefix parse function for ${this.curToken.type}`);
      return null;
    }
    let leftExp = prefix();
    while (!this.peekTokenIs(TokenType.SEMICOLON) && precedence < this.peekPrecedence()) {
      const infix = this.infixParseFns[this.peekToken.type];
      if (!infix) return leftExp;
      this.nextToken();
      leftExp = infix(leftExp);
    }
    return leftExp;
  }
  parseIdentifier() {
    return new Identifier(this.curToken, this.curToken.literal);
  }
  parseIntegerLiteral() {
    const value = parseInt(this.curToken.literal, 10);
    if (isNaN(value)) {
      this.errors.push(`could not parse ${this.curToken.literal} as integer`);
      return null;
    }
    return new IntegerLiteral(this.curToken, value);
  }
  parseFloatLiteral() {
    const value = parseFloat(this.curToken.literal);
    if (isNaN(value)) {
      this.errors.push(`could not parse ${this.curToken.literal} as float`);
      return null;
    }
    return new FloatLiteral(this.curToken, value);
  }
  parseStringLiteral() {
    return new StringLiteral(this.curToken, this.curToken.literal);
  }
  parseTemplateLiteral() {
    const token = this.curToken;
    const raw = token.literal;
    const parts = [];
    let i = 0;
    while (i < raw.length) {
      const dollarIdx = raw.indexOf("${", i);
      if (dollarIdx === -1) {
        parts.push(new StringLiteral(token, raw.slice(i)));
        break;
      }
      if (dollarIdx > i) {
        parts.push(new StringLiteral(token, raw.slice(i, dollarIdx)));
      }
      let braceCount = 1;
      let j = dollarIdx + 2;
      while (j < raw.length && braceCount > 0) {
        if (raw[j] === "{") braceCount++;
        else if (raw[j] === "}") braceCount--;
        j++;
      }
      const exprStr = raw.slice(dollarIdx + 2, j - 1);
      const exprLexer = new Lexer(exprStr);
      const exprParser = new _Parser(exprLexer);
      const expr = exprParser.parseExpression(Precedence.LOWEST);
      if (exprParser.errors.length > 0) {
        this.errors.push(...exprParser.errors);
      }
      parts.push(expr);
      i = j;
    }
    if (parts.length === 0) {
      return new StringLiteral(token, "");
    }
    if (parts.length === 1 && parts[0] instanceof StringLiteral) {
      return parts[0];
    }
    return new TemplateLiteral(token, parts);
  }
  parseBooleanLiteral() {
    return new BooleanLiteral(this.curToken, this.curTokenIs(TokenType.TRUE));
  }
  parsePrefixExpression() {
    const token = this.curToken;
    const operator = this.curToken.literal;
    this.nextToken();
    const right = this.parseExpression(Precedence.PREFIX);
    return new PrefixExpression(token, operator, right);
  }
  parseInfixExpression(left) {
    const token = this.curToken;
    const operator = this.curToken.literal;
    const precedence = this.curPrecedence();
    this.nextToken();
    const right = this.parseExpression(precedence);
    return new InfixExpression(token, left, operator, right);
  }
  parsePipeExpression(left) {
    const token = this.curToken;
    this.nextToken();
    const right = this.parseExpression(Precedence.PIPE);
    if (right instanceof CallExpression) {
      right.arguments.unshift(left);
      return right;
    } else {
      return new CallExpression(token, right, [left]);
    }
  }
  parseRangeExpression(left) {
    const token = this.curToken;
    this.nextToken();
    const end = this.parseExpression(Precedence.PIPE + 1);
    return new RangeExpression(token, left, end);
  }
  parseOptionalChainExpression(left) {
    const token = this.curToken;
    if (this.peekToken.type === TokenType.LBRACKET) {
      this.nextToken();
      this.nextToken();
      const index = this.parseExpression(Precedence.LOWEST);
      if (!this.expectPeek(TokenType.RBRACKET)) return null;
      return new OptionalChainExpression(token, left, index);
    } else if (this.peekToken.type === TokenType.IDENT) {
      this.nextToken();
      const key = new StringLiteral(this.curToken, this.curToken.literal);
      return new OptionalChainExpression(token, left, key);
    } else {
      this.errors.push(`expected [ or identifier after ?., got ${this.peekToken.type}`);
      return left;
    }
  }
  parseDotExpression(left) {
    const token = this.curToken;
    if (this.peekToken.type !== TokenType.IDENT) {
      this.errors.push(`expected identifier after '.', got ${this.peekToken.type}`);
      return left;
    }
    this.nextToken();
    const key = new StringLiteral(this.curToken, this.curToken.literal);
    return new IndexExpression(token, left, key);
  }
  parseArrowExpression(left) {
    if (!(left instanceof Identifier)) {
      this.errors.push(`expected identifier before '=>', got ${left.constructor.name}`);
      return null;
    }
    const token = this.curToken;
    const params = [left];
    this.nextToken();
    let body;
    if (this.curToken.type === TokenType.LBRACE) {
      body = this.parseBlockStatement();
    } else {
      const expr = this.parseExpression(Precedence.LOWEST);
      body = new BlockStatement(this.curToken, [new ExpressionStatement(this.curToken, expr)]);
    }
    return new FunctionLiteral(token, params, body);
  }
  parseGroupedExpression() {
    const savedPos = this.lexer.position;
    const savedReadPos = this.lexer.readPosition;
    const savedCh = this.lexer.ch;
    const savedCurToken = this.curToken;
    const savedPeekToken = this.peekToken;
    this.nextToken();
    const params = [];
    let isArrow = false;
    if (this.curToken.type === TokenType.RPAREN) {
      if (this.peekToken.type === TokenType.ARROW) {
        isArrow = true;
      }
    } else if (this.curToken.type === TokenType.IDENT) {
      params.push(new Identifier(this.curToken, this.curToken.literal));
      while (this.peekToken.type === TokenType.COMMA) {
        this.nextToken();
        this.nextToken();
        if (this.curToken.type !== TokenType.IDENT) {
          break;
        }
        params.push(new Identifier(this.curToken, this.curToken.literal));
      }
      if (this.peekToken.type === TokenType.RPAREN) {
        this.nextToken();
        if (this.peekToken.type === TokenType.ARROW) {
          isArrow = true;
        }
      }
    }
    if (isArrow) {
      this.nextToken();
      this.nextToken();
      let body;
      if (this.curToken.type === TokenType.LBRACE) {
        body = this.parseBlockStatement();
      } else {
        const expr = this.parseExpression(Precedence.LOWEST);
        body = new BlockStatement(this.curToken, [new ExpressionStatement(this.curToken, expr)]);
      }
      return new FunctionLiteral(savedCurToken, params, body);
    }
    this.lexer.position = savedPos;
    this.lexer.readPosition = savedReadPos;
    this.lexer.ch = savedCh;
    this.curToken = savedCurToken;
    this.peekToken = savedPeekToken;
    this.nextToken();
    const exp = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.RPAREN)) return null;
    return exp;
  }
  parseIfExpression() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.LPAREN)) return null;
    this.nextToken();
    const condition = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.RPAREN)) return null;
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const consequence = this.parseBlockStatement();
    let alternative = null;
    if (this.peekTokenIs(TokenType.ELSE)) {
      this.nextToken();
      if (this.peekTokenIs(TokenType.IF)) {
        this.nextToken();
        const elseIf = this.parseIfExpression();
        alternative = new BlockStatement(this.curToken, [new ExpressionStatement(this.curToken, elseIf)]);
      } else {
        if (!this.expectPeek(TokenType.LBRACE)) return null;
        alternative = this.parseBlockStatement();
      }
    }
    return new IfExpression(token, condition, consequence, alternative);
  }
  parseWhileExpression() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.LPAREN)) return null;
    this.nextToken();
    const condition = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.RPAREN)) return null;
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const body = this.parseBlockStatement();
    return new WhileExpression(token, condition, body);
  }
  parseForExpression() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.LPAREN)) return null;
    this.nextToken();
    if (this.curTokenIs(TokenType.IDENT) && this.peekToken.type === TokenType.IDENT && this.peekToken.literal === "in") {
      const varName = this.curToken.literal;
      this.nextToken();
      this.nextToken();
      const iterable = this.parseExpression(Precedence.LOWEST);
      if (!this.expectPeek(TokenType.RPAREN)) return null;
      if (!this.expectPeek(TokenType.LBRACE)) return null;
      const body2 = this.parseBlockStatement();
      return new ForInExpression(token, varName, iterable, body2);
    }
    if (this.curTokenIs(TokenType.LBRACKET)) {
      const names = [];
      if (!this.peekTokenIs(TokenType.RBRACKET)) {
        this.nextToken();
        names.push(this.curToken.literal);
        while (this.peekTokenIs(TokenType.COMMA)) {
          this.nextToken();
          this.nextToken();
          names.push(this.curToken.literal);
        }
      }
      if (!this.expectPeek(TokenType.RBRACKET)) return null;
      this.nextToken();
      if (!(this.curTokenIs(TokenType.IDENT) && this.curToken.literal === "in")) {
        this.errors.push('expected "in" after destructuring pattern');
        return null;
      }
      this.nextToken();
      const iterable = this.parseExpression(Precedence.LOWEST);
      if (!this.expectPeek(TokenType.RPAREN)) return null;
      if (!this.expectPeek(TokenType.LBRACE)) return null;
      const body2 = this.parseBlockStatement();
      const tempVar = "__forin_dest_" + token.literal;
      const destBody = new BlockStatement(token, [
        new DestructuringLet(token, names.map((n) => n === "_" ? null : new Identifier(token, n)), new Identifier(token, tempVar)),
        ...body2.statements
      ]);
      return new ForInExpression(token, tempVar, iterable, destBody);
    }
    let init;
    if (this.curTokenIs(TokenType.LET)) {
      init = this.parseLetStatement();
    } else {
      init = new ExpressionStatement(this.curToken, this.parseExpression(Precedence.LOWEST));
      if (!this.expectPeek(TokenType.SEMICOLON)) return null;
    }
    this.nextToken();
    const condition = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.SEMICOLON)) return null;
    this.nextToken();
    const update = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.RPAREN)) return null;
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const body = this.parseBlockStatement();
    return new ForExpression(token, init, condition, update, body);
  }
  parseFunctionLiteral() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.LPAREN)) return null;
    const { params: parameters, defaults, restParam, paramTypes } = this.parseFunctionParameters();
    let returnType = null;
    if (this.peekTokenIs(TokenType.THIN_ARROW)) {
      this.nextToken();
      this.nextToken();
      returnType = this.curToken.literal;
    }
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const body = this.parseBlockStatement();
    const fn = new FunctionLiteral(token, parameters, body);
    fn.defaults = defaults;
    fn.restParam = restParam;
    fn.paramTypes = paramTypes.some((t) => t !== null) ? paramTypes : null;
    fn.returnType = returnType;
    return fn;
  }
  parseFunctionParameters() {
    const params = [];
    const defaults = [];
    const paramTypes = [];
    let restParam = null;
    if (this.peekTokenIs(TokenType.RPAREN)) {
      this.nextToken();
      return { params, defaults, restParam, paramTypes };
    }
    this.nextToken();
    if (this.curToken.type === TokenType.SPREAD) {
      this.nextToken();
      restParam = new Identifier(this.curToken, this.curToken.literal);
      if (!this.expectPeek(TokenType.RPAREN)) return null;
      return { params, defaults, restParam, paramTypes };
    }
    params.push(new Identifier(this.curToken, this.curToken.literal));
    if (this.peekTokenIs(TokenType.COLON)) {
      this.nextToken();
      this.nextToken();
      paramTypes.push(this.curToken.literal);
    } else {
      paramTypes.push(null);
    }
    if (this.peekTokenIs(TokenType.ASSIGN)) {
      this.nextToken();
      this.nextToken();
      defaults.push(this.parseExpression(Precedence.LOWEST));
    } else {
      defaults.push(null);
    }
    while (this.peekTokenIs(TokenType.COMMA)) {
      this.nextToken();
      this.nextToken();
      if (this.curToken.type === TokenType.SPREAD) {
        this.nextToken();
        restParam = new Identifier(this.curToken, this.curToken.literal);
        break;
      }
      params.push(new Identifier(this.curToken, this.curToken.literal));
      if (this.peekTokenIs(TokenType.COLON)) {
        this.nextToken();
        this.nextToken();
        paramTypes.push(this.curToken.literal);
      } else {
        paramTypes.push(null);
      }
      if (this.peekTokenIs(TokenType.ASSIGN)) {
        this.nextToken();
        this.nextToken();
        defaults.push(this.parseExpression(Precedence.LOWEST));
      } else {
        defaults.push(null);
      }
    }
    if (!this.expectPeek(TokenType.RPAREN)) return null;
    return { params, defaults, restParam, paramTypes };
  }
  parseCallExpression(fn) {
    const token = this.curToken;
    const args = this.parseExpressionList(TokenType.RPAREN);
    return new CallExpression(token, fn, args);
  }
  parseArrayLiteral() {
    const token = this.curToken;
    if (this.peekTokenIs(TokenType.RBRACKET)) {
      this.nextToken();
      return new ArrayLiteral(token, []);
    }
    this.nextToken();
    const first = this._parseExprOrSpread();
    if (!(first instanceof SpreadElement) && this.peekToken.type === TokenType.FOR) {
      this.nextToken();
      this.nextToken();
      if (this.curToken.type !== TokenType.IDENT) {
        this.errors.push(`expected identifier after 'for' in comprehension, got ${this.curToken.type}`);
        return null;
      }
      const variable = this.curToken.literal;
      if (!this.peekToken || this.peekToken.literal !== "in") {
        this.errors.push(`expected 'in' in comprehension`);
        return null;
      }
      this.nextToken();
      this.nextToken();
      const iterable = this.parseExpression(Precedence.LOWEST);
      let condition = null;
      if (this.peekToken.type === TokenType.IF) {
        this.nextToken();
        this.nextToken();
        condition = this.parseExpression(Precedence.LOWEST);
      }
      if (!this.expectPeek(TokenType.RBRACKET)) return null;
      return new ArrayComprehension(token, first, variable, iterable, condition);
    }
    const elements = [first];
    while (this.peekTokenIs(TokenType.COMMA)) {
      this.nextToken();
      this.nextToken();
      elements.push(this._parseExprOrSpread());
    }
    if (!this.expectPeek(TokenType.RBRACKET)) return null;
    return new ArrayLiteral(token, elements);
  }
  parseIndexExpression(left) {
    const token = this.curToken;
    this.nextToken();
    if (this.curTokenIs(TokenType.COLON)) {
      let end = null;
      if (!this.peekTokenIs(TokenType.RBRACKET)) {
        this.nextToken();
        end = this.parseExpression(Precedence.LOWEST);
      }
      if (!this.expectPeek(TokenType.RBRACKET)) return null;
      return new SliceExpression(token, left, null, end);
    }
    const index = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.COLON)) {
      this.nextToken();
      let end = null;
      if (!this.peekTokenIs(TokenType.RBRACKET)) {
        this.nextToken();
        end = this.parseExpression(Precedence.LOWEST);
      }
      if (!this.expectPeek(TokenType.RBRACKET)) return null;
      return new SliceExpression(token, left, index, end);
    }
    if (!this.expectPeek(TokenType.RBRACKET)) return null;
    return new IndexExpression(token, left, index);
  }
  parseMatchExpression() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.LPAREN)) return null;
    this.nextToken();
    const subject = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.RPAREN)) return null;
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const arms = [];
    const TYPE_NAMES = /* @__PURE__ */ new Set(["int", "string", "bool", "array", "hash", "fn", "null", "Ok", "Err"]);
    while (!this.peekTokenIs(TokenType.RBRACE) && !this.peekTokenIs(TokenType.EOF)) {
      this.nextToken();
      let pattern = null;
      if (this.curTokenIs(TokenType.IDENT) && this.curToken.literal === "_") {
        pattern = null;
      } else if ((this.curTokenIs(TokenType.IDENT) || this.curTokenIs(TokenType.FUNCTION)) && TYPE_NAMES.has(this.curToken.literal) && this.peekTokenIs(TokenType.LPAREN)) {
        const typeName = this.curToken.literal;
        this.nextToken();
        this.nextToken();
        const binding = new Identifier(this.curToken, this.curToken.literal);
        if (!this.expectPeek(TokenType.RPAREN)) return null;
        pattern = new TypePattern(typeName, binding);
      } else {
        pattern = this.parseExpression(Precedence.LOWEST);
      }
      if (pattern && this.peekTokenIs(TokenType.BAR)) {
        const patterns = [pattern];
        while (this.peekTokenIs(TokenType.BAR)) {
          this.nextToken();
          this.nextToken();
          patterns.push(this.parseExpression(Precedence.LOWEST));
        }
        pattern = new OrPattern(patterns);
      }
      let guard = null;
      if (this.peekToken.type === TokenType.IDENT && this.peekToken.literal === "when") {
        this.nextToken();
        this.nextToken();
        guard = this.parseExpression(Precedence.LOWEST);
      }
      if (!this.expectPeek(TokenType.ARROW)) return null;
      this.nextToken();
      const value = this.parseExpression(Precedence.LOWEST);
      arms.push({ pattern, value, guard });
      if (this.peekTokenIs(TokenType.COMMA)) this.nextToken();
    }
    if (!this.expectPeek(TokenType.RBRACE)) return null;
    return new MatchExpression(token, subject, arms);
  }
  parseDoWhileExpression() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const body = this.parseBlockStatement();
    if (!this.expectPeek(TokenType.WHILE)) return null;
    if (!this.expectPeek(TokenType.LPAREN)) return null;
    this.nextToken();
    const condition = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.RPAREN)) return null;
    return new DoWhileExpression(token, body, condition);
  }
  parsePostfixExpression(left, op) {
    if (!(left instanceof Identifier)) {
      this.errors.push(`cannot use ${op}${op} on ${left.constructor.name}`);
      return null;
    }
    const token = this.curToken;
    const opType = op === "+" ? TokenType.PLUS : TokenType.MINUS;
    const one = new IntegerLiteral(token, 1);
    const binExpr = new InfixExpression(new Token(opType, op), left, op, one);
    return new AssignExpression(token, left, binExpr);
  }
  parseTernaryExpression(condition) {
    const token = this.curToken;
    this.nextToken();
    const consequence = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.COLON)) return null;
    this.nextToken();
    const alternative = this.parseExpression(Precedence.LOWEST);
    return new TernaryExpression(token, condition, consequence, alternative);
  }
  parseAssignExpression(left) {
    if (left instanceof IndexExpression) {
      const token2 = this.curToken;
      this.nextToken();
      const value2 = this.parseExpression(Precedence.LOWEST);
      return new IndexAssignExpression(token2, left.left, left.index, value2);
    }
    if (!(left instanceof Identifier)) {
      this.errors.push(`cannot assign to ${left.constructor.name}`);
      return null;
    }
    const token = this.curToken;
    this.nextToken();
    const value = this.parseExpression(Precedence.LOWEST);
    return new AssignExpression(token, left, value);
  }
  parseCompoundAssignExpression(left) {
    const token = this.curToken;
    const opMap = {
      [TokenType.PLUS_ASSIGN]: TokenType.PLUS,
      [TokenType.MINUS_ASSIGN]: TokenType.MINUS,
      [TokenType.ASTERISK_ASSIGN]: TokenType.ASTERISK,
      [TokenType.SLASH_ASSIGN]: TokenType.SLASH,
      [TokenType.PERCENT_ASSIGN]: TokenType.PERCENT
    };
    const opToken = new Token(opMap[token.type], token.literal[0]);
    this.nextToken();
    const right = this.parseExpression(Precedence.LOWEST);
    if (left instanceof Identifier) {
      const binExpr = new InfixExpression(opToken, left, opToken.literal, right);
      return new AssignExpression(token, left, binExpr);
    }
    if (left instanceof IndexExpression) {
      const readExpr = new IndexExpression(left.token, left.left, left.index);
      const binExpr = new InfixExpression(opToken, readExpr, opToken.literal, right);
      return new IndexAssignExpression(token, left.left, left.index, binExpr);
    }
    this.errors.push(`cannot compound-assign to ${left.constructor.name}`);
    return null;
  }
  parseHashLiteral() {
    const token = this.curToken;
    const pairs = /* @__PURE__ */ new Map();
    while (!this.peekTokenIs(TokenType.RBRACE)) {
      this.nextToken();
      const key = this.parseExpression(Precedence.LOWEST);
      if (!this.expectPeek(TokenType.COLON)) return null;
      this.nextToken();
      const value = this.parseExpression(Precedence.LOWEST);
      pairs.set(key, value);
      if (!this.peekTokenIs(TokenType.RBRACE) && !this.expectPeek(TokenType.COMMA)) return null;
    }
    if (!this.expectPeek(TokenType.RBRACE)) return null;
    return new HashLiteral(token, pairs);
  }
  parseExpressionList(end) {
    const list = [];
    if (this.peekTokenIs(end)) {
      this.nextToken();
      return list;
    }
    this.nextToken();
    list.push(this._parseExprOrSpread());
    while (this.peekTokenIs(TokenType.COMMA)) {
      this.nextToken();
      this.nextToken();
      list.push(this._parseExprOrSpread());
    }
    if (!this.expectPeek(end)) return null;
    return list;
  }
  _parseExprOrSpread() {
    if (this.curToken.type === TokenType.SPREAD) {
      const token = this.curToken;
      this.nextToken();
      return new SpreadElement(token, this.parseExpression(Precedence.PREFIX));
    }
    return this.parseExpression(Precedence.LOWEST);
  }
};

// src/code.js
var Opcodes = {
  OpConstant: 1,
  // Push constant from pool onto stack
  OpPop: 2,
  // Pop top of stack (expression statement cleanup)
  // Arithmetic
  OpAdd: 3,
  OpSub: 4,
  OpMul: 5,
  OpDiv: 6,
  // Boolean
  OpTrue: 7,
  OpFalse: 8,
  // Comparison
  OpEqual: 9,
  OpNotEqual: 10,
  OpGreaterThan: 11,
  // Less-than rewritten as reversed greater-than by compiler
  // Prefix
  OpMinus: 12,
  OpBang: 13,
  // Jump
  OpJumpNotTruthy: 14,
  // Conditional jump (if-else)
  OpJump: 15,
  // Unconditional jump
  // Null
  OpNull: 16,
  // Bindings
  OpSetGlobal: 17,
  OpGetGlobal: 18,
  OpSetLocal: 19,
  OpGetLocal: 20,
  // Data structures
  OpArray: 21,
  OpHash: 22,
  OpIndex: 23,
  // Strings
  OpConcat: 24,
  // String concatenation (reuses OpAdd but separate for clarity? No — use OpAdd)
  // Functions
  OpCall: 25,
  OpReturnValue: 26,
  OpReturn: 27,
  // Return without value (implicit null)
  OpClosure: 28,
  // Create closure from compiled function
  OpGetFree: 29,
  // Get free variable from closure
  OpCurrentClosure: 30,
  // Push current closure (for recursion)
  // Builtins
  OpGetBuiltin: 31,
  // Constant-operand arithmetic (fused OpConstant + op)
  // Right operand is loaded from constant pool, left from stack
  OpAddConst: 32,
  OpSubConst: 33,
  OpMulConst: 34,
  OpDivConst: 35,
  // Superinstructions: fused OpGetLocal + Op*Const
  // Left operand from local slot, right from constant pool
  OpGetLocalAddConst: 36,
  OpGetLocalSubConst: 37,
  OpGetLocalMulConst: 38,
  OpGetLocalDivConst: 39,
  // Integer-specialized opcodes (skip instanceof checks)
  // Compiler emits these when it can prove both operands are integers
  OpAddInt: 40,
  OpSubInt: 41,
  OpGreaterThanInt: 42,
  OpEqualInt: 43,
  OpNotEqualInt: 44,
  OpLessThanInt: 45,
  // Unlike generic path, this is a direct opcode (no rewrite to GT)
  // Additional integer-specialized opcodes (for adaptive quickening)
  OpMulInt: 46,
  OpDivInt: 47,
  OpMod: 48,
  OpModConst: 49,
  OpModInt: 50,
  OpAnd: 51,
  OpOr: 52,
  OpSetFree: 53,
  // Set free variable in closure
  OpSetIndex: 54,
  // Set element at index: arr[i] = val
  OpSlice: 55,
  // Slice: arr[start:end]
  OpTypeCheck: 56,
  // Type check: local(1) typeConstIdx(2) — validates param type
  OpTypeIs: 57,
  // Type check: pops value, pushes bool (typeConstIdx(2))
  OpResultValue: 58
  // Pop Result, push its inner .value
};
var definitions = {
  [Opcodes.OpConstant]: ["OpConstant", 2],
  [Opcodes.OpPop]: ["OpPop"],
  [Opcodes.OpAdd]: ["OpAdd"],
  [Opcodes.OpSub]: ["OpSub"],
  [Opcodes.OpMul]: ["OpMul"],
  [Opcodes.OpDiv]: ["OpDiv"],
  [Opcodes.OpTrue]: ["OpTrue"],
  [Opcodes.OpFalse]: ["OpFalse"],
  [Opcodes.OpEqual]: ["OpEqual"],
  [Opcodes.OpNotEqual]: ["OpNotEqual"],
  [Opcodes.OpGreaterThan]: ["OpGreaterThan"],
  [Opcodes.OpMinus]: ["OpMinus"],
  [Opcodes.OpBang]: ["OpBang"],
  [Opcodes.OpJumpNotTruthy]: ["OpJumpNotTruthy", 2],
  [Opcodes.OpJump]: ["OpJump", 2],
  [Opcodes.OpNull]: ["OpNull"],
  [Opcodes.OpSetGlobal]: ["OpSetGlobal", 2],
  [Opcodes.OpGetGlobal]: ["OpGetGlobal", 2],
  [Opcodes.OpSetLocal]: ["OpSetLocal", 1],
  [Opcodes.OpGetLocal]: ["OpGetLocal", 1],
  [Opcodes.OpArray]: ["OpArray", 2],
  [Opcodes.OpHash]: ["OpHash", 2],
  [Opcodes.OpIndex]: ["OpIndex"],
  [Opcodes.OpCall]: ["OpCall", 1],
  [Opcodes.OpReturnValue]: ["OpReturnValue"],
  [Opcodes.OpReturn]: ["OpReturn"],
  [Opcodes.OpClosure]: ["OpClosure", 2, 1],
  // constIndex (2), numFree (1)
  [Opcodes.OpGetFree]: ["OpGetFree", 1],
  [Opcodes.OpCurrentClosure]: ["OpCurrentClosure"],
  [Opcodes.OpGetBuiltin]: ["OpGetBuiltin", 1],
  [Opcodes.OpAddConst]: ["OpAddConst", 2],
  [Opcodes.OpSubConst]: ["OpSubConst", 2],
  [Opcodes.OpMulConst]: ["OpMulConst", 2],
  [Opcodes.OpDivConst]: ["OpDivConst", 2],
  [Opcodes.OpGetLocalAddConst]: ["OpGetLocalAddConst", 1, 2],
  [Opcodes.OpGetLocalSubConst]: ["OpGetLocalSubConst", 1, 2],
  [Opcodes.OpGetLocalMulConst]: ["OpGetLocalMulConst", 1, 2],
  [Opcodes.OpGetLocalDivConst]: ["OpGetLocalDivConst", 1, 2],
  [Opcodes.OpAddInt]: ["OpAddInt"],
  [Opcodes.OpSubInt]: ["OpSubInt"],
  [Opcodes.OpGreaterThanInt]: ["OpGreaterThanInt"],
  [Opcodes.OpEqualInt]: ["OpEqualInt"],
  [Opcodes.OpNotEqualInt]: ["OpNotEqualInt"],
  [Opcodes.OpLessThanInt]: ["OpLessThanInt"],
  [Opcodes.OpMulInt]: ["OpMulInt"],
  [Opcodes.OpDivInt]: ["OpDivInt"],
  [Opcodes.OpMod]: ["OpMod"],
  [Opcodes.OpModConst]: ["OpModConst", 2],
  [Opcodes.OpModInt]: ["OpModInt"],
  [Opcodes.OpAnd]: ["OpAnd"],
  [Opcodes.OpOr]: ["OpOr"],
  [Opcodes.OpSetFree]: ["OpSetFree", 1],
  [Opcodes.OpSetIndex]: ["OpSetIndex"],
  [Opcodes.OpSlice]: ["OpSlice"],
  [Opcodes.OpTypeCheck]: ["OpTypeCheck", 1, 2],
  // localSlot (1), typeNameConstIdx (2)
  [Opcodes.OpTypeIs]: ["OpTypeIs", 2],
  // typeNameConstIdx (2) — pops value, pushes bool
  [Opcodes.OpResultValue]: ["OpResultValue"]
  // Pop Result, push its .value
};
function lookup(op) {
  const def = definitions[op];
  if (!def) return void 0;
  return { name: def[0], operandWidths: def.slice(1) };
}
function make(op, ...operands) {
  const def = definitions[op];
  if (!def) return new Uint8Array(0);
  const widths = def.slice(1);
  let len = 1;
  for (const w of widths) len += w;
  const instruction = new Uint8Array(len);
  instruction[0] = op;
  let offset = 1;
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i];
    const val = operands[i] || 0;
    if (w === 2) {
      instruction[offset] = val >> 8 & 255;
      instruction[offset + 1] = val & 255;
    } else if (w === 1) {
      instruction[offset] = val & 255;
    }
    offset += w;
  }
  return instruction;
}
function concatInstructions(...arrays) {
  let len = 0;
  for (const a of arrays) len += a.length;
  const result = new Uint8Array(len);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// src/symbol-table.js
var SCOPE = {
  GLOBAL: "GLOBAL",
  LOCAL: "LOCAL",
  BUILTIN: "BUILTIN",
  FREE: "FREE",
  FUNCTION: "FUNCTION"
};
var Symbol = class {
  constructor(name, scope, index) {
    this.name = name;
    this.scope = scope;
    this.index = index;
  }
};
var SymbolTable = class {
  constructor(outer = null) {
    this.outer = outer;
    this.store = /* @__PURE__ */ new Map();
    this.numDefinitions = 0;
    this.freeSymbols = [];
  }
  define(name, isConst = false) {
    const scope = this.outer === null ? SCOPE.GLOBAL : SCOPE.LOCAL;
    const sym = new Symbol(name, scope, this.numDefinitions);
    sym.isConst = isConst;
    this.store.set(name, sym);
    this.numDefinitions++;
    return sym;
  }
  defineBuiltin(index, name) {
    const sym = new Symbol(name, SCOPE.BUILTIN, index);
    this.store.set(name, sym);
    return sym;
  }
  defineFunctionName(name) {
    const sym = new Symbol(name, SCOPE.FUNCTION, 0);
    this.store.set(name, sym);
    return sym;
  }
  defineFree(original) {
    this.freeSymbols.push(original);
    const sym = new Symbol(original.name, SCOPE.FREE, this.freeSymbols.length - 1);
    this.store.set(original.name, sym);
    return sym;
  }
  resolve(name) {
    let sym = this.store.get(name);
    if (sym) return sym;
    if (this.outer) {
      sym = this.outer.resolve(name);
      if (!sym) return void 0;
      if (sym.scope === SCOPE.GLOBAL || sym.scope === SCOPE.BUILTIN) return sym;
      return this.defineFree(sym);
    }
    return void 0;
  }
};

// src/object.js
var OBJ = {
  INTEGER: "INTEGER",
  FLOAT: "FLOAT",
  BOOLEAN: "BOOLEAN",
  NULL: "NULL",
  STRING: "STRING",
  RETURN: "RETURN",
  ERROR: "ERROR",
  FUNCTION: "FUNCTION",
  ARRAY: "ARRAY",
  HASH: "HASH",
  BUILTIN: "BUILTIN"
};
var MonkeyInteger = class {
  constructor(value) {
    this.value = value;
  }
  type() {
    return OBJ.INTEGER;
  }
  inspect() {
    return String(this.value);
  }
  hashKey() {
    if (this._hk === void 0) this._hk = `int:${this.value}`;
    return this._hk;
  }
  // Fast hash key: use raw value with type tag for Map identity
  // Integers: use number directly (no collision with strings since Map uses SameValueZero)
  fastHashKey() {
    return this.value;
  }
};
var MonkeyFloat = class {
  constructor(value) {
    this.value = value;
  }
  type() {
    return OBJ.FLOAT;
  }
  inspect() {
    return String(this.value);
  }
  hashKey() {
    if (this._hk === void 0) this._hk = `float:${this.value}`;
    return this._hk;
  }
  fastHashKey() {
    return this.value + 0.1;
  }
  // offset to avoid collision with integers
};
var MonkeyBoolean = class {
  constructor(value) {
    this.value = value;
  }
  type() {
    return OBJ.BOOLEAN;
  }
  inspect() {
    return String(this.value);
  }
  hashKey() {
    if (this._hk === void 0) this._hk = `bool:${this.value}`;
    return this._hk;
  }
  fastHashKey() {
    return this;
  }
  // singleton identity
};
var MonkeyNull = class {
  type() {
    return OBJ.NULL;
  }
  inspect() {
    return "null";
  }
};
var MonkeyString = class {
  constructor(value) {
    this.value = value;
  }
  type() {
    return OBJ.STRING;
  }
  inspect() {
    return this.value;
  }
  hashKey() {
    if (this._hk === void 0) this._hk = `str:${this.value}`;
    return this._hk;
  }
  fastHashKey() {
    return `s:${this.value}`;
  }
  // value-based for correct hash lookup
};
var STRING_INTERN = /* @__PURE__ */ new Map();
var STRING_INTERN_MAX = 4096;
function internString(value) {
  let s = STRING_INTERN.get(value);
  if (s !== void 0) return s;
  s = new MonkeyString(value);
  if (STRING_INTERN.size < STRING_INTERN_MAX) {
    STRING_INTERN.set(value, s);
  }
  return s;
}
var MonkeyReturnValue = class {
  constructor(value) {
    this.value = value;
  }
  type() {
    return OBJ.RETURN;
  }
  inspect() {
    return this.value.inspect();
  }
};
var MonkeyError = class {
  constructor(message) {
    this.message = message;
  }
  type() {
    return OBJ.ERROR;
  }
  inspect() {
    return `ERROR: ${this.message}`;
  }
};
var MonkeyFunction2 = class {
  constructor(parameters, body, env) {
    this.parameters = parameters;
    this.body = body;
    this.env = env;
  }
  type() {
    return OBJ.FUNCTION;
  }
  inspect() {
    return `fn(${this.parameters.join(", ")}) {
${this.body}
}`;
  }
};
var MonkeyArray = class {
  constructor(elements) {
    this.elements = elements;
  }
  type() {
    return OBJ.ARRAY;
  }
  inspect() {
    return `[${this.elements.map((e) => e.inspect()).join(", ")}]`;
  }
};
var MonkeyHash = class {
  constructor(pairs) {
    this.pairs = pairs;
  }
  // Map<fastHashKey, {key, value}>
  type() {
    return OBJ.HASH;
  }
  inspect() {
    const entries = [];
    for (const [, { key, value }] of this.pairs) {
      entries.push(`${key.inspect()}: ${value.inspect()}`);
    }
    return `{${entries.join(", ")}}`;
  }
};
var MonkeyBuiltin = class {
  constructor(fn) {
    this.fn = fn;
  }
  type() {
    return OBJ.BUILTIN;
  }
  inspect() {
    return "builtin function";
  }
};
var Environment = class {
  constructor(outer = null) {
    this.store = /* @__PURE__ */ new Map();
    this.consts = /* @__PURE__ */ new Set();
    this.outer = outer;
  }
  get(name) {
    const val = this.store.get(name);
    if (val !== void 0) return val;
    if (this.outer) return this.outer.get(name);
    return void 0;
  }
  isConst(name) {
    if (this.consts.has(name)) return true;
    if (this.store.has(name)) return false;
    if (this.outer) return this.outer.isConst(name);
    return false;
  }
  set(name, val, isConst = false) {
    if (this.isConst(name)) return new MonkeyError(`cannot assign to const variable: ${name}`);
    this.store.set(name, val);
    if (isConst) this.consts.add(name);
    return val;
  }
};
var TRUE = new MonkeyBoolean(true);
var FALSE = new MonkeyBoolean(false);
var NULL = new MonkeyNull();
var INT_CACHE_MIN = -1;
var INT_CACHE_MAX = 256;
var INT_CACHE = new Array(INT_CACHE_MAX - INT_CACHE_MIN + 1);
for (let i = INT_CACHE_MIN; i <= INT_CACHE_MAX; i++) {
  INT_CACHE[i - INT_CACHE_MIN] = new MonkeyInteger(i);
}
function cachedInteger(value) {
  if (value >= INT_CACHE_MIN && value <= INT_CACHE_MAX && (value | 0) === value) {
    return INT_CACHE[value - INT_CACHE_MIN];
  }
  return new MonkeyInteger(value);
}
var MonkeyBreak = class {
  constructor() {
  }
  type() {
    return "BREAK";
  }
  inspect() {
    return "break";
  }
};
var MonkeyContinue = class {
  constructor() {
  }
  type() {
    return "CONTINUE";
  }
  inspect() {
    return "continue";
  }
};
var MonkeyResult = class {
  constructor(isOk, value) {
    this.isOk = isOk;
    this.value = value;
  }
  type() {
    return "RESULT";
  }
  inspect() {
    return this.isOk ? `Ok(${this.value.inspect()})` : `Err(${this.value.inspect()})`;
  }
  fastHashKey() {
    return `result:${this.isOk}:${this.value.inspect()}`;
  }
};
var MonkeyEnum = class {
  constructor(enumName, variant, ordinal) {
    this.enumName = enumName;
    this.variant = variant;
    this.ordinal = ordinal;
  }
  type() {
    return "ENUM";
  }
  inspect() {
    return `${this.enumName}.${this.variant}`;
  }
  hashKey() {
    return `enum:${this.enumName}:${this.variant}`;
  }
  fastHashKey() {
    return `enum:${this.enumName}:${this.variant}`;
  }
};

// src/modules.js
function mkInt(v) {
  return new MonkeyInteger(v);
}
function mkStr(v) {
  return new MonkeyString(v);
}
function buildModule(entries) {
  const hash = new MonkeyHash(/* @__PURE__ */ new Map());
  for (const [name, value] of Object.entries(entries)) {
    const key = new MonkeyString(name);
    hash.pairs.set(key.fastHashKey ? key.fastHashKey() : key.hashKey(), { key, value });
  }
  return hash;
}
var mathModule = () => buildModule({
  PI: mkInt(3),
  // We only have integers... let's use a float approximation via string
  E: mkInt(2),
  abs: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkInt(Math.abs(args[0].value));
  }),
  pow: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return mkInt(Math.pow(args[0].value, args[1].value));
  }),
  sqrt: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkInt(Math.floor(Math.sqrt(args[0].value)));
  }),
  min: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return mkInt(Math.min(args[0].value, args[1].value));
  }),
  max: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return mkInt(Math.max(args[0].value, args[1].value));
  }),
  floor: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkInt(Math.floor(args[0].value));
  }),
  ceil: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkInt(Math.ceil(args[0].value));
  })
});
var stringModule = () => buildModule({
  upper: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkStr(args[0].value.toUpperCase());
  }),
  lower: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkStr(args[0].value.toLowerCase());
  }),
  trim: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return mkStr(args[0].value.trim());
  }),
  split: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return new MonkeyArray(args[0].value.split(args[1].value).map((s) => mkStr(s)));
  }),
  join: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return mkStr(args[0].elements.map((e) => e.value).join(args[1].value));
  }),
  repeat: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return mkStr(args[0].value.repeat(args[1].value));
  }),
  contains: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    return new MonkeyBoolean(args[0].value.includes(args[1].value));
  }),
  replace: new MonkeyBuiltin((...args) => {
    if (args.length !== 3) return new MonkeyNull();
    return mkStr(args[0].value.split(args[1].value).join(args[2].value));
  }),
  charAt: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    const ch = args[0].value[args[1].value];
    return ch !== void 0 ? mkStr(ch) : new MonkeyNull();
  })
});
var functionalModule = () => buildModule({
  identity: new MonkeyBuiltin((...args) => args[0] || new MonkeyNull()),
  constant: new MonkeyBuiltin((...args) => {
    const val = args[0] || new MonkeyNull();
    return new MonkeyBuiltin(() => val);
  })
});
var mathModuleEnhanced = () => {
  const base = mathModule();
  const extras = {
    sign: new MonkeyBuiltin((...args) => {
      if (args.length !== 1) return new MonkeyNull();
      const v = args[0].value;
      return mkInt(v > 0 ? 1 : v < 0 ? -1 : 0);
    }),
    clamp: new MonkeyBuiltin((...args) => {
      if (args.length !== 3) return new MonkeyNull();
      const [val, lo, hi] = args.map((a) => a.value);
      return mkInt(Math.max(lo, Math.min(hi, val)));
    })
  };
  for (const [name, value] of Object.entries(extras)) {
    const key = new MonkeyString(name);
    base.pairs.set(key.fastHashKey ? key.fastHashKey() : key.hashKey(), { key, value });
  }
  return base;
};
var stringModuleEnhanced = () => {
  const base = stringModule();
  const extras = {
    padLeft: new MonkeyBuiltin((...args) => {
      if (args.length !== 3) return new MonkeyNull();
      return mkStr(args[0].value.padStart(args[1].value, args[2].value));
    }),
    padRight: new MonkeyBuiltin((...args) => {
      if (args.length !== 3) return new MonkeyNull();
      return mkStr(args[0].value.padEnd(args[1].value, args[2].value));
    }),
    reverse: new MonkeyBuiltin((...args) => {
      if (args.length !== 1) return new MonkeyNull();
      return mkStr([...args[0].value].reverse().join(""));
    }),
    length: new MonkeyBuiltin((...args) => {
      if (args.length !== 1) return new MonkeyNull();
      return mkInt(args[0].value.length);
    })
  };
  for (const [name, value] of Object.entries(extras)) {
    const key = new MonkeyString(name);
    base.pairs.set(key.fastHashKey ? key.fastHashKey() : key.hashKey(), { key, value });
  }
  return base;
};
var algorithmsModule = () => buildModule({
  gcd: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    let [a, b] = args.map((x) => Math.abs(x.value));
    while (b) {
      [a, b] = [b, a % b];
    }
    return mkInt(a);
  }),
  lcm: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    let [a, b] = args.map((x) => Math.abs(x.value));
    let [a0, b0] = [a, b];
    while (b) {
      [a, b] = [b, a % b];
    }
    return mkInt(a0 / a * b0);
  }),
  isPrime: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    const n = args[0].value;
    if (n < 2) return new MonkeyBoolean(false);
    if (n < 4) return new MonkeyBoolean(true);
    if (n % 2 === 0 || n % 3 === 0) return new MonkeyBoolean(false);
    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return new MonkeyBoolean(false);
    }
    return new MonkeyBoolean(true);
  }),
  factorial: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    let n = args[0].value;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return mkInt(result);
  }),
  fibonacci: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    const n = args[0].value;
    if (n <= 0) return mkInt(0);
    if (n === 1) return mkInt(1);
    let [a, b] = [0, 1];
    for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
    return mkInt(b);
  })
});
var arrayModule = () => buildModule({
  zip: new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyNull();
    const a = args[0].elements, b = args[1].elements;
    const len = Math.min(a.length, b.length);
    const result = [];
    for (let i = 0; i < len; i++) {
      result.push(new MonkeyArray([a[i], b[i]]));
    }
    return new MonkeyArray(result);
  }),
  enumerate: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return new MonkeyArray(args[0].elements.map((el, i) => new MonkeyArray([mkInt(i), el])));
  }),
  flatten: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    const result = [];
    for (const el of args[0].elements) {
      if (el instanceof MonkeyArray) result.push(...el.elements);
      else result.push(el);
    }
    return new MonkeyArray(result);
  }),
  unique: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const el of args[0].elements) {
      const key = el.inspect();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(el);
      }
    }
    return new MonkeyArray(result);
  }),
  reversed: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    return new MonkeyArray([...args[0].elements].reverse());
  }),
  sum: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    let total = 0;
    for (const el of args[0].elements) total += el.value;
    return mkInt(total);
  }),
  product: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    let total = 1;
    for (const el of args[0].elements) total *= el.value;
    return mkInt(total);
  })
});
function jsToMonkey(val) {
  if (val === null || val === void 0) return new MonkeyNull();
  if (typeof val === "number") return mkInt(Math.floor(val));
  if (typeof val === "string") return mkStr(val);
  if (typeof val === "boolean") return new MonkeyBoolean(val);
  if (Array.isArray(val)) return new MonkeyArray(val.map(jsToMonkey));
  if (typeof val === "object") {
    const pairs = /* @__PURE__ */ new Map();
    for (const [k, v] of Object.entries(val)) {
      const key = new MonkeyString(k);
      pairs.set(key.fastHashKey ? key.fastHashKey() : key.hashKey(), { key, value: jsToMonkey(v) });
    }
    return new MonkeyHash(pairs);
  }
  return new MonkeyNull();
}
function monkeyToJs(obj) {
  if (obj instanceof MonkeyInteger) return obj.value;
  if (obj instanceof MonkeyString) return obj.value;
  if (obj instanceof MonkeyBoolean) return obj.value;
  if (obj instanceof MonkeyNull) return null;
  if (obj instanceof MonkeyArray) return obj.elements.map(monkeyToJs);
  if (obj instanceof MonkeyHash) {
    const result = {};
    for (const [, pair] of obj.pairs) {
      result[pair.key.value] = monkeyToJs(pair.value);
    }
    return result;
  }
  return null;
}
var jsonModule = () => buildModule({
  parse: new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyNull();
    try {
      const parsed = JSON.parse(args[0].value);
      return jsToMonkey(parsed);
    } catch (e) {
      return new MonkeyNull();
    }
  }),
  stringify: new MonkeyBuiltin((...args) => {
    if (args.length < 1) return new MonkeyNull();
    const indent = args.length > 1 ? args[1].value : 0;
    try {
      return mkStr(JSON.stringify(monkeyToJs(args[0]), null, indent || void 0));
    } catch (e) {
      return new MonkeyNull();
    }
  })
});
var sysModule = () => buildModule({
  time: new MonkeyBuiltin((...args) => {
    return mkInt(Date.now());
  }),
  random: new MonkeyBuiltin((...args) => {
    if (args.length === 0) return mkInt(Math.floor(Math.random() * 2147483647));
    if (args.length === 1) return mkInt(Math.floor(Math.random() * args[0].value));
    if (args.length === 2) {
      const [lo, hi] = [args[0].value, args[1].value];
      return mkInt(lo + Math.floor(Math.random() * (hi - lo)));
    }
    return new MonkeyNull();
  }),
  version: mkStr("0.2.0")
});
var MODULE_REGISTRY = {
  math: mathModuleEnhanced,
  string: stringModuleEnhanced,
  functional: functionalModule,
  algorithms: algorithmsModule,
  array: arrayModule,
  json: jsonModule,
  sys: sysModule
};
function getModule(name) {
  const factory = MODULE_REGISTRY[name];
  if (!factory) return null;
  return factory();
}

// src/compiler.js
var _cfId = 0;
var CompiledFunction = class {
  constructor(instructions, numLocals = 0, numParameters = 0, hasRestParam = false) {
    this.id = _cfId++;
    this.instructions = instructions;
    this.numLocals = numLocals;
    this.numParameters = numParameters;
    this.hasRestParam = hasRestParam;
    this.numParameters = numParameters;
  }
  type() {
    return "COMPILED_FUNCTION";
  }
  inspect() {
    return `CompiledFunction[${this.instructions.length}]`;
  }
};
var Bytecode = class {
  constructor(instructions, constants) {
    this.instructions = instructions;
    this.constants = constants;
  }
};
var EmittedInstruction = class {
  constructor(opcode, position) {
    this.opcode = opcode;
    this.position = position;
  }
};
var CompilationScope = class {
  constructor() {
    this.instructions = new Uint8Array(0);
    this.lastInstruction = new EmittedInstruction(void 0, 0);
    this.previousInstruction = new EmittedInstruction(void 0, 0);
    this.intStackDepth = 0;
  }
};
var BUILTINS = ["len", "puts", "first", "last", "rest", "push", "split", "join", "trim", "str_contains", "substr", "replace", "int", "str", "type", "upper", "lower", "indexOf", "startsWith", "endsWith", "char", "ord", "keys", "values", "abs", "sort", "reverse", "contains", "sum", "max", "min", "range", "flat", "zip", "enumerate", "Ok", "Err", "is_ok", "is_err", "unwrap", "unwrap_or"];
var Compiler = class _Compiler {
  constructor(symbolTable = null, constants = null) {
    this.constants = constants || [];
    this.symbolTable = symbolTable || new SymbolTable();
    this.scopes = [new CompilationScope()];
    this.scopeIndex = 0;
    this.loopStack = [];
    this.importedModules = /* @__PURE__ */ new Set();
    if (!symbolTable) {
      for (let i = 0; i < BUILTINS.length; i++) {
        this.symbolTable.defineBuiltin(i, BUILTINS[i]);
      }
    }
  }
  /** Create a new compiler that reuses state from a previous one (for REPL) */
  static withState(symbolTable, constants) {
    return new _Compiler(symbolTable, constants);
  }
  currentScope() {
    return this.scopes[this.scopeIndex];
  }
  currentInstructions() {
    return this.currentScope().instructions;
  }
  /**
   * Constant folding: try to evaluate an expression at compile time.
   * Returns a MonkeyInteger/MonkeyString if fully constant, null otherwise.
   */
  tryFoldConstant(node) {
    if (node instanceof IntegerLiteral) {
      return new MonkeyInteger(node.value);
    }
    if (node instanceof FloatLiteral) {
      return new MonkeyFloat(node.value);
    }
    if (node instanceof PrefixExpression && node.operator === "-") {
      const right = this.tryFoldConstant(node.right);
      if (right instanceof MonkeyInteger) {
        return new MonkeyInteger(-right.value);
      }
    }
    if (node instanceof InfixExpression) {
      const left = this.tryFoldConstant(node.left);
      const right = this.tryFoldConstant(node.right);
      if (left instanceof MonkeyInteger && right instanceof MonkeyInteger) {
        switch (node.operator) {
          case "+":
            return new MonkeyInteger(left.value + right.value);
          case "-":
            return new MonkeyInteger(left.value - right.value);
          case "*":
            return new MonkeyInteger(left.value * right.value);
          case "/":
            return right.value !== 0 ? new MonkeyInteger(Math.trunc(left.value / right.value)) : null;
          case "%":
            return right.value !== 0 ? new MonkeyInteger(left.value % right.value) : null;
        }
      }
      if (left instanceof MonkeyString && right instanceof MonkeyString && node.operator === "+") {
        return internString(left.value + right.value);
      }
    }
    if (node instanceof StringLiteral) {
      return internString(node.value);
    }
    return null;
  }
  compile(node) {
    if (node instanceof Program) {
      for (const stmt of node.statements) {
        const err = this.compile(stmt);
        if (err) return err;
      }
    } else if (node instanceof ExpressionStatement) {
      const err = this.compile(node.expression);
      if (err) return err;
      this.consumeIntStack(1);
      this.emit(Opcodes.OpPop);
    } else if (node instanceof BlockStatement) {
      for (const stmt of node.statements) {
        const err = this.compile(stmt);
        if (err) return err;
      }
    } else if (node instanceof LetStatement) {
      const sym = this.symbolTable.define(node.name.value, node.isConst);
      if (node.value instanceof FunctionLiteral) {
        node.value.name = node.name.value;
      }
      const err = this.compile(node.value);
      if (err) return err;
      const op = sym.scope === SCOPE.GLOBAL ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal;
      this.emit(op, sym.index);
    } else if (node instanceof DestructuringLet) {
      const err2 = this.compile(node.value);
      if (err2) return err2;
      const tempSym = this.symbolTable.define("__destruct_" + this.currentInstructions().length);
      this.emit(tempSym.scope === SCOPE.GLOBAL ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, tempSym.index);
      for (let i = 0; i < node.names.length; i++) {
        if (node.names[i] === null) continue;
        this.loadSymbol(tempSym);
        const idxConst = this.addConstant(new MonkeyInteger(i));
        this.emit(Opcodes.OpConstant, idxConst);
        this.emit(Opcodes.OpIndex);
        const dsym = this.symbolTable.define(node.names[i].value);
        this.emit(dsym.scope === SCOPE.GLOBAL ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, dsym.index);
      }
    } else if (node instanceof HashDestructuringLet) {
      const err2 = this.compile(node.value);
      if (err2) return err2;
      const tempSym = this.symbolTable.define("__hdestruct_" + this.currentInstructions().length);
      this.emit(tempSym.scope === SCOPE.GLOBAL ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, tempSym.index);
      for (const name of node.names) {
        this.loadSymbol(tempSym);
        const keyConst = this.addConstant(internString(name.value));
        this.emit(Opcodes.OpConstant, keyConst);
        this.emit(Opcodes.OpIndex);
        const dsym = this.symbolTable.define(name.value);
        this.emit(dsym.scope === SCOPE.GLOBAL ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, dsym.index);
      }
    } else if (node instanceof ReturnStatement) {
      const err = this.compile(node.returnValue);
      if (err) return err;
      this.emit(Opcodes.OpReturnValue);
    } else if (node instanceof ImportStatement) {
      const mod = getModule(node.moduleName);
      if (!mod) return `unknown module: ${node.moduleName}`;
      const constIdx = this.addConstant(mod);
      if (node.bindings) {
        for (const name of node.bindings) {
          this.emit(Opcodes.OpConstant, constIdx);
          const keyIdx = this.addConstant(new MonkeyString(name));
          this.emit(Opcodes.OpConstant, keyIdx);
          this.emit(Opcodes.OpIndex);
          const sym = this.symbolTable.define(name);
          if (sym.scope === SCOPE.GLOBAL) {
            this.emit(Opcodes.OpSetGlobal, sym.index);
          } else {
            this.emit(Opcodes.OpSetLocal, sym.index);
          }
        }
      } else {
        this.emit(Opcodes.OpConstant, constIdx);
        const bindName = node.alias || node.moduleName;
        const sym = this.symbolTable.define(bindName);
        this.importedModules.add(bindName);
        if (sym.scope === SCOPE.GLOBAL) {
          this.emit(Opcodes.OpSetGlobal, sym.index);
        } else {
          this.emit(Opcodes.OpSetLocal, sym.index);
        }
      }
    } else if (node instanceof EnumStatement) {
      const pairs = /* @__PURE__ */ new Map();
      for (let i = 0; i < node.variants.length; i++) {
        const key = new MonkeyString(node.variants[i]);
        const value = new MonkeyEnum(node.name, node.variants[i], i);
        pairs.set(key.fastHashKey ? key.fastHashKey() : key.hashKey(), { key, value });
      }
      const enumHash = new MonkeyHash(pairs);
      const constIdx = this.addConstant(enumHash);
      this.emit(Opcodes.OpConstant, constIdx);
      const sym = this.symbolTable.define(node.name);
      this.importedModules.add(node.name);
      if (sym.scope === SCOPE.GLOBAL) {
        this.emit(Opcodes.OpSetGlobal, sym.index);
      } else {
        this.emit(Opcodes.OpSetLocal, sym.index);
      }
    } else if (node instanceof InfixExpression) {
      if (["+", "-", "*", "/"].includes(node.operator)) {
        const folded = this.tryFoldConstant(node);
        if (folded) {
          const idx = this.addConstant(folded);
          if (folded instanceof MonkeyInteger) {
            this.emitInt(Opcodes.OpConstant, idx);
          } else {
            this.emit(Opcodes.OpConstant, idx);
          }
          return null;
        }
      }
      if (["==", "!=", ">", "<", "<=", ">="].includes(node.operator)) {
        const left = this.tryFoldConstant(node.left);
        const right = this.tryFoldConstant(node.right);
        if (left instanceof MonkeyInteger && right instanceof MonkeyInteger) {
          let result;
          switch (node.operator) {
            case "==":
              result = left.value === right.value;
              break;
            case "!=":
              result = left.value !== right.value;
              break;
            case ">":
              result = left.value > right.value;
              break;
            case "<":
              result = left.value < right.value;
              break;
            case "<=":
              result = left.value <= right.value;
              break;
            case ">=":
              result = left.value >= right.value;
              break;
          }
          this.emit(result ? Opcodes.OpTrue : Opcodes.OpFalse);
          return null;
        }
      }
      if (node.operator === "<") {
        if (this.isIntegerProducing(node.left) && this.isIntegerProducing(node.right)) {
          let err2 = this.compile(node.left);
          if (err2) return err2;
          err2 = this.compile(node.right);
          if (err2) return err2;
          this.consumeIntStack(2);
          this.emit(Opcodes.OpLessThanInt);
        } else {
          let err2 = this.compile(node.right);
          if (err2) return err2;
          err2 = this.compile(node.left);
          if (err2) return err2;
          this.emitCompareOrSpecialized(Opcodes.OpGreaterThan, Opcodes.OpGreaterThanInt);
        }
        return null;
      }
      if (node.operator === "<=") {
        let err2 = this.compile(node.left);
        if (err2) return err2;
        err2 = this.compile(node.right);
        if (err2) return err2;
        this.emitCompareOrSpecialized(Opcodes.OpGreaterThan, Opcodes.OpGreaterThanInt);
        this.emit(Opcodes.OpBang);
        return null;
      }
      if (node.operator === ">=") {
        let err2 = this.compile(node.right);
        if (err2) return err2;
        err2 = this.compile(node.left);
        if (err2) return err2;
        this.emitCompareOrSpecialized(Opcodes.OpGreaterThan, Opcodes.OpGreaterThanInt);
        this.emit(Opcodes.OpBang);
        return null;
      }
      if (node.operator === "&&") {
        let err2 = this.compile(node.left);
        if (err2) return err2;
        const jumpFalsyPos = this.emit(Opcodes.OpJumpNotTruthy, 65535);
        err2 = this.compile(node.right);
        if (err2) return err2;
        const jumpEndPos = this.emit(Opcodes.OpJump, 65535);
        this.changeOperand(jumpFalsyPos, this.currentInstructions().length);
        this.resetPeepholeState();
        this.emit(Opcodes.OpFalse);
        this.changeOperand(jumpEndPos, this.currentInstructions().length);
        this.resetPeepholeState();
        return null;
      }
      if (node.operator === "||") {
        let err2 = this.compile(node.left);
        if (err2) return err2;
        const jumpFalsyPos = this.emit(Opcodes.OpJumpNotTruthy, 65535);
        this.emit(Opcodes.OpTrue);
        const jumpEndPos = this.emit(Opcodes.OpJump, 65535);
        this.changeOperand(jumpFalsyPos, this.currentInstructions().length);
        err2 = this.compile(node.right);
        if (err2) return err2;
        this.changeOperand(jumpEndPos, this.currentInstructions().length);
        this.resetPeepholeState();
        return null;
      }
      if (node.operator === "??") {
        let err2 = this.compile(node.left);
        if (err2) return err2;
        const sym = this.symbolTable.define("__nullish_" + this.currentInstructions().length);
        this.emit(sym.scope === "GLOBAL" ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, sym.index);
        this.loadSymbol(sym);
        this.emit(Opcodes.OpNull);
        this.emit(Opcodes.OpEqual);
        const jumpNotNullPos = this.emit(Opcodes.OpJumpNotTruthy, 65535);
        err2 = this.compile(node.right);
        if (err2) return err2;
        const jumpEndPos2 = this.emit(Opcodes.OpJump, 65535);
        this.changeOperand(jumpNotNullPos, this.currentInstructions().length);
        this.resetPeepholeState();
        this.loadSymbol(sym);
        this.changeOperand(jumpEndPos2, this.currentInstructions().length);
        this.resetPeepholeState();
        return null;
      }
      let err = this.compile(node.left);
      if (err) return err;
      err = this.compile(node.right);
      if (err) return err;
      switch (node.operator) {
        case "+":
          this.emitArithOrConst(Opcodes.OpAdd, Opcodes.OpAddConst, Opcodes.OpAddInt);
          break;
        case "-":
          this.emitArithOrConst(Opcodes.OpSub, Opcodes.OpSubConst, Opcodes.OpSubInt);
          break;
        case "*":
          this.emitArithOrConst(Opcodes.OpMul, Opcodes.OpMulConst, null);
          break;
        case "/":
          this.emitArithOrConst(Opcodes.OpDiv, Opcodes.OpDivConst, null);
          break;
        case "%":
          this.emitArithOrConst(Opcodes.OpMod, Opcodes.OpModConst, null);
          break;
        case "==":
          this.emitCompareOrSpecialized(Opcodes.OpEqual, Opcodes.OpEqualInt);
          break;
        case "!=":
          this.emitCompareOrSpecialized(Opcodes.OpNotEqual, Opcodes.OpNotEqualInt);
          break;
        case ">":
          this.emitCompareOrSpecialized(Opcodes.OpGreaterThan, Opcodes.OpGreaterThanInt);
          break;
        default:
          return `unknown operator: ${node.operator}`;
      }
    } else if (node instanceof PrefixExpression) {
      if (node.operator === "-") {
        const folded = this.tryFoldConstant(node);
        if (folded) {
          const idx = this.addConstant(folded);
          this.emit(Opcodes.OpConstant, idx);
          return null;
        }
      }
      const err = this.compile(node.right);
      if (err) return err;
      switch (node.operator) {
        case "-":
          if (this.topNAreInt(1)) {
            this.consumeIntStack(1);
            this.emitInt(Opcodes.OpMinus);
          } else {
            this.emit(Opcodes.OpMinus);
          }
          break;
        case "!":
          this.consumeIntStack(1);
          this.emit(Opcodes.OpBang);
          break;
        default:
          return `unknown prefix operator: ${node.operator}`;
      }
    } else if (node instanceof IntegerLiteral) {
      const idx = this.addConstant(new MonkeyInteger(node.value));
      this.emitInt(Opcodes.OpConstant, idx);
    } else if (node instanceof FloatLiteral) {
      const idx = this.addConstant(new MonkeyFloat(node.value));
      this.emit(Opcodes.OpConstant, idx);
    } else if (node instanceof StringLiteral) {
      const idx = this.addConstant(internString(node.value));
      this.emit(Opcodes.OpConstant, idx);
    } else if (node instanceof NullLiteral) {
      this.emit(Opcodes.OpNull);
    } else if (node instanceof TernaryExpression) {
      let err = this.compile(node.condition);
      if (err) return err;
      const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
      err = this.compile(node.consequence);
      if (err) return err;
      const jumpPos = this.emit(Opcodes.OpJump, 9999);
      this.changeOperand(jumpNotTruthyPos, this.currentInstructions().length);
      this.resetPeepholeState();
      err = this.compile(node.alternative);
      if (err) return err;
      this.changeOperand(jumpPos, this.currentInstructions().length);
      this.resetPeepholeState();
    } else if (node instanceof MatchExpression) {
      return this.compileMatchExpression(node);
    } else if (node instanceof RangeExpression) {
      const rangeIdx = BUILTINS.indexOf("range");
      this.emit(Opcodes.OpGetBuiltin, rangeIdx);
      let err = this.compile(node.start);
      if (err) return err;
      err = this.compile(node.end);
      if (err) return err;
      this.emit(Opcodes.OpCall, 2);
    } else if (node instanceof TemplateLiteral) {
      return this.compileTemplateLiteral(node);
    } else if (node instanceof BooleanLiteral) {
      this.emit(node.value ? Opcodes.OpTrue : Opcodes.OpFalse);
    } else if (node instanceof IfExpression) {
      return this.compileIfExpression(node);
    } else if (node instanceof WhileExpression) {
      return this.compileWhileExpression(node);
    } else if (node instanceof DoWhileExpression) {
      return this.compileDoWhileExpression(node);
    } else if (node instanceof ForExpression) {
      return this.compileForExpression(node);
    } else if (node instanceof ForInExpression) {
      return this.compileForInExpression(node);
    } else if (node instanceof AssignExpression) {
      const sym = this.symbolTable.resolve(node.name.value);
      if (!sym) return `undefined variable: ${node.name.value}`;
      if (sym.isConst) return `cannot assign to const variable: ${node.name.value}`;
      const err = this.compile(node.value);
      if (err) return err;
      if (sym.scope === "GLOBAL") {
        this.emit(Opcodes.OpSetGlobal, sym.index);
        this.emit(Opcodes.OpGetGlobal, sym.index);
      } else if (sym.scope === "LOCAL") {
        this.emit(Opcodes.OpSetLocal, sym.index);
        this.emit(Opcodes.OpGetLocal, sym.index);
      } else if (sym.scope === "FREE") {
        this.emit(Opcodes.OpSetFree, sym.index);
        this.emit(Opcodes.OpGetFree, sym.index);
      } else {
        return `cannot assign to ${sym.scope} variable: ${node.name.value}`;
      }
    } else if (node instanceof IndexAssignExpression) {
      let err = this.compile(node.left);
      if (err) return err;
      err = this.compile(node.index);
      if (err) return err;
      err = this.compile(node.value);
      if (err) return err;
      this.emit(Opcodes.OpSetIndex);
    } else if (node instanceof SliceExpression) {
      let err = this.compile(node.left);
      if (err) return err;
      if (node.start) {
        err = this.compile(node.start);
        if (err) return err;
      } else {
        this.emit(Opcodes.OpNull);
      }
      if (node.end) {
        err = this.compile(node.end);
        if (err) return err;
      } else {
        this.emit(Opcodes.OpNull);
      }
      this.emit(Opcodes.OpSlice);
    } else if (node instanceof BreakStatement) {
      if (this.loopStack.length === 0) return "break outside of loop";
      this.emit(Opcodes.OpNull);
      const breakPos = this.emit(Opcodes.OpJump, 65535);
      this.loopStack[this.loopStack.length - 1].breakPatches.push(breakPos);
    } else if (node instanceof ContinueStatement) {
      if (this.loopStack.length === 0) return "continue outside of loop";
      const loopCtx = this.loopStack[this.loopStack.length - 1];
      if (loopCtx.continueTarget >= 0) {
        this.emit(Opcodes.OpJump, loopCtx.continueTarget);
      } else {
        const contPos = this.emit(Opcodes.OpJump, 65535);
        loopCtx.continuePatches.push(contPos);
      }
    } else if (node instanceof Identifier) {
      const sym = this.symbolTable.resolve(node.value);
      if (!sym) return `undefined variable: ${node.value}`;
      this.loadSymbol(sym);
    } else if (node instanceof ArrayComprehension) {
      const tok = node.token;
      const resultName = "__comp_r";
      const resultIdent = new Identifier(tok, resultName);
      const letResult = new LetStatement(tok, new Identifier(tok, resultName), new ArrayLiteral(tok, []), false);
      const pushCall = new CallExpression(tok, new Identifier(tok, "push"), [resultIdent, node.body]);
      const assignResult = new AssignExpression(tok, new Identifier(tok, resultName), pushCall);
      let loopBody;
      if (node.condition) {
        const ifExpr = new IfExpression(
          tok,
          node.condition,
          new BlockStatement(tok, [new ExpressionStatement(tok, assignResult)]),
          null
        );
        loopBody = new BlockStatement(tok, [new ExpressionStatement(tok, ifExpr)]);
      } else {
        loopBody = new BlockStatement(tok, [new ExpressionStatement(tok, assignResult)]);
      }
      const forIn = new ForInExpression(tok, node.variable, node.iterable, loopBody);
      const fnBody = new BlockStatement(tok, [
        letResult,
        new ExpressionStatement(tok, forIn),
        new ExpressionStatement(tok, resultIdent)
      ]);
      const fn = new FunctionLiteral(tok, [], fnBody);
      const call = new CallExpression(tok, fn, []);
      return this.compile(call);
    } else if (node instanceof ArrayLiteral) {
      const hasSpread = node.elements.some((el) => el instanceof SpreadElement);
      if (!hasSpread) {
        for (const el of node.elements) {
          const err = this.compile(el);
          if (err) return err;
        }
        this.emit(Opcodes.OpArray, node.elements.length);
      } else {
        let segments = 0;
        let currentSegmentSize = 0;
        for (const el of node.elements) {
          if (el instanceof SpreadElement) {
            if (currentSegmentSize > 0) {
              this.emit(Opcodes.OpArray, currentSegmentSize);
              segments++;
              currentSegmentSize = 0;
            }
            const err = this.compile(el.expression);
            if (err) return err;
            segments++;
          } else {
            const err = this.compile(el);
            if (err) return err;
            currentSegmentSize++;
          }
        }
        if (currentSegmentSize > 0) {
          this.emit(Opcodes.OpArray, currentSegmentSize);
          segments++;
        }
        if (segments === 0) {
          this.emit(Opcodes.OpArray, 0);
        } else {
          for (let i = 1; i < segments; i++) {
            this.emit(Opcodes.OpAdd);
          }
        }
      }
    } else if (node instanceof HashLiteral) {
      const pairs = [...node.pairs.entries()];
      pairs.sort((a, b) => a[0].toString().localeCompare(b[0].toString()));
      for (const [key, value] of pairs) {
        let err = this.compile(key);
        if (err) return err;
        err = this.compile(value);
        if (err) return err;
      }
      this.emit(Opcodes.OpHash, pairs.length * 2);
    } else if (node instanceof IndexExpression) {
      let err = this.compile(node.left);
      if (err) return err;
      err = this.compile(node.index);
      if (err) return err;
      this.emit(Opcodes.OpIndex);
    } else if (node instanceof OptionalChainExpression) {
      let err = this.compile(node.left);
      if (err) return err;
      const sym = this.symbolTable.define("__optchain_" + this.currentInstructions().length);
      this.emit(sym.scope === "GLOBAL" ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, sym.index);
      this.loadSymbol(sym);
      this.emit(Opcodes.OpNull);
      this.emit(Opcodes.OpEqual);
      const jumpNotNullPos = this.emit(Opcodes.OpJumpNotTruthy, 65535);
      this.emit(Opcodes.OpNull);
      const jumpEndPos = this.emit(Opcodes.OpJump, 65535);
      this.changeOperand(jumpNotNullPos, this.currentInstructions().length);
      this.resetPeepholeState();
      this.loadSymbol(sym);
      err = this.compile(node.index);
      if (err) return err;
      this.emit(Opcodes.OpIndex);
      this.changeOperand(jumpEndPos, this.currentInstructions().length);
      this.resetPeepholeState();
    } else if (node instanceof FunctionLiteral) {
      return this.compileFunctionLiteral(node);
    } else if (node instanceof CallExpression) {
      if (node.function instanceof IndexExpression && node.function.index instanceof StringLiteral) {
        const methodName = node.function.index.value;
        const builtinIdx = BUILTINS.indexOf(methodName);
        const leftIsModule = node.function.left instanceof Identifier && this.importedModules.has(node.function.left.value);
        if (builtinIdx !== -1 && !leftIsModule) {
          this.emit(Opcodes.OpGetBuiltin, builtinIdx);
          const err = this.compile(node.function.left);
          if (err) return err;
          for (const arg of node.arguments) {
            const err2 = this.compile(arg);
            if (err2) return err2;
          }
          this.emit(Opcodes.OpCall, node.arguments.length + 1);
          this.resetIntStack();
        } else {
          const err = this.compile(node.function);
          if (err) return err;
          for (const arg of node.arguments) {
            const err2 = this.compile(arg);
            if (err2) return err2;
          }
          this.emit(Opcodes.OpCall, node.arguments.length);
          this.resetIntStack();
        }
      } else {
        const err = this.compile(node.function);
        if (err) return err;
        for (const arg of node.arguments) {
          const err2 = this.compile(arg);
          if (err2) return err2;
        }
        this.emit(Opcodes.OpCall, node.arguments.length);
        this.resetIntStack();
      }
    }
    return null;
  }
  compileIfExpression(node) {
    let err = this.compile(node.condition);
    if (err) return err;
    const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
    err = this.compile(node.consequence);
    if (err) return err;
    if (this.lastInstructionIs(Opcodes.OpPop)) {
      this.removeLastPop();
    }
    const jumpPos = this.emit(Opcodes.OpJump, 9999);
    const afterConsequence = this.currentInstructions().length;
    this.changeOperand(jumpNotTruthyPos, afterConsequence);
    this.resetPeepholeState();
    if (!node.alternative) {
      this.emit(Opcodes.OpNull);
    } else {
      err = this.compile(node.alternative);
      if (err) return err;
      if (this.lastInstructionIs(Opcodes.OpPop)) {
        this.removeLastPop();
      }
    }
    const afterAlternative = this.currentInstructions().length;
    this.changeOperand(jumpPos, afterAlternative);
    this.resetPeepholeState();
    this.resetIntStack();
    return null;
  }
  compileDoWhileExpression(node) {
    const loopStart = this.currentInstructions().length;
    this.loopStack.push({ breakPatches: [], continuePatches: [], continueTarget: loopStart });
    let err = this.compile(node.body);
    if (err) return err;
    if (this.lastInstructionIs(Opcodes.OpPop)) {
    } else {
      this.emit(Opcodes.OpPop);
    }
    err = this.compile(node.condition);
    if (err) return err;
    const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
    this.emit(Opcodes.OpJump, loopStart);
    const afterLoop = this.currentInstructions().length;
    this.changeOperand(jumpNotTruthyPos, afterLoop);
    const loopCtx = this.loopStack.pop();
    for (const bp of loopCtx.breakPatches) this.changeOperand(bp, afterLoop);
    this.emit(Opcodes.OpNull);
    this.resetIntStack();
    return null;
  }
  compileWhileExpression(node) {
    const loopStart = this.currentInstructions().length;
    this.loopStack.push({ breakPatches: [], continuePatches: [], continueTarget: loopStart });
    let err = this.compile(node.condition);
    if (err) return err;
    const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
    err = this.compile(node.body);
    if (err) return err;
    if (this.lastInstructionIs(Opcodes.OpPop)) {
    } else {
      this.emit(Opcodes.OpPop);
    }
    this.emit(Opcodes.OpJump, loopStart);
    const afterLoop = this.currentInstructions().length;
    this.changeOperand(jumpNotTruthyPos, afterLoop);
    const loopCtx = this.loopStack.pop();
    for (const breakPos of loopCtx.breakPatches) {
      this.changeOperand(breakPos, afterLoop);
    }
    this.emit(Opcodes.OpNull);
    this.resetIntStack();
    return null;
  }
  compileForExpression(node) {
    let err = this.compile(node.init);
    if (err) return err;
    const loopStart = this.currentInstructions().length;
    err = this.compile(node.condition);
    if (err) return err;
    const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
    this.loopStack.push({ breakPatches: [], continuePatches: [], continueTarget: -1 });
    err = this.compile(node.body);
    if (err) return err;
    if (this.lastInstructionIs(Opcodes.OpPop)) {
    } else {
      this.emit(Opcodes.OpPop);
    }
    const updatePos = this.currentInstructions().length;
    const loopCtx = this.loopStack[this.loopStack.length - 1];
    for (const contPos of loopCtx.continuePatches) {
      this.changeOperand(contPos, updatePos);
    }
    err = this.compile(node.update);
    if (err) return err;
    this.emit(Opcodes.OpPop);
    this.emit(Opcodes.OpJump, loopStart);
    const afterLoop = this.currentInstructions().length;
    this.changeOperand(jumpNotTruthyPos, afterLoop);
    this.loopStack.pop();
    for (const breakPos of loopCtx.breakPatches) {
      this.changeOperand(breakPos, afterLoop);
    }
    this.emit(Opcodes.OpNull);
    this.resetIntStack();
    return null;
  }
  compileForInExpression(node) {
    let err = this.compile(node.iterable);
    if (err) return err;
    const arrSym = this.symbolTable.define("__forin_arr_" + this.currentInstructions().length);
    this.emit(arrSym.scope === "GLOBAL" ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, arrSym.index);
    this.emit(Opcodes.OpGetBuiltin, 0);
    this.loadSymbol(arrSym);
    this.emit(Opcodes.OpCall, 1);
    const lenSym = this.symbolTable.define("__forin_len_" + this.currentInstructions().length);
    this.emit(lenSym.scope === "GLOBAL" ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, lenSym.index);
    const zeroIdx = this.addConstant(new MonkeyInteger(0));
    this.emit(Opcodes.OpConstant, zeroIdx);
    const iSym = this.symbolTable.define("__forin_i_" + this.currentInstructions().length);
    this.emit(iSym.scope === "GLOBAL" ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, iSym.index);
    const loopStart = this.currentInstructions().length;
    this.loadSymbol(iSym);
    this.loadSymbol(lenSym);
    this.emit(Opcodes.OpLessThanInt);
    const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
    this.loopStack.push({ breakPatches: [], continuePatches: [], continueTarget: -1 });
    this.loadSymbol(arrSym);
    this.loadSymbol(iSym);
    this.emit(Opcodes.OpIndex);
    const varSym = this.symbolTable.define(node.variable);
    this.emit(varSym.scope === "GLOBAL" ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, varSym.index);
    err = this.compile(node.body);
    if (err) return err;
    if (this.lastInstructionIs(Opcodes.OpPop)) {
    } else {
      this.emit(Opcodes.OpPop);
    }
    const incrementPos = this.currentInstructions().length;
    const loopCtxIn = this.loopStack[this.loopStack.length - 1];
    for (const contPos of loopCtxIn.continuePatches) {
      this.changeOperand(contPos, incrementPos);
    }
    this.loadSymbol(iSym);
    const oneIdx = this.addConstant(new MonkeyInteger(1));
    this.emit(Opcodes.OpConstant, oneIdx);
    this.emit(Opcodes.OpAdd);
    this.emit(iSym.scope === "GLOBAL" ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, iSym.index);
    this.emit(Opcodes.OpJump, loopStart);
    const afterLoop = this.currentInstructions().length;
    this.changeOperand(jumpNotTruthyPos, afterLoop);
    this.loopStack.pop();
    for (const breakPos of loopCtxIn.breakPatches) {
      this.changeOperand(breakPos, afterLoop);
    }
    this.emit(Opcodes.OpNull);
    this.resetIntStack();
    return null;
  }
  compileTemplateLiteral(node) {
    let err = this.compileTemplatePart(node.parts[0]);
    if (err) return err;
    for (let i = 1; i < node.parts.length; i++) {
      err = this.compileTemplatePart(node.parts[i]);
      if (err) return err;
      this.emit(Opcodes.OpAdd);
    }
    return null;
  }
  compileTemplatePart(part) {
    if (part instanceof StringLiteral) {
      const idx = this.addConstant(internString(part.value));
      this.emit(Opcodes.OpConstant, idx);
      return null;
    }
    const strIdx = BUILTINS.indexOf("str");
    this.emit(Opcodes.OpGetBuiltin, strIdx);
    const err = this.compile(part);
    if (err) return err;
    this.emit(Opcodes.OpCall, 1);
    return null;
  }
  compileMatchExpression(node) {
    let err = this.compile(node.subject);
    if (err) return err;
    const subjectSym = this.symbolTable.define("__match_" + this.currentInstructions().length);
    this.emit(subjectSym.scope === "GLOBAL" ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, subjectSym.index);
    const endJumps = [];
    for (let i = 0; i < node.arms.length; i++) {
      const arm = node.arms[i];
      if (arm.pattern === null) {
        if (arm.guard) {
          err = this.compile(arm.guard);
          if (err) return err;
          const guardJump = this.emit(Opcodes.OpJumpNotTruthy, 9999);
          err = this.compile(arm.value);
          if (err) return err;
          endJumps.push(this.emit(Opcodes.OpJump, 9999));
          this.changeOperand(guardJump, this.currentInstructions().length);
          this.resetPeepholeState();
          continue;
        }
        err = this.compile(arm.value);
        if (err) return err;
        break;
      }
      if (arm.pattern instanceof TypePattern) {
        this.loadSymbol(subjectSym);
        const typeConst = this.addConstant(arm.pattern.typeName);
        this.emit(Opcodes.OpTypeIs, typeConst);
        const jumpNotTruthyPos2 = this.emit(Opcodes.OpJumpNotTruthy, 9999);
        if (arm.pattern.typeName === "Ok" || arm.pattern.typeName === "Err") {
          this.loadSymbol(subjectSym);
          this.emit(Opcodes.OpResultValue);
        } else {
          this.loadSymbol(subjectSym);
        }
        const bindSym = this.symbolTable.define(arm.pattern.binding.value);
        this.emit(bindSym.scope === "GLOBAL" ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, bindSym.index);
        if (arm.guard) {
          err = this.compile(arm.guard);
          if (err) return err;
          const guardJump = this.emit(Opcodes.OpJumpNotTruthy, 9999);
          err = this.compile(arm.value);
          if (err) return err;
          endJumps.push(this.emit(Opcodes.OpJump, 9999));
          this.changeOperand(guardJump, this.currentInstructions().length);
          this.resetPeepholeState();
          continue;
        }
        err = this.compile(arm.value);
        if (err) return err;
        endJumps.push(this.emit(Opcodes.OpJump, 9999));
        this.changeOperand(jumpNotTruthyPos2, this.currentInstructions().length);
        this.resetPeepholeState();
        continue;
      }
      if (arm.pattern instanceof OrPattern) {
        const matchJumps = [];
        for (let j = 0; j < arm.pattern.patterns.length; j++) {
          this.loadSymbol(subjectSym);
          err = this.compile(arm.pattern.patterns[j]);
          if (err) return err;
          this.emit(Opcodes.OpEqual);
          if (j < arm.pattern.patterns.length - 1) {
            const trueJump = this.emit(Opcodes.OpJumpNotTruthy, 9999);
            matchJumps.push({ skip: false, pos: this.emit(Opcodes.OpJump, 9999) });
            this.changeOperand(trueJump, this.currentInstructions().length);
            this.resetPeepholeState();
          }
        }
        const noMatchJump = this.emit(Opcodes.OpJumpNotTruthy, 9999);
        for (const mj of matchJumps) {
          this.changeOperand(mj.pos, this.currentInstructions().length);
        }
        if (arm.guard) {
          err = this.compile(arm.guard);
          if (err) return err;
          const guardJump = this.emit(Opcodes.OpJumpNotTruthy, 9999);
          err = this.compile(arm.value);
          if (err) return err;
          endJumps.push(this.emit(Opcodes.OpJump, 9999));
          this.changeOperand(guardJump, this.currentInstructions().length);
          this.resetPeepholeState();
        } else {
          err = this.compile(arm.value);
          if (err) return err;
          endJumps.push(this.emit(Opcodes.OpJump, 9999));
        }
        this.changeOperand(noMatchJump, this.currentInstructions().length);
        this.resetPeepholeState();
        continue;
      }
      if (arm.guard && arm.pattern instanceof Identifier) {
        this.loadSymbol(subjectSym);
        const bindSym = this.symbolTable.define(arm.pattern.value);
        this.emit(bindSym.scope === "GLOBAL" ? Opcodes.OpSetGlobal : Opcodes.OpSetLocal, bindSym.index);
        err = this.compile(arm.guard);
        if (err) return err;
        const guardJump = this.emit(Opcodes.OpJumpNotTruthy, 9999);
        err = this.compile(arm.value);
        if (err) return err;
        endJumps.push(this.emit(Opcodes.OpJump, 9999));
        this.changeOperand(guardJump, this.currentInstructions().length);
        this.resetPeepholeState();
        continue;
      }
      this.loadSymbol(subjectSym);
      err = this.compile(arm.pattern);
      if (err) return err;
      this.emit(Opcodes.OpEqual);
      const jumpNotTruthyPos = this.emit(Opcodes.OpJumpNotTruthy, 9999);
      if (arm.guard) {
        err = this.compile(arm.guard);
        if (err) return err;
        const guardJump = this.emit(Opcodes.OpJumpNotTruthy, 9999);
        err = this.compile(arm.value);
        if (err) return err;
        endJumps.push(this.emit(Opcodes.OpJump, 9999));
        this.changeOperand(guardJump, this.currentInstructions().length);
        this.resetPeepholeState();
      } else {
        err = this.compile(arm.value);
        if (err) return err;
        endJumps.push(this.emit(Opcodes.OpJump, 9999));
      }
      this.changeOperand(jumpNotTruthyPos, this.currentInstructions().length);
      this.resetPeepholeState();
    }
    const lastArm = node.arms[node.arms.length - 1];
    if (lastArm.pattern !== null) {
      this.emit(Opcodes.OpNull);
    }
    const end = this.currentInstructions().length;
    for (const pos of endJumps) {
      this.changeOperand(pos, end);
    }
    this.resetPeepholeState();
    return null;
  }
  compileFunctionLiteral(node) {
    this.enterScope();
    if (node.name) {
      this.symbolTable.defineFunctionName(node.name);
    }
    for (const param of node.parameters) {
      this.symbolTable.define(param.value);
    }
    const hasRestParam = !!node.restParam;
    if (hasRestParam) {
      this.symbolTable.define(node.restParam.value);
    }
    if (node.defaults) {
      for (let i = 0; i < node.defaults.length; i++) {
        if (node.defaults[i] !== null) {
          const sym = this.symbolTable.resolve(node.parameters[i].value);
          this.loadSymbol(sym);
          this.emit(Opcodes.OpNull);
          this.emit(Opcodes.OpEqual);
          const jumpPos = this.emit(Opcodes.OpJumpNotTruthy, 65535);
          const err2 = this.compile(node.defaults[i]);
          if (err2) return err2;
          this.emit(sym.scope === "LOCAL" ? Opcodes.OpSetLocal : Opcodes.OpSetGlobal, sym.index);
          this.changeOperand(jumpPos, this.currentInstructions().length);
        }
      }
    }
    if (node.paramTypes) {
      for (let i = 0; i < node.paramTypes.length; i++) {
        if (node.paramTypes[i]) {
          const sym = this.symbolTable.resolve(node.parameters[i].value);
          const typeIdx = this.addConstant(node.paramTypes[i]);
          this.emit(Opcodes.OpTypeCheck, sym.index, typeIdx);
        }
      }
    }
    const err = this.compile(node.body);
    if (err) return err;
    if (this.lastInstructionIs(Opcodes.OpPop)) {
      this.replaceLastPopWithReturn();
    }
    if (!this.lastInstructionIs(Opcodes.OpReturnValue)) {
      this.emit(Opcodes.OpReturn);
    }
    const freeSymbols = this.symbolTable.freeSymbols;
    const numLocals = this.symbolTable.numDefinitions;
    const instructions = this.leaveScope();
    for (const sym of freeSymbols) {
      this.loadSymbol(sym);
    }
    const fn = new CompiledFunction(instructions, numLocals, node.parameters.length, hasRestParam);
    const idx = this.addConstant(fn);
    this.emit(Opcodes.OpClosure, idx, freeSymbols.length);
    return null;
  }
  /**
   * Check if a node will produce a known integer value when compiled.
   * Conservative — only returns true for obvious cases.
   */
  isIntegerProducing(node) {
    if (node instanceof IntegerLiteral) return true;
    if (node instanceof PrefixExpression && node.operator === "-") {
      return this.isIntegerProducing(node.right);
    }
    if (node instanceof InfixExpression && ["+", "-", "*", "/"].includes(node.operator)) {
      return this.isIntegerProducing(node.left) && this.isIntegerProducing(node.right);
    }
    return false;
  }
  /**
   * Map from generic arithmetic op to its GetLocal*Const superinstruction.
   */
  static GET_LOCAL_CONST_OPS = {
    [Opcodes.OpAdd]: Opcodes.OpGetLocalAddConst,
    [Opcodes.OpSub]: Opcodes.OpGetLocalSubConst,
    [Opcodes.OpMul]: Opcodes.OpGetLocalMulConst,
    [Opcodes.OpDiv]: Opcodes.OpGetLocalDivConst
  };
  /**
   * Peephole optimization: if the last instruction was OpConstant,
   * fuse it with the arithmetic op into a single constant-operand opcode.
   * If OpGetLocal preceded OpConstant, fuse all three into OpGetLocal*Const.
   * If both operands are known integers and intOp is provided, use it.
   */
  emitArithOrConst(genericOp, constOp, intOp = null) {
    const scope = this.currentScope();
    const bothInt = this.topNAreInt(2);
    if (scope.lastInstruction.opcode === Opcodes.OpConstant) {
      const constPos = scope.lastInstruction.position;
      const ins = scope.instructions;
      const constIdx = ins[constPos + 1] << 8 | ins[constPos + 2];
      const prevOp = scope.previousInstruction.opcode;
      const prevPos = scope.previousInstruction.position;
      const superOp = _Compiler.GET_LOCAL_CONST_OPS[genericOp];
      if (prevOp === Opcodes.OpGetLocal && superOp !== void 0) {
        const localIdx = ins[prevPos + 1];
        scope.instructions = scope.instructions.slice(0, prevPos);
        scope.lastInstruction = new EmittedInstruction(void 0, 0);
        scope.previousInstruction = new EmittedInstruction(void 0, 0);
        this.consumeIntStack(2);
        this.emitInt(superOp, localIdx, constIdx);
      } else {
        scope.instructions = scope.instructions.slice(0, constPos);
        scope.lastInstruction = scope.previousInstruction;
        this.consumeIntStack(2);
        this.emitInt(constOp, constIdx);
      }
    } else if (bothInt && intOp) {
      this.consumeIntStack(2);
      this.emitInt(intOp);
    } else {
      this.consumeIntStack(2);
      this.emit(genericOp);
    }
  }
  /**
   * Emit a comparison opcode, using the integer-specialized variant
   * if both operands are known integers.
   */
  emitCompareOrSpecialized(genericOp, intOp) {
    if (this.topNAreInt(2)) {
      this.consumeIntStack(2);
      this.emit(intOp);
    } else {
      this.consumeIntStack(2);
      this.emit(genericOp);
    }
  }
  loadSymbol(sym) {
    switch (sym.scope) {
      case SCOPE.GLOBAL:
        this.emit(Opcodes.OpGetGlobal, sym.index);
        break;
      case SCOPE.LOCAL:
        this.emit(Opcodes.OpGetLocal, sym.index);
        break;
      case SCOPE.BUILTIN:
        this.emit(Opcodes.OpGetBuiltin, sym.index);
        break;
      case SCOPE.FREE:
        this.emit(Opcodes.OpGetFree, sym.index);
        break;
      case SCOPE.FUNCTION:
        this.emit(Opcodes.OpCurrentClosure);
        break;
    }
  }
  addConstant(obj) {
    this.constants.push(obj);
    return this.constants.length - 1;
  }
  emit(op, ...operands) {
    const ins = make(op, ...operands);
    const pos = this.addInstruction(ins);
    this.setLastInstruction(op, pos);
    return pos;
  }
  /** Emit and mark that the result pushes a known integer onto the stack */
  emitInt(op, ...operands) {
    const pos = this.emit(op, ...operands);
    this.currentScope().intStackDepth++;
    return pos;
  }
  /** Consume N known-integer slots from the type tracker */
  consumeIntStack(n) {
    const scope = this.currentScope();
    scope.intStackDepth = Math.max(0, scope.intStackDepth - n);
  }
  /** Reset int stack tracking (after jumps, calls, unknown ops) */
  resetIntStack() {
    this.currentScope().intStackDepth = 0;
  }
  /** Check if top N stack values are known integers */
  topNAreInt(n) {
    return this.currentScope().intStackDepth >= n;
  }
  addInstruction(ins) {
    const pos = this.currentInstructions().length;
    this.currentScope().instructions = concatInstructions(this.currentInstructions(), ins);
    return pos;
  }
  setLastInstruction(op, pos) {
    const scope = this.currentScope();
    scope.previousInstruction = scope.lastInstruction;
    scope.lastInstruction = new EmittedInstruction(op, pos);
  }
  lastInstructionIs(op) {
    return this.currentScope().lastInstruction.opcode === op;
  }
  resetPeepholeState() {
    const scope = this.currentScope();
    scope.lastInstruction = new EmittedInstruction(void 0, 0);
    scope.previousInstruction = new EmittedInstruction(void 0, 0);
    scope.intStackDepth = 0;
  }
  removeLastPop() {
    const scope = this.currentScope();
    scope.instructions = scope.instructions.slice(0, scope.lastInstruction.position);
    scope.lastInstruction = scope.previousInstruction;
  }
  replaceLastPopWithReturn() {
    const scope = this.currentScope();
    const pos = scope.lastInstruction.position;
    scope.instructions[pos] = Opcodes.OpReturnValue;
    scope.lastInstruction.opcode = Opcodes.OpReturnValue;
  }
  changeOperand(pos, operand) {
    const op = this.currentInstructions()[pos];
    const ins = make(op, operand);
    this.replaceInstruction(pos, ins);
  }
  replaceInstruction(pos, ins) {
    const instructions = this.currentInstructions();
    for (let i = 0; i < ins.length; i++) {
      instructions[pos + i] = ins[i];
    }
  }
  enterScope() {
    this.scopes.push(new CompilationScope());
    this.scopeIndex++;
    this.symbolTable = new SymbolTable(this.symbolTable);
  }
  leaveScope() {
    const instructions = this.currentInstructions();
    this.scopes.pop();
    this.scopeIndex--;
    this.symbolTable = this.symbolTable.outer;
    return instructions;
  }
  bytecode() {
    return new Bytecode(this.currentInstructions(), this.constants);
  }
};

// src/jit.js
var HOT_LOOP_THRESHOLD = 16;
var MAX_TRACES = 64;
var HOT_EXIT_THRESHOLD = 8;
var MAX_SIDE_TRACES = 4;
var MAX_INLINE_DEPTH = 3;
var HOT_FUNC_THRESHOLD = 16;
var IR = {
  // Constants & loads
  CONST_INT: "const_int",
  // value: number
  CONST_BOOL: "const_bool",
  // value: boolean
  CONST_NULL: "const_null",
  CONST_OBJ: "const_obj",
  // value: MonkeyObject ref
  LOAD_LOCAL: "load_local",
  // slot: number
  LOAD_GLOBAL: "load_global",
  // index: number
  LOAD_FREE: "load_free",
  // index: number
  LOAD_CONST: "load_const",
  // index: number (from constant pool)
  // Stores
  STORE_LOCAL: "store_local",
  // slot: number, value: ref
  STORE_GLOBAL: "store_global",
  // index: number, value: ref
  // Arithmetic (operate on raw JS numbers)
  ADD_INT: "add_int",
  // left: ref, right: ref
  SUB_INT: "sub_int",
  MUL_INT: "mul_int",
  DIV_INT: "div_int",
  MOD_INT: "mod_int",
  // String
  CONCAT: "concat",
  // left: ref, right: ref
  // Comparison (produce raw JS booleans)
  EQ: "eq",
  NEQ: "neq",
  GT: "gt",
  LT: "lt",
  // Unary
  NEG: "neg",
  // operand: ref
  NOT: "not",
  // operand: ref
  // Guards (exit trace on failure)
  GUARD_INT: "guard_int",
  // ref: check this value is MonkeyInteger
  GUARD_BOOL: "guard_bool",
  GUARD_STRING: "guard_string",
  GUARD_TRUTHY: "guard_truthy",
  // ref: check truthy, exit if not
  GUARD_FALSY: "guard_falsy",
  // ref: check falsy, exit if not
  // Control
  PHI: "phi",
  // loop header: merge initial and back-edge values
  LOOP_START: "loop_start",
  LOOP_END: "loop_end",
  // back-edge: jump to loop start
  // Function traces (recursive call support)
  SELF_CALL: "self_call",
  // args: ref[] — recursive call to the traced function
  FUNC_RETURN: "func_return",
  // ref: return value from function trace
  // Function calls (bail out to interpreter for now)
  CALL: "call",
  // closure: ref, args: ref[], numArgs: number
  // Array operations
  INDEX_ARRAY: "index_array",
  // array: ref, index: ref → element (MonkeyObject)
  GUARD_ARRAY: "guard_array",
  // ref: check this value is MonkeyArray
  GUARD_BOUNDS: "guard_bounds",
  // array: ref, index: ref → check 0 <= index < length
  GUARD_CLOSURE: "guard_closure",
  // ref: closureRef, fnId: expected → check closure.fn.id matches
  // Hash operations
  GUARD_HASH: "guard_hash",
  // ref: check this value is MonkeyHash
  INDEX_HASH: "index_hash",
  // hash: ref, key: ref → value (MonkeyObject), uses hashKey()
  // Builtin operations (inlined builtins — avoid aborting trace)
  BUILTIN_LEN: "builtin_len",
  // ref: array or string → raw int (length)
  BUILTIN_PUSH: "builtin_push",
  // array: ref, value: ref → new MonkeyArray
  // Trace stitching (nested loops)
  EXEC_TRACE: "exec_trace",
  // Execute an inner compiled trace; constIdx: index of compiled fn in consts
  // Boxing/unboxing
  UNBOX_INT: "unbox_int",
  // ref → raw number
  BOX_INT: "box_int",
  // raw number → MonkeyInteger
  UNBOX_STRING: "unbox_string",
  // ref → raw JS string
  BOX_STRING: "box_string"
  // raw JS string → MonkeyString
};
var IRInst = class {
  constructor(op, operands = {}) {
    this.op = op;
    this.operands = operands;
    this.type = null;
    this.id = -1;
  }
};
var Trace = class {
  constructor(frameId, startIp) {
    this.frameId = frameId;
    this.startIp = startIp;
    this.ir = [];
    this.guardCount = 0;
    this.compiled = null;
    this.executionCount = 0;
    this.sideExits = /* @__PURE__ */ new Map();
    this.sideTraces = /* @__PURE__ */ Object.create(null);
    this._sideTraceCount = 0;
    this.isSideTrace = false;
    this.parentTrace = null;
    this.parentGuardIdx = -1;
    this.isFuncTrace = false;
    this.numArgs = 0;
    this.tracedFn = null;
  }
  addInst(op, operands = {}) {
    const inst = new IRInst(op, operands);
    inst.id = this.ir.length;
    this.ir.push(inst);
    return inst.id;
  }
};
var TraceRecorder = class {
  constructor(vm) {
    this.vm = vm;
    this.trace = null;
    this.recording = false;
    this.startIp = -1;
    this.startFrame = -1;
    this.irStack = [];
    this.loopHeaderSeen = false;
    this.instrCount = 0;
    this.typeMap = /* @__PURE__ */ new Map();
    this.localSlotRefs = /* @__PURE__ */ new Map();
    this.globalSlotRefs = /* @__PURE__ */ new Map();
    this.isSideTrace = false;
    this.parentTrace = null;
    this.parentGuardIdx = -1;
    this.inlineFrames = [];
    this.inlineDepth = 0;
    this.inlineSlotRefs = /* @__PURE__ */ new Map();
    this.trustedTypes = /* @__PURE__ */ new Map();
  }
  start(frameId, ip) {
    this.trace = new Trace(frameId, ip);
    this.recording = true;
    this.startIp = ip;
    this.startFrame = this.vm.framesIndex;
    this.irStack = [];
    this.loopHeaderSeen = false;
    this.instrCount = 0;
    this.typeMap.clear();
    this.localSlotRefs.clear();
    this.globalSlotRefs.clear();
    this.trustedTypes.clear();
    this.isSideTrace = false;
    this.parentTrace = null;
    this.parentGuardIdx = -1;
    this.trace.addInst(IR.LOOP_START);
  }
  // Start recording a side trace from a guard exit
  startSideTrace(parentTrace, guardIdx, exitIp, frameId) {
    this.trace = new Trace(frameId, exitIp);
    this.trace.isSideTrace = true;
    this.trace.parentTrace = parentTrace;
    this.trace.parentGuardIdx = guardIdx;
    this.recording = true;
    this.startIp = exitIp;
    this.startFrame = this.vm.framesIndex;
    this.irStack = [];
    this.loopHeaderSeen = false;
    this.instrCount = 0;
    this.typeMap.clear();
    this.localSlotRefs.clear();
    this.globalSlotRefs.clear();
    this.isSideTrace = true;
    this.trustedTypes.clear();
    this.parentTrace = parentTrace;
    this.parentGuardIdx = guardIdx;
    this.trace.addInst(IR.LOOP_START);
  }
  // Start recording a function trace (triggered by hot function entry)
  startFuncTrace(frameId, fn, numArgs) {
    this.trace = new Trace(frameId, 0);
    this.trace.isFuncTrace = true;
    this.trace.numArgs = numArgs;
    this.trace.tracedFn = fn;
    this.recording = true;
    this.startIp = 0;
    this.startFrame = this.vm.framesIndex;
    this.irStack = [];
    this.loopHeaderSeen = false;
    this.instrCount = 0;
    this.typeMap.clear();
    this.localSlotRefs.clear();
    this.globalSlotRefs.clear();
    this.isSideTrace = false;
    this.trustedTypes.clear();
    this.isFuncTrace = true;
    this.tracedFn = fn;
    for (let i = 0; i < numArgs; i++) {
      const ref = this.trace.addInst(IR.LOAD_LOCAL, { slot: i });
      this.pushRef(ref);
    }
    this.irStack = [];
  }
  stop() {
    if (!this.recording) return null;
    this.recording = false;
    if (!this.trace.isFuncTrace) {
      this.trace.addInst(IR.LOOP_END);
    }
    const trace = this.trace;
    this.trace = null;
    return trace;
  }
  // Check if the current IP is the parent trace's loop header (side trace stop condition)
  shouldStopSideTrace(ip, frameIndex) {
    if (!this.isSideTrace || !this.parentTrace) return false;
    return ip === this.parentTrace.startIp && frameIndex === this.startFrame;
  }
  abort() {
    this.recording = false;
    this.trace = null;
    this.irStack = [];
    this.inlineFrames = [];
    this.inlineDepth = 0;
  }
  // Enter an inlined function call during recording
  // baseOffset: the callee's basePointer relative to the trace's root basePointer
  // numLocals: callee's numLocals (to know the stack layout)
  // callSiteIp: the IP in the caller frame right after the OpCall (for guard exit fallback)
  enterInlineFrame(baseOffset, numLocals, callSiteIp) {
    if (this.inlineDepth >= MAX_INLINE_DEPTH) return false;
    this.inlineFrames.push({
      baseOffset,
      numLocals,
      irStackDepth: this.irStack.length,
      callSiteIp
      // used for guard exits inside the inlined function
    });
    this.inlineDepth++;
    return true;
  }
  // Leave an inlined function call, returning the return value IR ref
  leaveInlineFrame() {
    if (this.inlineDepth === 0) return;
    const frame = this.inlineFrames.pop();
    for (let i = 0; i < frame.numLocals; i++) {
      this.inlineSlotRefs.delete(frame.baseOffset + i);
    }
    this.inlineDepth--;
  }
  // Get the current base offset for local variable addressing
  // Returns 0 for root frame, or the inlined frame's baseOffset
  currentBaseOffset() {
    if (this.inlineFrames.length === 0) return 0;
    return this.inlineFrames[this.inlineFrames.length - 1].baseOffset;
  }
  // Get the appropriate exit IP for guard failures.
  // Inside inlined functions, guards should exit to the outermost callSiteIp
  // (the call instruction in the root frame) so the interpreter resumes at the
  // call site and side traces can record the correct alternate path.
  // Callee IPs are meaningless in the caller's frame.
  getGuardExitIp() {
    if (this.inlineDepth > 0) {
      return this.inlineFrames[0].callSiteIp;
    }
    return null;
  }
  // Capture a snapshot of the current interpreter state for deoptimization.
  // Returns a map of local slots and global indices to their current IR refs.
  // This enables the VM to restore state at the exact bytecode position when
  // a guard fails, rather than restarting from the trace entry.
  captureSnapshot() {
    return {
      locals: new Map(this.localSlotRefs),
      globals: new Map(this.globalSlotRefs),
      irStack: [...this.irStack]
      // copy of current virtual stack refs
    };
  }
  // Update slot tracking when a local is stored
  trackLocalStore(slot, irRef) {
    this.localSlotRefs.set(slot, irRef);
  }
  // Update slot tracking when a local is loaded
  trackLocalLoad(slot, irRef) {
    if (!this.localSlotRefs.has(slot)) {
      this.localSlotRefs.set(slot, irRef);
    }
  }
  // Update slot tracking when a global is stored
  trackGlobalStore(index, irRef) {
    this.globalSlotRefs.set(index, irRef);
  }
  // Update slot tracking when a global is loaded
  trackGlobalLoad(index, irRef) {
    if (!this.globalSlotRefs.has(index)) {
      this.globalSlotRefs.set(index, irRef);
    }
  }
  // Add a guard instruction with an attached snapshot.
  // The snapshot captures the current interpreter state (slot→IR ref mappings)
  // so that on guard failure the VM can restore state at the exact position.
  addGuardInst(op, operands) {
    const gid = this.trace.addInst(op, operands);
    const inst = this.trace.ir[gid];
    inst.snapshot = this.captureSnapshot();
    return gid;
  }
  // Push an IR ref onto the virtual stack
  pushRef(ref) {
    this.irStack.push(ref);
  }
  // Pop an IR ref from the virtual stack
  popRef() {
    return this.irStack.pop();
  }
  // Peek at an IR ref N positions from the top (0 = top)
  peekRef(n = 0) {
    return this.irStack[this.irStack.length - 1 - n];
  }
  // Record a guard for a value's type
  guardType(ref, value) {
    const trustedType = this.trustedTypeForRef(ref);
    if (trustedType) {
      this.typeMap.set(ref, trustedType);
      return trustedType;
    }
    const exitIp = this.getGuardExitIp();
    if (value instanceof MonkeyInteger) {
      const gid = this.addGuardInst(IR.GUARD_INT, { ref, exitIp });
      this.typeMap.set(ref, "int");
      this.trace.guardCount++;
      return "int";
    } else if (value instanceof MonkeyBoolean) {
      const gid = this.addGuardInst(IR.GUARD_BOOL, { ref, exitIp });
      this.typeMap.set(ref, "bool");
      this.trace.guardCount++;
      return "bool";
    } else if (value instanceof MonkeyString) {
      const gid = this.addGuardInst(IR.GUARD_STRING, { ref, exitIp });
      this.typeMap.set(ref, "string");
      this.trace.guardCount++;
      return "string";
    }
    this.typeMap.set(ref, "object");
    return "object";
  }
  // Check if we already know a ref's type (skip redundant guards)
  knownType(ref) {
    return this.typeMap.get(ref) || null;
  }
  // Check if an IR ref corresponds to a local with a trusted type annotation
  trustedTypeForRef(ref) {
    if (this.trustedTypes.size === 0) return null;
    const inst = this.trace.ir[ref];
    if (inst && inst.op === IR.LOAD_LOCAL && this.trustedTypes.has(inst.slot)) {
      return this.trustedTypes.get(inst.slot);
    }
    for (const [slot, slotRef] of this.inlineSlotRefs) {
      if (slotRef === ref && this.trustedTypes.has(slot)) {
        return this.trustedTypes.get(slot);
      }
    }
    return null;
  }
  // Record an integer arithmetic operation
  recordIntArith(op, leftVal, rightVal) {
    const rightRef = this.popRef();
    const leftRef = this.popRef();
    if (this.knownType(leftRef) !== "int" && this.knownType(leftRef) !== "raw_int") {
      this.guardType(leftRef, leftVal);
    }
    if (this.knownType(rightRef) !== "int" && this.knownType(rightRef) !== "raw_int") {
      this.guardType(rightRef, rightVal);
    }
    let leftUnboxed = leftRef;
    if (this.knownType(leftRef) !== "raw_int") {
      leftUnboxed = this.trace.addInst(IR.UNBOX_INT, { ref: leftRef });
      this.typeMap.set(leftUnboxed, "raw_int");
    }
    let rightUnboxed = rightRef;
    if (this.knownType(rightRef) !== "raw_int") {
      rightUnboxed = this.trace.addInst(IR.UNBOX_INT, { ref: rightRef });
      this.typeMap.set(rightUnboxed, "raw_int");
    }
    let irOp;
    switch (op) {
      case Opcodes.OpAdd:
      case Opcodes.OpAddInt:
      case Opcodes.OpAddConst:
        irOp = IR.ADD_INT;
        break;
      case Opcodes.OpSub:
      case Opcodes.OpSubInt:
      case Opcodes.OpSubConst:
        irOp = IR.SUB_INT;
        break;
      case Opcodes.OpMul:
      case Opcodes.OpMulInt:
      case Opcodes.OpMulConst:
        irOp = IR.MUL_INT;
        break;
      case Opcodes.OpDiv:
      case Opcodes.OpDivInt:
      case Opcodes.OpDivConst:
        irOp = IR.DIV_INT;
        break;
      case Opcodes.OpMod:
      case Opcodes.OpModInt:
      case Opcodes.OpModConst:
        irOp = IR.MOD_INT;
        break;
    }
    const resultRef = this.trace.addInst(irOp, { left: leftUnboxed, right: rightUnboxed });
    this.typeMap.set(resultRef, "raw_int");
    const boxedRef = this.trace.addInst(IR.BOX_INT, { ref: resultRef });
    this.typeMap.set(boxedRef, "int");
    this.pushRef(boxedRef);
  }
  recordComparison(op, leftVal, rightVal) {
    const rightRef = this.popRef();
    const leftRef = this.popRef();
    if (leftVal instanceof MonkeyInteger && rightVal instanceof MonkeyInteger) {
      if (this.knownType(leftRef) !== "int" && this.knownType(leftRef) !== "raw_int") this.guardType(leftRef, leftVal);
      if (this.knownType(rightRef) !== "int" && this.knownType(rightRef) !== "raw_int") this.guardType(rightRef, rightVal);
      let lu = leftRef;
      if (this.knownType(leftRef) !== "raw_int") {
        lu = this.trace.addInst(IR.UNBOX_INT, { ref: leftRef });
      }
      let ru = rightRef;
      if (this.knownType(rightRef) !== "raw_int") {
        ru = this.trace.addInst(IR.UNBOX_INT, { ref: rightRef });
      }
      let irOp;
      switch (op) {
        case Opcodes.OpEqual:
        case Opcodes.OpEqualInt:
          irOp = IR.EQ;
          break;
        case Opcodes.OpNotEqual:
        case Opcodes.OpNotEqualInt:
          irOp = IR.NEQ;
          break;
        case Opcodes.OpGreaterThan:
        case Opcodes.OpGreaterThanInt:
          irOp = IR.GT;
          break;
        case Opcodes.OpLessThanInt:
          irOp = IR.LT;
          break;
      }
      const ref = this.trace.addInst(irOp, { left: lu, right: ru });
      this.typeMap.set(ref, "raw_bool");
      const boxed = this.trace.addInst(IR.CONST_BOOL, { ref });
      this.typeMap.set(boxed, "bool");
      this.pushRef(boxed);
    } else {
      this.abort();
    }
  }
};
var JIT = class {
  constructor() {
    this.hotCounts = /* @__PURE__ */ new Map();
    this.traces = /* @__PURE__ */ new Map();
    this.funcTraces = /* @__PURE__ */ new Map();
    this.funcCallCounts = /* @__PURE__ */ new Map();
    this.traceCount = 0;
    this.enabled = true;
    this.abortCounts = /* @__PURE__ */ new Map();
    this.blacklisted = /* @__PURE__ */ new Set();
    this.uncompilableFns = /* @__PURE__ */ new Set();
  }
  // Get a trace key for a loop back-edge
  traceKey(closureId, ip) {
    return `${closureId}:${ip}`;
  }
  // Count a loop back-edge hit. Returns true if hot.
  countEdge(closureId, ip) {
    const key = this.traceKey(closureId, ip);
    if (this.blacklisted.has(key)) return false;
    const count = (this.hotCounts.get(key) || 0) + 1;
    this.hotCounts.set(key, count);
    return count >= HOT_LOOP_THRESHOLD;
  }
  // Record a trace abort at a location. After 3 aborts, blacklist it.
  recordAbort(closureId, ip) {
    const key = this.traceKey(closureId, ip);
    const count = (this.abortCounts.get(key) || 0) + 1;
    this.abortCounts.set(key, count);
    if (count >= 3) {
      this.blacklisted.add(key);
    }
  }
  // Check if we have a compiled trace for this location
  getTrace(closureId, ip) {
    return this.traces.get(this.traceKey(closureId, ip)) || null;
  }
  // Store a compiled trace
  storeTrace(trace) {
    if (this.traceCount >= MAX_TRACES) return false;
    if (trace.isSideTrace && trace.parentTrace) {
      if (trace.parentTrace._sideTraceCount >= MAX_SIDE_TRACES) return false;
      trace.parentTrace.sideTraces[trace.parentGuardIdx] = trace;
      trace.parentTrace._sideTraceCount++;
      this._recompileWithInlinedSideTraces(trace.parentTrace);
    } else {
      const key = this.traceKey(trace.frameId, trace.startIp);
      this.traces.set(key, trace);
    }
    this.traceCount++;
    return true;
  }
  // Recompile a parent trace with inlinable side traces embedded directly.
  // Only inlines side traces that end with loop_back and use simple arithmetic
  // on the same globals that the parent promotes.
  _recompileWithInlinedSideTraces(parentTrace) {
    try {
      const compiler = new TraceCompiler(parentTrace);
      const newCompiled = compiler.compile();
      if (newCompiled) parentTrace.compiled = newCompiled;
    } catch (e) {
    }
  }
  // Check if a guard exit is hot enough for a side trace
  shouldRecordSideTrace(trace, guardIdx) {
    if (!this.enabled) return false;
    if (trace.sideTraces[guardIdx]) return false;
    if (trace._sideTraceCount >= MAX_SIDE_TRACES) return false;
    const exitCount = trace.sideExits.get(guardIdx) || 0;
    return exitCount >= HOT_EXIT_THRESHOLD;
  }
  // Count a function call. Returns true if hot enough to trace.
  countFuncCall(fn) {
    const count = (this.funcCallCounts.get(fn) || 0) + 1;
    this.funcCallCounts.set(fn, count);
    return count >= HOT_FUNC_THRESHOLD;
  }
  // Get a compiled function trace
  getFuncTrace(fn) {
    return this.funcTraces.get(fn) || null;
  }
  // Store a compiled function trace
  storeFuncTrace(trace) {
    if (trace.tracedFn) {
      this.funcTraces.set(trace.tracedFn, trace);
      this.traceCount++;
    }
  }
  // Compile a function directly (method JIT, not tracing)
  compileFunction(fn, constants, vm) {
    const ins = fn.instructions;
    let hasSelfCall = false;
    for (let i = 0; i < ins.length; i++) {
      if (ins[i] === Opcodes.OpCurrentClosure) {
        hasSelfCall = true;
        break;
      }
    }
    if (!hasSelfCall) return null;
    const compiler = new FunctionCompiler(fn, constants, vm);
    const compiled = compiler.compileSwitch();
    if (!compiled) return null;
    const trace = new Trace(fn, 0);
    trace.isFuncTrace = true;
    trace.tracedFn = fn;
    trace.compiled = compiled;
    trace._compiler = compiler;
    trace._compiledSource = compiler._compiledSource;
    return trace;
  }
  // Compile a trace to a JavaScript function
  compile(trace, vm) {
    const optimizer = new TraceOptimizer(trace);
    optimizer.optimize();
    const compiler = new TraceCompiler(trace, vm);
    trace.compiled = compiler.compile();
    return trace.compiled !== null;
  }
  // Get JIT statistics for diagnostics
  getStats() {
    let rootTraces = 0;
    let sideTraceCount = 0;
    let totalGuards = 0;
    let totalIR = 0;
    const traceDetails = [];
    for (const [key, trace] of this.traces) {
      rootTraces++;
      totalGuards += trace.guards ? trace.guards.length : 0;
      totalIR += trace.ir ? trace.ir.length : 0;
      sideTraceCount += trace.sideTraces ? trace._sideTraceCount : 0;
      traceDetails.push({
        key,
        irCount: trace.ir ? trace.ir.length : 0,
        guardCount: trace.guards ? trace.guards.length : 0,
        sideTraces: trace.sideTraces ? trace._sideTraceCount : 0,
        hasCompiled: trace.compiled !== null
      });
    }
    return {
      enabled: this.enabled,
      rootTraces,
      sideTraces: sideTraceCount,
      funcTraces: this.funcTraces.size,
      totalTraces: this.traceCount,
      totalIR,
      totalGuards,
      hotSites: this.hotCounts.size,
      blacklisted: this.blacklisted.size,
      aborts: [...this.abortCounts.values()].reduce((a, b) => a + b, 0),
      traces: traceDetails
    };
  }
  // Dump a trace's IR for debugging (returns string)
  dumpTrace(trace) {
    if (!trace || !trace.ir) return "(no trace)";
    const lines = [`--- Trace ${trace.frameId}:${trace.startIp} (${trace.ir.length} IR ops, ${trace.guards ? trace.guards.length : 0} guards) ---`];
    for (let i = 0; i < trace.ir.length; i++) {
      const inst = trace.ir[i];
      const ops = inst.operands || {};
      const parts = [`  ${String(i).padStart(4, "0")} ${inst.op}`];
      if (ops.ref !== void 0) parts.push(`ref=${ops.ref}`);
      if (ops.left !== void 0) parts.push(`left=${ops.left}`);
      if (ops.right !== void 0) parts.push(`right=${ops.right}`);
      if (ops.value !== void 0) parts.push(`val=${ops.value}`);
      if (ops.slot !== void 0) parts.push(`slot=${ops.slot}`);
      if (ops.index !== void 0) parts.push(`idx=${ops.index}`);
      lines.push(parts.join(" "));
    }
    if (trace._compiledSource) {
      lines.push("--- Compiled JS ---");
      lines.push(trace._compiledSource);
    }
    lines.push("---");
    return lines.join("\n");
  }
};
var TraceCompiler = class {
  constructor(trace, vm) {
    this.trace = trace;
    this.vm = vm;
    this.lines = [];
    this.varCount = 0;
  }
  freshVar() {
    return `v${this.varCount++}`;
  }
  // Analyze which globals/locals are loop-carried: loaded and stored with int boxing.
  // Returns sets of indices that can be promoted to raw JS variables.
  _analyzePromotable() {
    const ir = this.trace.ir;
    const globalStored = /* @__PURE__ */ new Map();
    const localStored = /* @__PURE__ */ new Map();
    for (const inst of ir) {
      if (!inst) continue;
      if (inst.op === IR.STORE_GLOBAL) {
        const valInst = ir[inst.operands.value];
        if (valInst && valInst.op === IR.BOX_INT) {
          globalStored.set(inst.operands.index, "int");
        } else if (valInst && valInst.op === IR.BOX_STRING) {
          globalStored.set(inst.operands.index, "string");
        }
      } else if (inst.op === IR.STORE_LOCAL) {
        const valInst = ir[inst.operands.value];
        if (valInst && valInst.op === IR.BOX_INT) {
          localStored.set(inst.operands.slot, "int");
        } else if (valInst && valInst.op === IR.BOX_STRING) {
          localStored.set(inst.operands.slot, "string");
        }
      }
    }
    return { globals: globalStored, locals: localStored };
  }
  _emitReturn(exitObj) {
    if (this._wbWrap) {
      return `return __wb(${exitObj});`;
    }
    return `return ${exitObj};`;
  }
  // Check if an IR instruction produces a raw JS number (not a MonkeyInteger)
  _isRawInt(inst) {
    const rawOps = /* @__PURE__ */ new Set([
      IR.CONST_INT,
      IR.ADD_INT,
      IR.SUB_INT,
      IR.MUL_INT,
      IR.DIV_INT,
      IR.MOD_INT,
      IR.MOD_INT,
      IR.NEG,
      IR.UNBOX_INT
    ]);
    if (rawOps.has(inst.op)) return true;
    if (inst._promotedRaw) return true;
    return false;
  }
  // Emit write-back of promoted variables to globals/stack
  _emitWriteBack(promoted, promotedVarNames) {
    const lines = [];
    for (const [idx] of promoted.globals) {
      const pv = promotedVarNames.get("g:" + idx);
      lines.push(`    __globals[${idx}] = __cachedInteger(${pv});`);
    }
    for (const [slot] of promoted.locals) {
      const pv = promotedVarNames.get("l:" + slot);
      lines.push(`    __stack[__bp + ${slot}] = __cachedInteger(${pv});`);
    }
    return lines;
  }
  // Emit a JS object literal for the snapshot attached to a guard instruction.
  // Maps local/global slots to their current JS variable names at codegen time.
  // Returns null if no snapshot is available for this guard.
  // Only includes entries for variables that have been emitted before this guard.
  _emitSnapshotLiteral(guardIdx) {
    if (!this._currentIr) return null;
    const inst = this._currentIr[guardIdx];
    if (!inst || !inst.snapshot) return null;
    const snap = inst.snapshot;
    const parts = [];
    if (snap.locals.size > 0) {
      const localEntries = [];
      for (const [slot, irRef] of snap.locals) {
        const promotedName = this._promotedVarNames ? this._promotedVarNames.get("l:" + slot) : null;
        if (promotedName) {
          const ptype = this._promotedVarTypes ? this._promotedVarTypes.get("l:" + slot) : "int";
          if (ptype === "string") {
            localEntries.push(`${slot}: new __MonkeyString(${promotedName})`);
          } else {
            localEntries.push(`${slot}: __cachedInteger(${promotedName})`);
          }
        } else {
          const varName = this._varNames ? this._varNames.get(irRef) : null;
          if (varName && this._emittedVarIds && this._emittedVarIds.has(irRef)) {
            const irInst = this._currentIr[irRef];
            if (irInst && this._isRawInt(irInst)) {
              localEntries.push(`${slot}: __cachedInteger(${varName})`);
            } else if (irInst && irInst.op === IR.UNBOX_STRING) {
              localEntries.push(`${slot}: new __MonkeyString(${varName})`);
            } else {
              localEntries.push(`${slot}: ${varName}`);
            }
          }
        }
      }
      if (localEntries.length > 0) {
        parts.push(`locals: { ${localEntries.join(", ")} }`);
      }
    }
    if (snap.globals.size > 0) {
      const globalEntries = [];
      for (const [idx, irRef] of snap.globals) {
        const promotedName = this._promotedVarNames ? this._promotedVarNames.get("g:" + idx) : null;
        if (promotedName) {
          const ptype = this._promotedVarTypes ? this._promotedVarTypes.get("g:" + idx) : "int";
          if (ptype === "string") {
            globalEntries.push(`${idx}: new __MonkeyString(${promotedName})`);
          } else {
            globalEntries.push(`${idx}: __cachedInteger(${promotedName})`);
          }
        } else {
          const varName = this._varNames ? this._varNames.get(irRef) : null;
          if (varName && this._emittedVarIds && this._emittedVarIds.has(irRef)) {
            const irInst = this._currentIr[irRef];
            if (irInst && this._isRawInt(irInst)) {
              globalEntries.push(`${idx}: __cachedInteger(${varName})`);
            } else if (irInst && irInst.op === IR.UNBOX_STRING) {
              globalEntries.push(`${idx}: new __MonkeyString(${varName})`);
            } else {
              globalEntries.push(`${idx}: ${varName}`);
            }
          }
        }
      }
      if (globalEntries.length > 0) {
        parts.push(`globals: { ${globalEntries.join(", ")} }`);
      }
    }
    if (parts.length === 0) return null;
    return `snapshot: { ${parts.join(", ")} }`;
  }
  // Emit a guard exit that inlines side trace dispatch.
  // Instead of returning to the VM, if a side trace exists for this guard,
  // call it directly and continue the loop on loop_back.
  _emitGuardExit(guardIdx, exitIp, condition, exitType = "guard") {
    const snapCode = this._emitSnapshotLiteral(guardIdx);
    const exitObjBase = `exit: "${exitType}", guardIdx: ${guardIdx}, ip: ${exitIp}`;
    const exitObj = snapCode ? `{ ${exitObjBase}, ${snapCode} }` : `{ ${exitObjBase} }`;
    if (!this._inLoop) {
      this.lines.push(`  if (${condition}) {`);
      if (this._wbWrap) {
        this.lines.push(`    __wb(null);`);
      }
      this.lines.push(`    ${this._emitReturn(exitObj)}`);
      this.lines.push(`  }`);
      return;
    }
    this.lines.push(`  if (${condition}) {`);
    const sideTrace = this.trace.sideTraces[guardIdx];
    if (sideTrace && this._canInlineSideTrace(sideTrace)) {
      this._emitInlinedSideTrace(sideTrace);
      this.lines.push(`    continue loop;`);
      this.lines.push(`  }`);
      return;
    }
    this.lines.push(`    const __st_trace = __sideTraces[${guardIdx}];`);
    this.lines.push(`    if (__st_trace) {`);
    if (this._wbWrap) {
      this.lines.push(`      __wb(null);`);
    }
    this.lines.push(`      const __sr = __st_trace.compiled(__stack, __sp, __bp, __globals, __consts, __free, __MonkeyInteger, __MonkeyBoolean, __MonkeyString, __MonkeyArray, __TRUE, __FALSE, __NULL, __cachedInteger, __internString, __isTruthy, __sideTraces);`);
    if (this._wbWrap) {
      this.lines.push(`      __reloadPromoted();`);
    }
    this.lines.push(`      if (__sr && __sr.exit === 'loop_back') { continue loop; }`);
    this.lines.push(`      ${this._emitReturn("__sr")}`);
    this.lines.push(`    }`);
    this.lines.push(`    ${this._emitReturn(exitObj)}`);
    this.lines.push(`  }`);
  }
  // Check if a side trace can be inlined into its parent.
  // Requirements: ends with loop_end, only touches promoted globals/locals, simple body.
  _canInlineSideTrace(sideTrace) {
    if (!sideTrace.ir || sideTrace.ir.length === 0) return false;
    const ir = sideTrace.ir;
    const lastInst = ir[ir.length - 1];
    if (!lastInst || lastInst.op !== IR.LOOP_END) return false;
    const SIMPLE_OPS = /* @__PURE__ */ new Set([
      IR.LOOP_START,
      IR.LOOP_END,
      IR.CONST_INT,
      IR.CONST_BOOL,
      IR.CONST_STRING,
      IR.CONST_NULL,
      IR.LOAD_GLOBAL,
      IR.STORE_GLOBAL,
      IR.LOAD_LOCAL,
      IR.STORE_LOCAL,
      IR.LOAD_FREE,
      IR.STORE_FREE,
      IR.GUARD_INT,
      IR.GUARD_BOOL,
      IR.GUARD_TRUTHY,
      IR.GUARD_FALSY,
      IR.GUARD_STRING,
      IR.GUARD_ARRAY,
      IR.UNBOX_INT,
      IR.BOX_INT,
      IR.UNBOX_STRING,
      IR.BOX_STRING,
      IR.ADD_INT,
      IR.SUB_INT,
      IR.MUL_INT,
      IR.DIV_INT,
      IR.MOD_INT,
      IR.GT,
      IR.LT,
      IR.EQ,
      IR.NEQ,
      IR.GTE,
      IR.LTE,
      IR.NEG,
      IR.NOT,
      IR.CONCAT,
      IR.INDEX,
      IR.HASH_LOOKUP,
      IR.CALL,
      IR.CALL_BUILTIN
    ]);
    for (const inst of ir) {
      if (!inst) continue;
      if (!SIMPLE_OPS.has(inst.op)) return false;
    }
    if (!this._promotedVarNames) return false;
    for (const inst of ir) {
      if (!inst) continue;
      if (inst.op === IR.LOAD_GLOBAL || inst.op === IR.STORE_GLOBAL) {
        if (!this._promotedVarNames.has("g:" + inst.operands.index)) return false;
      }
      if (inst.op === IR.LOAD_LOCAL || inst.op === IR.STORE_LOCAL) {
        if (!this._promotedVarNames.has("l:" + inst.operands.slot)) return false;
      }
    }
    return true;
  }
  // Emit the body of a side trace inline, using the parent's promoted variables.
  _emitInlinedSideTrace(sideTrace) {
    const ir = sideTrace.ir;
    const stVars2 = /* @__PURE__ */ new Map();
    let vc = 0;
    for (const inst of ir) {
      if (!inst) continue;
      switch (inst.op) {
        case IR.LOOP_START:
        case IR.LOOP_END:
          break;
        case IR.CONST_INT:
          stVars2.set(inst.id, String(inst.operands.value));
          break;
        case IR.CONST_BOOL:
          if (inst.operands.ref !== void 0) {
            stVars2.set(inst.id, stVars2.get(inst.operands.ref));
          } else {
            stVars2.set(inst.id, inst.operands.value ? "true" : "false");
          }
          break;
        case IR.LOAD_GLOBAL:
          stVars2.set(inst.id, this._promotedVarNames.get("g:" + inst.operands.index));
          break;
        case IR.STORE_GLOBAL: {
          const pv = this._promotedVarNames.get("g:" + inst.operands.index);
          const val = stVars2.get(inst.operands.value) || "undefined";
          this.lines.push(`    ${pv} = ${val};`);
          break;
        }
        case IR.LOAD_LOCAL:
          stVars2.set(inst.id, this._promotedVarNames.get("l:" + inst.operands.slot));
          break;
        case IR.STORE_LOCAL: {
          const pv = this._promotedVarNames.get("l:" + inst.operands.slot);
          const val = stVars2.get(inst.operands.value) || "undefined";
          this.lines.push(`    ${pv} = ${val};`);
          break;
        }
        case IR.GUARD_INT:
        case IR.GUARD_BOOL:
        case IR.GUARD_STRING:
          break;
        // skip type guards — parent's type guards cover these
        case IR.GUARD_TRUTHY: {
          const ref = stVars2.get(inst.operands.ref);
          if (ref) {
            const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : sideTrace.startIp;
            this.lines.push(`    if (!${ref}) {`);
            if (this._wbWrap) this.lines.push(`      __wb(null);`);
            this.lines.push(`      return __wb({ exit: "guard_falsy", guardIdx: -1, ip: ${exitIp}, snapshot: {} });`);
            this.lines.push(`    }`);
          }
          break;
        }
        case IR.GUARD_FALSY: {
          const ref = stVars2.get(inst.operands.ref);
          if (ref) {
            const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : sideTrace.startIp;
            this.lines.push(`    if (${ref}) {`);
            if (this._wbWrap) this.lines.push(`      __wb(null);`);
            this.lines.push(`      return __wb({ exit: "guard_truthy", guardIdx: -1, ip: ${exitIp}, snapshot: {} });`);
            this.lines.push(`    }`);
          }
          break;
        }
        case IR.UNBOX_INT:
        case IR.BOX_INT:
        case IR.UNBOX_STRING:
        case IR.BOX_STRING:
          stVars2.set(inst.id, stVars2.get(inst.operands.ref));
          break;
        case IR.ADD_INT: {
          const v = `__st${vc++}`;
          this.lines.push(`    const ${v} = (${stVars2.get(inst.operands.left)} + ${stVars2.get(inst.operands.right)});`);
          stVars2.set(inst.id, v);
          break;
        }
        case IR.SUB_INT: {
          const v = `__st${vc++}`;
          this.lines.push(`    const ${v} = (${stVars2.get(inst.operands.left)} - ${stVars2.get(inst.operands.right)});`);
          stVars2.set(inst.id, v);
          break;
        }
        case IR.MUL_INT: {
          const v = `__st${vc++}`;
          this.lines.push(`    const ${v} = (${stVars2.get(inst.operands.left)} * ${stVars2.get(inst.operands.right)});`);
          stVars2.set(inst.id, v);
          break;
        }
        case IR.DIV_INT: {
          const v = `__st${vc++}`;
          this.lines.push(`    const ${v} = Math.trunc(${stVars2.get(inst.operands.left)} / ${stVars2.get(inst.operands.right)});`);
          stVars2.set(inst.id, v);
          break;
        }
        case IR.MOD_INT: {
          const v = `__st${vc++}`;
          this.lines.push(`    const ${v} = (${stVars2.get(inst.operands.left)} % ${stVars2.get(inst.operands.right)});`);
          stVars2.set(inst.id, v);
          break;
        }
        case IR.GT:
        case IR.LT:
        case IR.EQ:
        case IR.NEQ: {
          const v = `__st${vc++}`;
          const op = inst.op === IR.GT ? ">" : inst.op === IR.LT ? "<" : inst.op === IR.EQ ? "===" : "!==";
          this.lines.push(`    const ${v} = ${stVars2.get(inst.operands.left)} ${op} ${stVars2.get(inst.operands.right)};`);
          stVars2.set(inst.id, v);
          break;
        }
      }
    }
  }
  compile() {
    const ir = this.trace.ir;
    const _innerVarNames = /* @__PURE__ */ new Map();
    const emittedVarIds = /* @__PURE__ */ new Set();
    const varNames = {
      set(id, name) {
        _innerVarNames.set(id, name);
        emittedVarIds.add(id);
      },
      get(id) {
        return _innerVarNames.get(id);
      },
      has(id) {
        return _innerVarNames.has(id);
      }
    };
    this._varNames = varNames;
    this._currentIr = ir;
    this._emittedVarIds = emittedVarIds;
    if (this.trace.isFuncTrace) {
      return this._compileFuncTrace(ir, varNames);
    }
    const promotable = this._analyzePromotable();
    const promotedVarNames = /* @__PURE__ */ new Map();
    this._promotedVarNames = promotedVarNames;
    const promotedVarTypes = /* @__PURE__ */ new Map();
    this._promotedVarTypes = promotedVarTypes;
    const usedRefs = /* @__PURE__ */ new Set();
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      const ops = inst.operands;
      for (const key of Object.keys(ops)) {
        if (typeof ops[key] === "number" && key !== "value" && key !== "slot" && key !== "index" && key !== "exitIp" && key !== "constIdx") {
          usedRefs.add(ops[key]);
        }
      }
    }
    const pushInPlace = /* @__PURE__ */ new Set();
    const pushInPlaceStore = /* @__PURE__ */ new Set();
    {
      const refUseCount = /* @__PURE__ */ new Map();
      const countUse = (ref) => {
        if (typeof ref === "number") refUseCount.set(ref, (refUseCount.get(ref) || 0) + 1);
      };
      for (let i = 0; i < ir.length; i++) {
        const inst = ir[i];
        if (!inst) continue;
        const ops = inst.operands;
        for (const key of Object.keys(ops)) {
          if (key === "slot" || key === "index" || key === "exitIp" || key === "constIdx") continue;
          if (typeof ops[key] === "number") countUse(ops[key]);
        }
      }
      for (let i = 0; i < ir.length; i++) {
        const inst = ir[i];
        if (!inst || inst.op !== IR.BUILTIN_PUSH) continue;
        const arrRef = inst.operands.array;
        const arrInst = ir[arrRef];
        if (!arrInst) continue;
        const isGlobal = arrInst.op === IR.LOAD_GLOBAL;
        const isLocal = arrInst.op === IR.LOAD_LOCAL;
        if (!isGlobal && !isLocal) continue;
        const slotKey = isGlobal ? "index" : "slot";
        const sourceSlot = arrInst.operands[slotKey];
        if ((refUseCount.get(arrRef) || 0) !== 1) continue;
        const pushRef = i;
        if ((refUseCount.get(pushRef) || 0) !== 1) continue;
        let storeIdx = -1;
        for (let j = i + 1; j < ir.length; j++) {
          const consumer = ir[j];
          if (!consumer) continue;
          if (isGlobal && consumer.op === IR.STORE_GLOBAL && consumer.operands.value === pushRef && consumer.operands.index === sourceSlot) {
            storeIdx = j;
            break;
          }
          if (isLocal && consumer.op === IR.STORE_LOCAL && consumer.operands.value === pushRef && consumer.operands.slot === sourceSlot) {
            storeIdx = j;
            break;
          }
        }
        if (storeIdx !== -1) {
          pushInPlace.add(i);
          pushInPlaceStore.add(storeIdx);
        }
      }
    }
    const hoistedConsts = /* @__PURE__ */ new Map();
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.CONST_INT || inst.op === IR.CONST_NULL) {
        hoistedConsts.set(i, inst);
      }
    }
    const needsSnapshot = /* @__PURE__ */ new Set();
    {
      for (let i = 0; i < ir.length; i++) {
        const inst = ir[i];
        if (!inst) continue;
        if (inst.op !== IR.LOAD_GLOBAL && inst.op !== IR.LOAD_LOCAL) continue;
        const isGlobal = inst.op === IR.LOAD_GLOBAL;
        const slot = isGlobal ? inst.operands.index : inst.operands.slot;
        const slotKey = isGlobal ? "g:" + slot : "l:" + slot;
        const isPromoted = isGlobal ? promotable.globals.has(slot) : promotable.locals.has(slot);
        if (!isPromoted) continue;
        for (let j = i + 1; j < ir.length; j++) {
          const later = ir[j];
          if (!later) continue;
          const isStoreToSame = isGlobal && later.op === IR.STORE_GLOBAL && later.operands.index === slot || !isGlobal && later.op === IR.STORE_LOCAL && later.operands.slot === slot;
          if (isStoreToSame) {
            for (let k = j + 1; k < ir.length; k++) {
              const user = ir[k];
              if (!user) continue;
              for (const val of Object.values(user.operands)) {
                if (val === i) {
                  needsSnapshot.add(i);
                  break;
                }
              }
              if (needsSnapshot.has(i)) break;
            }
            break;
          }
        }
      }
    }
    this.lines.push('"use strict";');
    this.lines.push("let __iterations = 0;");
    for (const [idx, type] of promotable.globals) {
      const pv = this.freshVar();
      promotedVarNames.set("g:" + idx, pv);
      promotedVarTypes.set("g:" + idx, type);
      this.lines.push(`let ${pv} = __globals[${idx}].value;`);
    }
    for (const [slot, type] of promotable.locals) {
      const pv = this.freshVar();
      promotedVarNames.set("l:" + slot, pv);
      promotedVarTypes.set("l:" + slot, type);
      this.lines.push(`let ${pv} = __stack[__bp + ${slot}].value;`);
    }
    const hasPromoted = promotable.globals.size > 0 || promotable.locals.size > 0;
    if (hasPromoted) {
      const wbStmts = [];
      for (const [idx, type] of promotable.globals) {
        const pv = promotedVarNames.get("g:" + idx);
        if (type === "string") {
          wbStmts.push(`__globals[${idx}] = new __MonkeyString(${pv})`);
        } else {
          wbStmts.push(`__globals[${idx}] = __cachedInteger(${pv})`);
        }
      }
      for (const [slot, type] of promotable.locals) {
        const pv = promotedVarNames.get("l:" + slot);
        if (type === "string") {
          wbStmts.push(`__stack[__bp + ${slot}] = new __MonkeyString(${pv})`);
        } else {
          wbStmts.push(`__stack[__bp + ${slot}] = __cachedInteger(${pv})`);
        }
      }
      this.lines.push(`function __wb(r) { ${wbStmts.join("; ")}; return r; }`);
      const reloadStmts = [];
      for (const [idx, type] of promotable.globals) {
        const pv = promotedVarNames.get("g:" + idx);
        reloadStmts.push(`${pv} = __globals[${idx}].value`);
      }
      for (const [slot, type] of promotable.locals) {
        const pv = promotedVarNames.get("l:" + slot);
        reloadStmts.push(`${pv} = __stack[__bp + ${slot}].value`);
      }
      this.lines.push(`function __reloadPromoted() { ${reloadStmts.join("; ")}; }`);
      this._wbWrap = true;
    } else {
      this._wbWrap = false;
    }
    for (const [idx, inst] of hoistedConsts) {
      const v = this.freshVar();
      varNames.set(idx, v);
      if (inst.op === IR.CONST_INT) {
        this.lines.push(`const ${v} = ${inst.operands.value};`);
      } else if (inst.op === IR.CONST_NULL) {
        this.lines.push(`const ${v} = __NULL;`);
      }
    }
    this._inLoop = false;
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (hoistedConsts.has(i)) continue;
      const v = this.freshVar();
      varNames.set(i, v);
      switch (inst.op) {
        case IR.LOOP_START:
          this.lines.push("loop: while (true) {");
          this.lines.push(`  if ((++__iterations & 0x7F) === 0 && __iterations > 100000) ${this._emitReturn('{ exit: "max_iter" }')}`);
          this._inLoop = true;
          break;
        case IR.LOOP_END:
          if (this.trace.isSideTrace) {
            this.lines.push(`  ${this._emitReturn('{ exit: "loop_back" }')}`);
          } else {
            this.lines.push("  continue loop;");
          }
          break;
        case IR.CONST_INT:
          this.lines.push(`  const ${v} = ${inst.operands.value};`);
          break;
        case IR.CONST_BOOL:
          if (inst.operands.ref !== void 0) {
            const REF_KEYS_FOR_USE = ["ref", "left", "right"];
            const VALUE_IS_REF_FOR_USE = /* @__PURE__ */ new Set([IR.STORE_LOCAL, IR.STORE_GLOBAL]);
            let onlyUsedByGuards = true;
            for (let j = i + 1; j < ir.length; j++) {
              const user = ir[j];
              if (!user) continue;
              let referencesUs = false;
              for (const key of REF_KEYS_FOR_USE) {
                if (user.operands[key] === i) {
                  referencesUs = true;
                  break;
                }
              }
              if (!referencesUs && VALUE_IS_REF_FOR_USE.has(user.op) && user.operands.value === i) {
                referencesUs = true;
              }
              if (referencesUs) {
                if (user.op !== IR.GUARD_TRUTHY && user.op !== IR.GUARD_FALSY) {
                  onlyUsedByGuards = false;
                  break;
                }
              }
            }
            if (onlyUsedByGuards) {
            } else {
              const rawRef = varNames.get(inst.operands.ref);
              this.lines.push(`  const ${v} = ${rawRef} ? __TRUE : __FALSE;`);
            }
          } else {
            this.lines.push(`  const ${v} = ${inst.operands.value} ? __TRUE : __FALSE;`);
          }
          break;
        case IR.CONST_NULL:
          this.lines.push(`  const ${v} = __NULL;`);
          break;
        case IR.CONST_OBJ:
          this.lines.push(`  const ${v} = __consts[${inst.operands.constIdx}];`);
          break;
        case IR.LOAD_LOCAL: {
          const pv = promotedVarNames.get("l:" + inst.operands.slot);
          if (pv) {
            if (needsSnapshot.has(i)) {
              this.lines.push(`  const ${v} = ${pv};`);
              inst._promotedRaw = true;
            } else {
              varNames.set(i, pv);
              inst._promotedRaw = true;
            }
          } else {
            this.lines.push(`  const ${v} = __stack[__bp + ${inst.operands.slot}];`);
          }
          break;
        }
        case IR.LOAD_GLOBAL: {
          const pv = promotedVarNames.get("g:" + inst.operands.index);
          if (pv) {
            if (needsSnapshot.has(i)) {
              this.lines.push(`  const ${v} = ${pv};`);
              inst._promotedRaw = true;
            } else {
              varNames.set(i, pv);
              inst._promotedRaw = true;
            }
          } else {
            this.lines.push(`  const ${v} = __globals[${inst.operands.index}];`);
          }
          break;
        }
        case IR.LOAD_FREE:
          this.lines.push(`  const ${v} = __free[${inst.operands.index}];`);
          break;
        case IR.LOAD_CONST:
          this.lines.push(`  const ${v} = __consts[${inst.operands.index}];`);
          break;
        case IR.STORE_LOCAL: {
          const valRef = varNames.get(inst.operands.value);
          const pv = promotedVarNames.get("l:" + inst.operands.slot);
          if (pv) {
            const valInst = ir[inst.operands.value];
            if (valInst && valInst.op === IR.BOX_INT) {
              this.lines.push(`  ${pv} = ${varNames.get(valInst.operands.ref)};`);
            } else {
              this.lines.push(`  ${pv} = ${valRef};`);
            }
          } else {
            const valInst = ir[inst.operands.value];
            if (valInst && this._isRawInt(valInst)) {
              this.lines.push(`  __stack[__bp + ${inst.operands.slot}] = __cachedInteger(${valRef});`);
            } else {
              this.lines.push(`  __stack[__bp + ${inst.operands.slot}] = ${valRef};`);
            }
          }
          if (usedRefs.has(i)) this.lines.push(`  const ${v} = undefined;`);
          break;
        }
        case IR.STORE_GLOBAL: {
          if (pushInPlaceStore.has(i)) break;
          const valRef = varNames.get(inst.operands.value);
          const pv = promotedVarNames.get("g:" + inst.operands.index);
          if (pv) {
            const valInst = ir[inst.operands.value];
            if (valInst && valInst.op === IR.BOX_INT) {
              this.lines.push(`  ${pv} = ${varNames.get(valInst.operands.ref)};`);
            } else if (valInst && valInst.op === IR.BOX_STRING) {
              this.lines.push(`  ${pv} = ${varNames.get(valInst.operands.ref)};`);
            } else {
              this.lines.push(`  ${pv} = ${valRef};`);
            }
          } else {
            const valInst = ir[inst.operands.value];
            if (valInst && this._isRawInt(valInst)) {
              this.lines.push(`  __globals[${inst.operands.index}] = __cachedInteger(${valRef});`);
            } else {
              this.lines.push(`  __globals[${inst.operands.index}] = ${valRef};`);
            }
          }
          if (usedRefs.has(i)) this.lines.push(`  const ${v} = undefined;`);
          break;
        }
        case IR.GUARD_INT: {
          const refInst = ir[inst.operands.ref];
          if (refInst && refInst._promotedRaw) {
            varNames.set(i, varNames.get(inst.operands.ref));
            inst._promotedRaw = true;
          } else {
            const ref = varNames.get(inst.operands.ref);
            const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : this.trace.startIp;
            this._emitGuardExit(i, exitIp, `!(${ref} instanceof __MonkeyInteger)`);
            this.lines.push(`  const ${v} = ${ref};`);
          }
          break;
        }
        case IR.GUARD_BOOL: {
          const ref = varNames.get(inst.operands.ref);
          const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : this.trace.startIp;
          this._emitGuardExit(i, exitIp, `!(${ref} instanceof __MonkeyBoolean)`);
          this.lines.push(`  const ${v} = ${ref};`);
          break;
        }
        case IR.GUARD_STRING: {
          const refInst = ir[inst.operands.ref];
          if (refInst && refInst._promotedRaw) {
            varNames.set(i, varNames.get(inst.operands.ref));
            inst._promotedRaw = true;
          } else {
            const ref = varNames.get(inst.operands.ref);
            const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : this.trace.startIp;
            this._emitGuardExit(i, exitIp, `!(${ref} instanceof __MonkeyString)`);
            this.lines.push(`  const ${v} = ${ref};`);
          }
          break;
        }
        case IR.GUARD_ARRAY: {
          const ref = varNames.get(inst.operands.ref);
          const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : this.trace.startIp;
          this._emitGuardExit(i, exitIp, `!(${ref} && ${ref}.elements)`);
          this.lines.push(`  const ${v} = ${ref};`);
          break;
        }
        case IR.GUARD_BOUNDS: {
          const arr = varNames.get(inst.operands.left);
          const idx = varNames.get(inst.operands.right);
          const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : this.trace.startIp;
          if (inst._upperBoundProven) {
            this._emitGuardExit(i, exitIp, `(${idx} < 0)`);
          } else {
            this._emitGuardExit(i, exitIp, `(${idx} < 0 || ${idx} >= ${arr}.elements.length)`);
          }
          break;
        }
        case IR.GUARD_CLOSURE: {
          const closureRef = varNames.get(inst.operands.ref);
          const fnId = inst.operands.fnId;
          const exitIp = inst.operands.exitIp;
          if (exitIp === -1) {
            this.lines.push(`  if (${closureRef}.fn.id !== ${fnId}) {`);
            this.lines.push(`    return { exit: "invalidate", guardIdx: ${i} };`);
            this.lines.push(`  }`);
          } else {
            this._emitGuardExit(i, exitIp, `(${closureRef}.fn.id !== ${fnId})`);
          }
          break;
        }
        case IR.INDEX_ARRAY: {
          const arr = varNames.get(inst.operands.left);
          const idx = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = ${arr}.elements[${idx}];`);
          break;
        }
        case IR.GUARD_HASH: {
          const ref = varNames.get(inst.operands.ref);
          const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : this.trace.startIp;
          this._emitGuardExit(i, exitIp, `!(${ref} && ${ref}.pairs)`);
          this.lines.push(`  const ${v} = ${ref};`);
          break;
        }
        case IR.INDEX_HASH: {
          const hash = varNames.get(inst.operands.left);
          const key = varNames.get(inst.operands.right);
          const keyRef = inst.operands.right;
          if (!this._hashKeyCache) this._hashKeyCache = /* @__PURE__ */ new Map();
          let hashKeyVar;
          if (this._hashKeyCache.has(keyRef)) {
            hashKeyVar = this._hashKeyCache.get(keyRef);
          } else {
            hashKeyVar = `__hk${keyRef}`;
            this.lines.push(`  const ${hashKeyVar} = ${key}.fastHashKey();`);
            this._hashKeyCache.set(keyRef, hashKeyVar);
          }
          this.lines.push(`  const ${v}_pair = ${hash}.pairs.get(${hashKeyVar});`);
          this.lines.push(`  const ${v} = ${v}_pair ? ${v}_pair.value : __NULL;`);
          break;
        }
        case IR.BUILTIN_LEN: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  const ${v} = ${ref}.elements ? ${ref}.elements.length : ${ref}.value.length;`);
          break;
        }
        case IR.BUILTIN_PUSH: {
          const arr = varNames.get(inst.operands.array);
          const val = varNames.get(inst.operands.value);
          if (pushInPlace.has(i)) {
            const valInst = ir[inst.operands.value];
            if (valInst && this._isRawInt(valInst)) {
              this.lines.push(`  ${arr}.elements.push(__cachedInteger(${val}));`);
            } else {
              this.lines.push(`  ${arr}.elements.push(${val});`);
            }
            varNames.set(i, arr);
          } else {
            this.lines.push(`  const ${v} = new __MonkeyArray([...${arr}.elements, ${val}]);`);
          }
          break;
        }
        case IR.GUARD_TRUTHY: {
          const ref = varNames.get(inst.operands.ref);
          const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : this.trace.startIp;
          const refInst = ir[inst.operands.ref];
          let condition;
          if (refInst && refInst.op === IR.CONST_BOOL && refInst.operands.ref !== void 0) {
            const rawBoolVar = varNames.get(refInst.operands.ref);
            condition = `!${rawBoolVar}`;
          } else {
            condition = `typeof ${ref} === 'boolean' ? !${ref} : !__isTruthy(${ref})`;
          }
          this._emitGuardExit(i, exitIp, condition, "guard_falsy");
          if (usedRefs.has(i)) this.lines.push(`  const ${v} = true;`);
          break;
        }
        case IR.GUARD_FALSY: {
          const ref = varNames.get(inst.operands.ref);
          const exitIp = inst.operands.exitIp != null ? inst.operands.exitIp : this.trace.startIp;
          const refInst = ir[inst.operands.ref];
          let condition;
          if (refInst && refInst.op === IR.CONST_BOOL && refInst.operands.ref !== void 0) {
            const rawBoolVar = varNames.get(refInst.operands.ref);
            condition = `${rawBoolVar}`;
          } else {
            condition = `typeof ${ref} === 'boolean' ? ${ref} : __isTruthy(${ref})`;
          }
          this._emitGuardExit(i, exitIp, condition, "guard_truthy");
          if (usedRefs.has(i)) this.lines.push(`  const ${v} = true;`);
          break;
        }
        case IR.UNBOX_INT: {
          const refInst = ir[inst.operands.ref];
          if (refInst && refInst._promotedRaw) {
            varNames.set(i, varNames.get(inst.operands.ref));
          } else {
            const ref = varNames.get(inst.operands.ref);
            this.lines.push(`  const ${v} = ${ref}.value;`);
          }
          break;
        }
        case IR.BOX_INT: {
          const ref = varNames.get(inst.operands.ref);
          let usedByNonPromotedStore = false;
          let usedByOtherInst = false;
          for (let j = i + 1; j < ir.length; j++) {
            const user = ir[j];
            if (!user) continue;
            const ops = user.operands;
            for (const key of Object.keys(ops)) {
              if (ops[key] === i) {
                if ((user.op === IR.STORE_GLOBAL || user.op === IR.STORE_LOCAL) && key === "value") {
                  const storeKey = user.op === IR.STORE_GLOBAL ? "g:" + user.operands.index : "l:" + user.operands.slot;
                  if (!promotedVarNames.has(storeKey)) usedByNonPromotedStore = true;
                } else {
                  usedByOtherInst = true;
                }
              }
            }
          }
          if (promotedVarNames.size > 0 && !usedByNonPromotedStore && !usedByOtherInst) {
          } else {
            this.lines.push(`  const ${v} = __cachedInteger(${ref});`);
          }
          break;
        }
        case IR.UNBOX_STRING: {
          const ref = varNames.get(inst.operands.ref);
          const refInst = ir[inst.operands.ref];
          if (refInst && refInst._promotedRaw) {
            varNames.set(i, ref);
          } else {
            this.lines.push(`  const ${v} = ${ref}.value;`);
          }
          break;
        }
        case IR.BOX_STRING: {
          const ref = varNames.get(inst.operands.ref);
          let usedByNonPromotedStore = false;
          let usedByOtherInst = false;
          for (let j = i + 1; j < ir.length; j++) {
            const user = ir[j];
            if (!user) continue;
            const ops = user.operands;
            for (const key of Object.keys(ops)) {
              if (ops[key] === i) {
                if ((user.op === IR.STORE_GLOBAL || user.op === IR.STORE_LOCAL) && key === "value") {
                  const storeKey = user.op === IR.STORE_GLOBAL ? "g:" + user.operands.index : "l:" + user.operands.slot;
                  if (!promotedVarNames.has(storeKey)) usedByNonPromotedStore = true;
                } else {
                  usedByOtherInst = true;
                }
              }
            }
          }
          if (promotedVarNames.size > 0 && !usedByNonPromotedStore && !usedByOtherInst) {
          } else {
            this.lines.push(`  const ${v} = new __MonkeyString(${ref});`);
          }
          break;
        }
        case IR.ADD_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} + ${r});`);
          break;
        }
        case IR.SUB_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} - ${r});`);
          break;
        }
        case IR.MUL_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} * ${r});`);
          break;
        }
        case IR.DIV_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = Math.trunc(${l} / ${r});`);
          break;
        }
        case IR.MOD_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} % ${r});`);
          break;
        }
        case IR.EQ: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = ${l} === ${r};`);
          break;
        }
        case IR.NEQ: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = ${l} !== ${r};`);
          break;
        }
        case IR.GT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = ${l} > ${r};`);
          break;
        }
        case IR.LT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = ${l} < ${r};`);
          break;
        }
        case IR.NEG: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  const ${v} = -${ref};`);
          break;
        }
        case IR.NOT: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  const ${v} = (typeof ${ref} === 'boolean') ? !${ref} : !__isTruthy(${ref});`);
          break;
        }
        case IR.CONCAT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          const lInst = ir[inst.operands.left];
          const rInst = ir[inst.operands.right];
          const lRaw = lInst && (lInst.op === IR.UNBOX_STRING || lInst._promotedRaw);
          const rRaw = rInst && (rInst.op === IR.UNBOX_STRING || rInst._promotedRaw);
          if (lRaw && rRaw) {
            this.lines.push(`  const ${v} = (${l} + ${r});`);
          } else {
            this.lines.push(`  const ${v} = new __MonkeyString(${l}.value + ${r}.value);`);
          }
          break;
        }
        case IR.CALL:
          this.lines.push(`  ${this._emitReturn(`{ exit: "call", ip: ${this.trace.startIp} }`)}`);
          break;
        case IR.SELF_CALL: {
          const argRefs = inst.operands.args;
          const argVars = argRefs.map((ref) => {
            const refInst = ir[ref];
            if (refInst && this._isRawInt(refInst)) {
              return `__cachedInteger(${varNames.get(ref)})`;
            }
            return varNames.get(ref);
          });
          this.lines.push(`  const ${v}_boxed = __selfCall(${argVars.join(", ")});`);
          this.lines.push(`  const ${v} = ${v}_boxed;`);
          break;
        }
        case IR.FUNC_RETURN: {
          const ref = varNames.get(inst.operands.ref);
          const refInst = ir[inst.operands.ref];
          if (refInst && this._isRawInt(refInst)) {
            this.lines.push(`  return __cachedInteger(${ref});`);
          } else {
            this.lines.push(`  return ${ref};`);
          }
          break;
        }
        case IR.EXEC_TRACE: {
          for (const idx of promotable.globals) {
            const pv = promotedVarNames.get("g:" + idx);
            this.lines.push(`  __globals[${idx}] = __cachedInteger(${pv});`);
          }
          for (const slot of promotable.locals) {
            const pv = promotedVarNames.get("l:" + slot);
            this.lines.push(`  __stack[__bp + ${slot}] = __cachedInteger(${pv});`);
          }
          this.lines.push(`  const ${v}_inner = __consts[${inst.operands.constIdx}];`);
          this.lines.push(`  let ${v} = ${v}_inner(__stack, __sp, __bp, __globals, __consts, __free, __MonkeyInteger, __MonkeyBoolean, __MonkeyString, __MonkeyArray, __TRUE, __FALSE, __NULL, __cachedInteger, __internString, __isTruthy, __sideTraces);`);
          for (const idx of promotable.globals) {
            const pv = promotedVarNames.get("g:" + idx);
            this.lines.push(`  ${pv} = __globals[${idx}].value;`);
          }
          for (const slot of promotable.locals) {
            const pv = promotedVarNames.get("l:" + slot);
            this.lines.push(`  ${pv} = __stack[__bp + ${slot}].value;`);
          }
          break;
        }
        default:
          this.lines.push(`  /* unknown IR: ${inst.op} */`);
      }
    }
    this.lines.push("}");
    const body = this.lines.join("\n");
    this.trace._compiledSource = body;
    try {
      const fn = new Function(
        "__stack",
        "__sp",
        "__bp",
        "__globals",
        "__consts",
        "__free",
        "__MonkeyInteger",
        "__MonkeyBoolean",
        "__MonkeyString",
        "__MonkeyArray",
        "__TRUE",
        "__FALSE",
        "__NULL",
        "__cachedInteger",
        "__internString",
        "__isTruthy",
        "__sideTraces",
        body
      );
      return fn;
    } catch (e) {
      return null;
    }
  }
  // Compile a function trace — straight-line code, takes args, returns value
  _compileFuncTrace(ir, varNames) {
    this.lines.push('"use strict";');
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      const v = this.freshVar();
      varNames.set(i, v);
      switch (inst.op) {
        case IR.LOAD_LOCAL: {
          this.lines.push(`  const ${v} = __stack[__bp + ${inst.operands.slot}];`);
          break;
        }
        case IR.LOAD_GLOBAL: {
          this.lines.push(`  const ${v} = __globals[${inst.operands.index}];`);
          break;
        }
        case IR.LOAD_FREE:
          this.lines.push(`  const ${v} = __free[${inst.operands.index}];`);
          break;
        case IR.LOAD_CONST:
          this.lines.push(`  const ${v} = __consts[${inst.operands.index}];`);
          break;
        case IR.CONST_INT:
          this.lines.push(`  const ${v} = ${inst.operands.value};`);
          break;
        case IR.CONST_BOOL:
          if (inst.operands.ref !== void 0) {
            const rawRef = varNames.get(inst.operands.ref);
            this.lines.push(`  const ${v} = ${rawRef} ? __TRUE : __FALSE;`);
          } else {
            this.lines.push(`  const ${v} = ${inst.operands.value} ? __TRUE : __FALSE;`);
          }
          break;
        case IR.CONST_NULL:
          this.lines.push(`  const ${v} = __NULL;`);
          break;
        case IR.CONST_OBJ:
          this.lines.push(`  const ${v} = __consts[${inst.operands.constIdx}];`);
          break;
        case IR.STORE_LOCAL: {
          const valRef = varNames.get(inst.operands.value);
          const valInst = ir[inst.operands.value];
          if (valInst && this._isRawInt(valInst)) {
            this.lines.push(`  __stack[__bp + ${inst.operands.slot}] = __cachedInteger(${valRef});`);
          } else {
            this.lines.push(`  __stack[__bp + ${inst.operands.slot}] = ${valRef};`);
          }
          this.lines.push(`  const ${v} = undefined;`);
          break;
        }
        case IR.STORE_GLOBAL: {
          const valRef = varNames.get(inst.operands.value);
          const valInst = ir[inst.operands.value];
          if (valInst && this._isRawInt(valInst)) {
            this.lines.push(`  __globals[${inst.operands.index}] = __cachedInteger(${valRef});`);
          } else {
            this.lines.push(`  __globals[${inst.operands.index}] = ${valRef};`);
          }
          this.lines.push(`  const ${v} = undefined;`);
          break;
        }
        case IR.GUARD_INT: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  if (!(${ref} instanceof __MonkeyInteger)) return { exit: "guard", ip: 0 };`);
          this.lines.push(`  const ${v} = ${ref};`);
          break;
        }
        case IR.GUARD_BOOL: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  if (!(${ref} instanceof __MonkeyBoolean)) return { exit: "guard", ip: 0 };`);
          this.lines.push(`  const ${v} = ${ref};`);
          break;
        }
        case IR.GUARD_TRUTHY: {
          const ref = varNames.get(inst.operands.ref);
          const refInst = ir[inst.operands.ref];
          let condition;
          if (refInst && refInst.op === IR.CONST_BOOL && refInst.operands.ref !== void 0) {
            condition = `!${varNames.get(refInst.operands.ref)}`;
          } else {
            condition = `typeof ${ref} === 'boolean' ? !${ref} : !__isTruthy(${ref})`;
          }
          this.lines.push(`  if (${condition}) return { exit: "guard", ip: 0 };`);
          this.lines.push(`  const ${v} = true;`);
          break;
        }
        case IR.GUARD_FALSY: {
          const ref = varNames.get(inst.operands.ref);
          const refInst = ir[inst.operands.ref];
          let condition;
          if (refInst && refInst.op === IR.CONST_BOOL && refInst.operands.ref !== void 0) {
            condition = `${varNames.get(refInst.operands.ref)}`;
          } else {
            condition = `typeof ${ref} === 'boolean' ? ${ref} : __isTruthy(${ref})`;
          }
          this.lines.push(`  if (${condition}) return { exit: "guard", ip: 0 };`);
          this.lines.push(`  const ${v} = true;`);
          break;
        }
        case IR.UNBOX_INT: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  const ${v} = ${ref}.value;`);
          break;
        }
        case IR.BOX_INT: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  const ${v} = __cachedInteger(${ref});`);
          break;
        }
        case IR.UNBOX_STRING: {
          const ref = varNames.get(inst.operands.ref);
          const refInst = ir[inst.operands.ref];
          if (refInst && refInst._promotedRaw) {
            varNames.set(inst.id, ref);
          } else {
            this.lines.push(`  const ${v} = ${ref}.value;`);
          }
          break;
        }
        case IR.BOX_STRING: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  const ${v} = new __MonkeyString(${ref});`);
          break;
        }
        case IR.ADD_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} + ${r});`);
          break;
        }
        case IR.SUB_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} - ${r});`);
          break;
        }
        case IR.MUL_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} * ${r});`);
          break;
        }
        case IR.DIV_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = Math.trunc(${l} / ${r});`);
          break;
        }
        case IR.MOD_INT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = (${l} % ${r});`);
          break;
        }
        case IR.EQ: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = ${l} === ${r};`);
          break;
        }
        case IR.NEQ: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = ${l} !== ${r};`);
          break;
        }
        case IR.GT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = ${l} > ${r};`);
          break;
        }
        case IR.LT: {
          const l = varNames.get(inst.operands.left);
          const r = varNames.get(inst.operands.right);
          this.lines.push(`  const ${v} = ${l} < ${r};`);
          break;
        }
        case IR.NEG: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  const ${v} = -${ref};`);
          break;
        }
        case IR.NOT: {
          const ref = varNames.get(inst.operands.ref);
          this.lines.push(`  const ${v} = (typeof ${ref} === 'boolean') ? !${ref} : !__isTruthy(${ref});`);
          break;
        }
        case IR.CONCAT: {
          const l = stVars.get(inst.operands.left) || varNames.get(inst.operands.left);
          const r = stVars.get(inst.operands.right) || varNames.get(inst.operands.right);
          const lInst = stIR[inst.operands.left] || ir[inst.operands.left];
          const rInst = stIR[inst.operands.right] || ir[inst.operands.right];
          const lRaw = lInst && (lInst.op === IR.UNBOX_STRING || lInst._promotedRaw);
          const rRaw = rInst && (rInst.op === IR.UNBOX_STRING || rInst._promotedRaw);
          if (lRaw && rRaw) {
            this.lines.push(`    const ${v} = (${l} + ${r});`);
          } else {
            this.lines.push(`    const ${v} = new __MonkeyString(${l}.value + ${r}.value);`);
          }
          break;
        }
        case IR.SELF_CALL: {
          const argRefs = inst.operands.args;
          const argVars = argRefs.map((ref) => {
            const refInst = ir[ref];
            if (refInst && this._isRawInt(refInst)) {
              return `__cachedInteger(${varNames.get(ref)})`;
            }
            return varNames.get(ref);
          });
          this.lines.push(`  const ${v} = __selfCall(${argVars.join(", ")});`);
          break;
        }
        case IR.FUNC_RETURN: {
          const ref = varNames.get(inst.operands.ref);
          const refInst = ir[inst.operands.ref];
          if (refInst && this._isRawInt(refInst)) {
            this.lines.push(`  return __cachedInteger(${ref});`);
          } else {
            this.lines.push(`  return ${ref};`);
          }
          break;
        }
        // Skip loop control IR in func traces
        case IR.LOOP_START:
        case IR.LOOP_END:
          break;
        default:
          this.lines.push(`  /* unknown IR: ${inst.op} */`);
      }
    }
    const body = this.lines.join("\n");
    this.trace._compiledSource = body;
    try {
      const fn = new Function(
        "__stack",
        "__sp",
        "__bp",
        "__globals",
        "__consts",
        "__free",
        "__MonkeyInteger",
        "__MonkeyBoolean",
        "__MonkeyString",
        "__TRUE",
        "__FALSE",
        "__NULL",
        "__cachedInteger",
        "__internString",
        "__isTruthy",
        "__selfCall",
        body
      );
      return fn;
    } catch (e) {
      return null;
    }
  }
};
var TraceOptimizer = class {
  constructor(trace) {
    this.trace = trace;
  }
  // Run all optimization passes in order
  optimize() {
    this.storeToLoadForwarding();
    this.boxUnboxElimination();
    this.commonSubexpressionElimination();
    this.unboxDeduplication();
    this.redundantGuardElimination();
    this.rangeCheckElimination();
    this.constantPropagation();
    this.constantFolding();
    this.algebraicSimplification();
    this.deadStoreElimination();
    this.loopInvariantCodeMotion();
    this.deadCodeElimination();
    return this.trace;
  }
  // --- Pass 0: Store-to-Load Forwarding ---
  // If we store a value to a global/local and later load from the same slot
  // (with no intervening store to that slot), replace the load with the stored value.
  // This eliminates the box→store→load→guard→unbox chain across loop iterations.
  storeToLoadForwarding() {
    const ir = this.trace.ir;
    const lastStore = /* @__PURE__ */ new Map();
    let forwarded = 0;
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.STORE_LOCAL) {
        lastStore.set(`local:${inst.operands.slot}`, inst.operands.value);
        continue;
      }
      if (inst.op === IR.STORE_GLOBAL) {
        lastStore.set(`global:${inst.operands.index}`, inst.operands.value);
        continue;
      }
      if (inst.op === IR.LOAD_LOCAL) {
        const key = `local:${inst.operands.slot}`;
        const storedRef = lastStore.get(key);
        if (storedRef !== void 0) {
          this._replaceRef(ir, i, storedRef);
          ir[i] = null;
          forwarded++;
        }
        continue;
      }
      if (inst.op === IR.LOAD_GLOBAL) {
        const key = `global:${inst.operands.index}`;
        const storedRef = lastStore.get(key);
        if (storedRef !== void 0) {
          this._replaceRef(ir, i, storedRef);
          ir[i] = null;
          forwarded++;
        }
        continue;
      }
      if (inst.op === IR.CALL || inst.op === IR.SELF_CALL) {
        lastStore.clear();
      }
    }
    if (forwarded > 0) this._compact();
    return forwarded;
  }
  // Replace all references to oldRef with newRef in subsequent instructions
  _replaceRef(ir, oldRef, newRef) {
    const REF_KEYS = ["ref", "left", "right"];
    const VALUE_IS_REF = /* @__PURE__ */ new Set([IR.STORE_LOCAL, IR.STORE_GLOBAL]);
    for (let i = oldRef + 1; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      const ops = inst.operands;
      for (const key of REF_KEYS) {
        if (ops[key] === oldRef) ops[key] = newRef;
      }
      if (ops.array === oldRef) ops.array = newRef;
      if (ops.value === oldRef && (VALUE_IS_REF.has(inst.op) || inst.op === IR.BUILTIN_PUSH)) {
        ops.value = newRef;
      }
      if (Array.isArray(ops.args)) {
        for (let j = 0; j < ops.args.length; j++) {
          if (ops.args[j] === oldRef) ops.args[j] = newRef;
        }
      }
      if (inst.snapshot) {
        for (const [slot, ref] of inst.snapshot.locals) {
          if (ref === oldRef) inst.snapshot.locals.set(slot, newRef);
        }
        for (const [idx, ref] of inst.snapshot.globals) {
          if (ref === oldRef) inst.snapshot.globals.set(idx, newRef);
        }
      }
    }
  }
  // --- Pass 0.5: Box-Unbox Elimination ---
  // UNBOX_INT(BOX_INT(x)) → x. Also BOX_INT(UNBOX_INT(x)) → x if x is known integer.
  // This is common after store-to-load forwarding: store(BOX_INT(raw)) → load eliminated →
  // but downstream still does UNBOX_INT on the BOX_INT ref.
  boxUnboxElimination() {
    const ir = this.trace.ir;
    let eliminated = 0;
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.UNBOX_INT) {
        const refInst = ir[inst.operands.ref];
        if (refInst && refInst.op === IR.BOX_INT) {
          this._replaceRef(ir, i, refInst.operands.ref);
          ir[i] = null;
          eliminated++;
          continue;
        }
      }
      if (inst.op === IR.BOX_INT) {
        const refInst = ir[inst.operands.ref];
        if (refInst && refInst.op === IR.UNBOX_INT) {
          this._replaceRef(ir, i, refInst.operands.ref);
          ir[i] = null;
          eliminated++;
          continue;
        }
      }
      if (inst.op === IR.UNBOX_STRING) {
        const refInst = ir[inst.operands.ref];
        if (refInst && refInst.op === IR.BOX_STRING) {
          this._replaceRef(ir, i, refInst.operands.ref);
          ir[i] = null;
          eliminated++;
          continue;
        }
      }
      if (inst.op === IR.BOX_STRING) {
        const refInst = ir[inst.operands.ref];
        if (refInst && refInst.op === IR.UNBOX_STRING) {
          this._replaceRef(ir, i, refInst.operands.ref);
          ir[i] = null;
          eliminated++;
          continue;
        }
      }
    }
    if (eliminated > 0) this._compact();
    return eliminated;
  }
  // --- Pass 2.25: Algebraic Simplification (Strength Reduction) ---
  // Simplify arithmetic with identity/absorbing elements:
  //   x + 0 → x,  0 + x → x,  x - 0 → x
  //   x * 1 → x,  1 * x → x,  x * 0 → 0,  0 * x → 0
  //   x / 1 → x
  // Also: x - x → 0, x * 2 → x + x (cheaper on some architectures)
  algebraicSimplification() {
    const ir = this.trace.ir;
    const constVals = /* @__PURE__ */ new Map();
    for (let i = 0; i < ir.length; i++) {
      if (ir[i] && ir[i].op === IR.CONST_INT) {
        constVals.set(i, ir[i].operands.value);
      }
    }
    let simplified = 0;
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      const { left, right } = inst.operands;
      const lv = constVals.get(left);
      const rv = constVals.get(right);
      switch (inst.op) {
        case IR.ADD_INT:
          if (rv === 0) {
            this._replaceRef(ir, i, left);
            ir[i] = null;
            simplified++;
          } else if (lv === 0) {
            this._replaceRef(ir, i, right);
            ir[i] = null;
            simplified++;
          }
          break;
        case IR.SUB_INT:
          if (rv === 0) {
            this._replaceRef(ir, i, left);
            ir[i] = null;
            simplified++;
          } else if (left === right) {
            inst.op = IR.CONST_INT;
            inst.operands = { value: 0 };
            constVals.set(i, 0);
            simplified++;
          }
          break;
        case IR.MUL_INT:
          if (rv === 1) {
            this._replaceRef(ir, i, left);
            ir[i] = null;
            simplified++;
          } else if (lv === 1) {
            this._replaceRef(ir, i, right);
            ir[i] = null;
            simplified++;
          } else if (rv === 0 || lv === 0) {
            inst.op = IR.CONST_INT;
            inst.operands = { value: 0 };
            constVals.set(i, 0);
            simplified++;
          } else if (rv === 2) {
            inst.op = IR.ADD_INT;
            inst.operands = { left, right: left };
            simplified++;
          } else if (lv === 2) {
            inst.op = IR.ADD_INT;
            inst.operands = { left: right, right };
            simplified++;
          }
          break;
        case IR.DIV_INT:
          if (rv === 1) {
            this._replaceRef(ir, i, left);
            ir[i] = null;
            simplified++;
          } else if (left === right) {
            inst.op = IR.CONST_INT;
            inst.operands = { value: 1 };
            constVals.set(i, 1);
            simplified++;
          }
          break;
        case IR.MOD_INT:
          if (rv === 1) {
            inst.op = IR.CONST_INT;
            inst.operands = { value: 0 };
            constVals.set(i, 0);
            simplified++;
          }
          break;
        case IR.NEG: {
          const { ref } = inst.operands;
          const refInst = ir[ref];
          if (refInst && refInst.op === IR.NEG) {
            this._replaceRef(ir, i, refInst.operands.ref);
            ir[i] = null;
            simplified++;
          } else if (constVals.has(ref)) {
            inst.op = IR.CONST_INT;
            inst.operands = { value: -constVals.get(ref) };
            constVals.set(i, inst.operands.value);
            simplified++;
          }
          break;
        }
      }
    }
    if (simplified > 0) this._compact();
    return simplified;
  }
  // --- Pass 2.5: Dead Store Elimination ---
  // If slot X is stored twice with no intervening load of slot X, the first store is dead.
  // Also: if a store is to a slot that is never loaded in the trace, it may be dead
  // (but we keep it for safety — the interpreter may need it on trace exit via snapshots).
  deadStoreElimination() {
    const ir = this.trace.ir;
    const lastStore = /* @__PURE__ */ new Map();
    const deadStores = /* @__PURE__ */ new Set();
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.STORE_LOCAL) {
        const key = `local:${inst.operands.slot}`;
        if (lastStore.has(key)) {
          deadStores.add(lastStore.get(key));
        }
        lastStore.set(key, i);
        continue;
      }
      if (inst.op === IR.STORE_GLOBAL) {
        const key = `global:${inst.operands.index}`;
        if (lastStore.has(key)) {
          deadStores.add(lastStore.get(key));
        }
        lastStore.set(key, i);
        continue;
      }
      if (inst.op === IR.LOAD_LOCAL) {
        lastStore.delete(`local:${inst.operands.slot}`);
        continue;
      }
      if (inst.op === IR.LOAD_GLOBAL) {
        lastStore.delete(`global:${inst.operands.index}`);
        continue;
      }
      if (inst.op === IR.CALL || inst.op === IR.SELF_CALL) {
        lastStore.clear();
      }
      if (inst.op === IR.LOOP_END) {
        lastStore.clear();
      }
    }
    let eliminated = 0;
    for (const idx of deadStores) {
      ir[idx] = null;
      eliminated++;
    }
    if (eliminated > 0) this._compact();
    return eliminated;
  }
  // --- Pass 3.5: Loop-Invariant Code Motion ---
  // Move instructions that don't depend on loop-variant values above LOOP_START.
  // An instruction is loop-invariant if all its operand refs are defined before the loop
  // or are themselves loop-invariant, AND it has no side effects.
  loopInvariantCodeMotion() {
    const ir = this.trace.ir;
    let loopStart = -1;
    for (let i = 0; i < ir.length; i++) {
      if (ir[i] && ir[i].op === IR.LOOP_START) {
        loopStart = i;
        break;
      }
    }
    if (loopStart < 0) return 0;
    const preLoopRefs = /* @__PURE__ */ new Set();
    for (let i = 0; i < loopStart; i++) {
      if (ir[i]) preLoopRefs.add(i);
    }
    const SIDE_EFFECTS = /* @__PURE__ */ new Set([
      IR.STORE_LOCAL,
      IR.STORE_GLOBAL,
      IR.CALL,
      IR.SELF_CALL,
      IR.LOOP_START,
      IR.LOOP_END,
      IR.EXEC_TRACE,
      IR.FUNC_RETURN,
      IR.INDEX_ARRAY,
      // Can fail if bounds guard hasn't run; don't hoist
      IR.BUILTIN_PUSH
      // Creates new array; side-effecting
    ]);
    const HOISTABLE_GUARDS = /* @__PURE__ */ new Set([
      IR.GUARD_INT,
      IR.GUARD_BOOL,
      IR.GUARD_STRING,
      IR.GUARD_ARRAY,
      IR.GUARD_HASH,
      IR.GUARD_TRUTHY,
      IR.GUARD_FALSY,
      IR.GUARD_BOUNDS,
      IR.GUARD_CLOSURE
    ]);
    const invariant = /* @__PURE__ */ new Set();
    const REF_KEYS = ["ref", "left", "right"];
    const VALUE_IS_REF = /* @__PURE__ */ new Set([IR.STORE_LOCAL, IR.STORE_GLOBAL]);
    const writtenLocals = /* @__PURE__ */ new Set();
    const writtenGlobals = /* @__PURE__ */ new Set();
    for (let i = loopStart + 1; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.STORE_LOCAL) writtenLocals.add(inst.operands.slot);
      if (inst.op === IR.STORE_GLOBAL) writtenGlobals.add(inst.operands.index);
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = loopStart + 1; i < ir.length; i++) {
        const inst = ir[i];
        if (!inst || invariant.has(i) || SIDE_EFFECTS.has(inst.op)) continue;
        if (inst.op === IR.LOAD_LOCAL && writtenLocals.has(inst.operands.slot)) continue;
        if (inst.op === IR.LOAD_GLOBAL && writtenGlobals.has(inst.operands.index)) continue;
        const ops = inst.operands;
        let allInvariant = true;
        for (const key of REF_KEYS) {
          if (typeof ops[key] === "number") {
            if (!preLoopRefs.has(ops[key]) && !invariant.has(ops[key])) {
              allInvariant = false;
              break;
            }
          }
        }
        if (allInvariant && typeof ops.value === "number" && VALUE_IS_REF.has(inst.op)) {
          if (!preLoopRefs.has(ops.value) && !invariant.has(ops.value)) {
            allInvariant = false;
          }
        }
        if (allInvariant) {
          invariant.add(i);
          changed = true;
        }
      }
    }
    if (invariant.size === 0) return 0;
    const preLoop = [];
    const hoisted = [];
    const loopBody = [];
    for (let i = 0; i < ir.length; i++) {
      if (!ir[i]) continue;
      if (i < loopStart) {
        preLoop.push(ir[i]);
      } else if (i === loopStart) {
        loopBody.push(ir[i]);
      } else if (invariant.has(i)) {
        hoisted.push(ir[i]);
      } else {
        loopBody.push(ir[i]);
      }
    }
    const newIr = [...preLoop, ...hoisted, ...loopBody];
    const remap = /* @__PURE__ */ new Map();
    let newIdx = 0;
    for (let i = 0; i < ir.length; i++) {
      if (!ir[i]) continue;
    }
    const oldToNew = /* @__PURE__ */ new Map();
    let pos = 0;
    for (let i = 0; i < ir.length; i++) {
      if (!ir[i]) continue;
      if (i < loopStart) {
        oldToNew.set(i, pos++);
      }
    }
    const hoistedOldIndices = [...invariant].sort((a, b) => a - b);
    for (const oldIdx of hoistedOldIndices) {
      oldToNew.set(oldIdx, pos++);
    }
    oldToNew.set(loopStart, pos++);
    for (let i = loopStart + 1; i < ir.length; i++) {
      if (!ir[i] || invariant.has(i)) continue;
      oldToNew.set(i, pos++);
    }
    for (const inst of newIr) {
      inst.id = oldToNew.get(inst.id) !== void 0 ? oldToNew.get(inst.id) : inst.id;
      const ops = inst.operands;
      for (const key of REF_KEYS) {
        if (typeof ops[key] === "number" && oldToNew.has(ops[key])) {
          ops[key] = oldToNew.get(ops[key]);
        }
      }
      if (typeof ops.array === "number" && oldToNew.has(ops.array)) {
        ops.array = oldToNew.get(ops.array);
      }
      if (typeof ops.value === "number" && (VALUE_IS_REF.has(inst.op) || inst.op === IR.BUILTIN_PUSH) && oldToNew.has(ops.value)) {
        ops.value = oldToNew.get(ops.value);
      }
      if (Array.isArray(ops.args)) {
        ops.args = ops.args.map((ref) => oldToNew.has(ref) ? oldToNew.get(ref) : ref);
      }
      if (inst.snapshot) {
        for (const [slot, ref] of inst.snapshot.locals) {
          if (oldToNew.has(ref)) inst.snapshot.locals.set(slot, oldToNew.get(ref));
        }
        for (const [idx, ref] of inst.snapshot.globals) {
          if (oldToNew.has(ref)) inst.snapshot.globals.set(idx, oldToNew.get(ref));
        }
      }
    }
    for (let i = 0; i < newIr.length; i++) {
      newIr[i].id = i;
    }
    this.trace.ir = newIr;
    return invariant.size;
  }
  // --- Pass 1: Redundant Guard Elimination ---
  // If a value has already been guarded as a type, subsequent guards for the
  // same ref and type are redundant. Also, constants don't need guards at all.
  // This is the biggest win — recording often emits duplicate guards for values
  // that are loaded and used multiple times in a loop iteration.
  // --- Pass 1: Common Subexpression Elimination ---
  // If two instructions have the same opcode and operands, the second is redundant.
  // Works for pure ops (loads, arithmetic, unbox, constants) — not stores, guards, or control flow.
  // For loads: only valid if no intervening store to the same slot.
  //
  // IMPORTANT: We must NOT mutate operands during the scan (via _replaceRef) because
  // that changes keys of not-yet-processed instructions, causing false CSE matches.
  // Instead, we collect a remap table and apply it in a single pass afterward.
  commonSubexpressionElimination() {
    const ir = this.trace.ir;
    const PURE_OPS = /* @__PURE__ */ new Set([
      IR.CONST_INT,
      IR.CONST_BOOL,
      IR.CONST_NULL,
      IR.CONST_OBJ,
      IR.LOAD_LOCAL,
      IR.LOAD_GLOBAL,
      IR.LOAD_FREE,
      IR.LOAD_CONST,
      IR.ADD_INT,
      IR.SUB_INT,
      IR.MUL_INT,
      IR.DIV_INT,
      IR.MOD_INT,
      IR.CONCAT,
      IR.EQ,
      IR.NEQ,
      IR.GT,
      IR.LT,
      IR.NEG,
      IR.NOT,
      IR.UNBOX_INT,
      IR.BOX_INT,
      IR.UNBOX_STRING,
      IR.BOX_STRING
    ]);
    const key = (inst) => {
      const ops = inst.operands;
      if (inst.op === IR.CONST_INT) return `${inst.op}:${ops.value}`;
      if (inst.op === IR.CONST_BOOL && ops.value !== void 0) return `${inst.op}:${ops.value}`;
      if (inst.op === IR.CONST_NULL) return inst.op;
      if (inst.op === IR.LOAD_LOCAL) return `${inst.op}:${ops.slot}`;
      if (inst.op === IR.LOAD_GLOBAL) return `${inst.op}:${ops.index}`;
      if (inst.op === IR.LOAD_FREE) return `${inst.op}:${ops.index}`;
      if (inst.op === IR.LOAD_CONST) return `${inst.op}:${ops.index}`;
      if (ops.left !== void 0 && ops.right !== void 0) return `${inst.op}:${ops.left}:${ops.right}`;
      if (ops.ref !== void 0) return `${inst.op}:${ops.ref}`;
      return null;
    };
    const seen = /* @__PURE__ */ new Map();
    const toEliminate = /* @__PURE__ */ new Map();
    let eliminated = 0;
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.STORE_LOCAL) {
        seen.delete(`${IR.LOAD_LOCAL}:${inst.operands.slot}`);
        continue;
      }
      if (inst.op === IR.STORE_GLOBAL) {
        seen.delete(`${IR.LOAD_GLOBAL}:${inst.operands.index}`);
        continue;
      }
      if (inst.op === IR.CALL || inst.op === IR.SELF_CALL) {
        for (const k2 of [...seen.keys()]) {
          if (k2.startsWith(IR.LOAD_LOCAL) || k2.startsWith(IR.LOAD_GLOBAL) || k2.startsWith(IR.LOAD_FREE)) {
            seen.delete(k2);
          }
        }
        continue;
      }
      if (inst.op === IR.LOOP_START || inst.op === IR.LOOP_END) {
        for (const k2 of [...seen.keys()]) {
          if (k2.startsWith(IR.LOAD_LOCAL) || k2.startsWith(IR.LOAD_GLOBAL) || k2.startsWith(IR.LOAD_FREE)) {
            seen.delete(k2);
          }
        }
        continue;
      }
      if (!PURE_OPS.has(inst.op)) continue;
      const k = key(inst);
      if (k === null) continue;
      if (seen.has(k)) {
        toEliminate.set(i, seen.get(k));
        eliminated++;
      } else {
        seen.set(k, i);
      }
    }
    if (eliminated > 0) {
      for (const [oldRef, newRef] of toEliminate) {
        this._replaceRef(ir, oldRef, newRef);
        ir[oldRef] = null;
      }
      this._compact();
    }
    return eliminated;
  }
  redundantGuardElimination() {
    const ir = this.trace.ir;
    const guardedTypes = /* @__PURE__ */ new Map();
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.CONST_INT) guardedTypes.set(i, /* @__PURE__ */ new Set(["int"]));
      else if (inst.op === IR.CONST_BOOL) guardedTypes.set(i, /* @__PURE__ */ new Set(["bool"]));
      else if (inst.op === IR.CONST_NULL) guardedTypes.set(i, /* @__PURE__ */ new Set(["null"]));
    }
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.UNBOX_INT || inst.op === IR.BOX_INT) {
        guardedTypes.set(i, /* @__PURE__ */ new Set(["int"]));
      }
      if (inst.op === IR.ADD_INT || inst.op === IR.SUB_INT || inst.op === IR.MUL_INT || inst.op === IR.DIV_INT || inst.op === IR.MOD_INT || inst.op === IR.NEG || inst.op === IR.BUILTIN_LEN) {
        guardedTypes.set(i, /* @__PURE__ */ new Set(["int"]));
      }
      if (inst.op === IR.GT || inst.op === IR.LT || inst.op === IR.EQ || inst.op === IR.NEQ) {
        guardedTypes.set(i, /* @__PURE__ */ new Set(["bool"]));
      }
      if (inst.op === IR.CONCAT || inst.op === IR.UNBOX_STRING || inst.op === IR.BOX_STRING) {
        guardedTypes.set(i, /* @__PURE__ */ new Set(["string"]));
      }
    }
    let eliminated = 0;
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      let guardType = null;
      if (inst.op === IR.GUARD_INT) guardType = "int";
      else if (inst.op === IR.GUARD_BOOL) guardType = "bool";
      else if (inst.op === IR.GUARD_STRING) guardType = "string";
      else continue;
      const ref = inst.operands.ref;
      const known = guardedTypes.get(ref);
      if (known && known.has(guardType)) {
        ir[i] = null;
        eliminated++;
        this.trace.guardCount--;
      } else {
        if (!guardedTypes.has(ref)) guardedTypes.set(ref, /* @__PURE__ */ new Set());
        guardedTypes.get(ref).add(guardType);
      }
    }
    if (eliminated > 0) this._compact();
    return eliminated;
  }
  // --- Pass 1.2b: Unbox Deduplication ---
  // Eliminate duplicate UNBOX_INT/UNBOX_STRING of the same source ref.
  // CSE sometimes misses these due to compaction/reindexing.
  unboxDeduplication() {
    const ir = this.trace.ir;
    const UNBOX_OPS = /* @__PURE__ */ new Set([IR.UNBOX_INT, IR.UNBOX_STRING]);
    const seen = /* @__PURE__ */ new Map();
    let eliminated = 0;
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst || !UNBOX_OPS.has(inst.op)) continue;
      const key = `${inst.op}:${inst.operands.ref}`;
      if (seen.has(key)) {
        this._replaceRef(ir, i, seen.get(key));
        ir[i] = null;
        eliminated++;
      } else {
        seen.set(key, i);
      }
    }
    if (eliminated > 0) this._compact();
    return eliminated;
  }
  // --- Pass 1.2c: Detect Induction Variables ---
  // Finds loop counter variables that start non-negative and increment by positive constants.
  // Returns a Set of UNBOX_INT IR indices that are provably non-negative.
  detectInductionVariables() {
    const ir = this.trace.ir;
    const nonNegativeUnboxRefs = /* @__PURE__ */ new Set();
    let loopStart = -1, loopEnd = -1;
    for (let i = 0; i < ir.length; i++) {
      if (!ir[i]) continue;
      if (ir[i].op === IR.LOOP_START) loopStart = i;
      if (ir[i].op === IR.LOOP_END) loopEnd = i;
    }
    if (loopStart === -1 || loopEnd === -1) return nonNegativeUnboxRefs;
    for (let i = loopStart; i < loopEnd; i++) {
      const inst = ir[i];
      if (!inst || inst.op !== IR.STORE_GLOBAL) continue;
      const globalIdx = inst.operands.index;
      const storedRef = inst.operands.value;
      const storedInst = ir[storedRef];
      if (!storedInst || storedInst.op !== IR.BOX_INT) continue;
      const addRef = storedInst.operands.ref;
      const addInst = ir[addRef];
      if (!addInst || addInst.op !== IR.ADD_INT) continue;
      let unboxRef = null;
      let stepRef = null;
      const leftInst = ir[addInst.operands.left];
      const rightInst = ir[addInst.operands.right];
      if (leftInst?.op === IR.UNBOX_INT && rightInst?.op === IR.CONST_INT) {
        unboxRef = addInst.operands.left;
        stepRef = addInst.operands.right;
      } else if (rightInst?.op === IR.UNBOX_INT && leftInst?.op === IR.CONST_INT) {
        unboxRef = addInst.operands.right;
        stepRef = addInst.operands.left;
      }
      if (unboxRef === null) continue;
      const unboxInst = ir[unboxRef];
      const loadRef = unboxInst.operands.ref;
      const loadInst = ir[loadRef];
      if (!loadInst || loadInst.op !== IR.LOAD_GLOBAL || loadInst.operands.index !== globalIdx) continue;
      const stepInst = ir[stepRef];
      const step = stepInst.operands.value;
      if (step <= 0) continue;
      nonNegativeUnboxRefs.add(unboxRef);
    }
    return nonNegativeUnboxRefs;
  }
  // --- Pass 1.3: Range Check Elimination ---
  // Eliminate redundant GUARD_BOUNDS when the loop condition already implies bounds safety.
  // Pattern: GT(BUILTIN_LEN(arr), idx) → GUARD_TRUTHY → ... → GUARD_BOUNDS(arr, idx)
  // If the loop condition already checks idx < len(arr), the upper bound check in GUARD_BOUNDS
  // is redundant. For the lower bound (idx >= 0), we verify the index traces back to a
  // non-negative source (CONST_INT >= 0, or arithmetic from non-negative operands).
  rangeCheckElimination() {
    const ir = this.trace.ir;
    const inductionVars = this.detectInductionVariables();
    const lenToArr = /* @__PURE__ */ new Map();
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (inst && inst.op === IR.BUILTIN_LEN) {
        lenToArr.set(i, inst.operands.ref);
      }
    }
    if (lenToArr.size === 0) return 0;
    const normalizeRef = (ref) => {
      const inst = ir[ref];
      if (inst && inst.op === IR.UNBOX_INT) return inst.operands.ref;
      return ref;
    };
    const boundedSources = /* @__PURE__ */ new Map();
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      let arrRef = null, idxRef = null;
      if (inst.op === IR.GT) {
        const leftArr = lenToArr.get(inst.operands.left);
        if (leftArr !== void 0) {
          arrRef = leftArr;
          idxRef = normalizeRef(inst.operands.right);
        }
      } else if (inst.op === IR.LT) {
        const rightArr = lenToArr.get(inst.operands.right);
        if (rightArr !== void 0) {
          arrRef = rightArr;
          idxRef = normalizeRef(inst.operands.left);
        }
      }
      if (arrRef !== null && idxRef !== null) {
        for (let j = i + 1; j < ir.length && j < i + 5; j++) {
          const next = ir[j];
          if (!next) continue;
          if (next.op === IR.CONST_BOOL && next.operands.ref === i) {
            for (let k = j + 1; k < ir.length && k < j + 3; k++) {
              const guard = ir[k];
              if (guard && guard.op === IR.GUARD_TRUTHY && guard.operands.ref === j) {
                boundedSources.set(`${arrRef}:${idxRef}`, true);
                break;
              }
            }
            break;
          }
          if (next.op === IR.GUARD_TRUTHY && next.operands.ref === i) {
            boundedSources.set(`${arrRef}:${idxRef}`, true);
            break;
          }
        }
      }
    }
    if (boundedSources.size === 0) return 0;
    const isNonNegative = (ref, depth = 0) => {
      if (depth > 10) return false;
      const inst = ir[ref];
      if (!inst) return false;
      if (inductionVars.has(ref)) return true;
      if (inst.op === IR.CONST_INT) return inst.operands.value >= 0;
      if (inst.op === IR.UNBOX_INT) return false;
      if (inst.op === IR.ADD_INT) {
        return isNonNegative(inst.operands.left, depth + 1) && isNonNegative(inst.operands.right, depth + 1);
      }
      if (inst.op === IR.MUL_INT) {
        return isNonNegative(inst.operands.left, depth + 1) && isNonNegative(inst.operands.right, depth + 1);
      }
      if (inst.op === IR.BUILTIN_LEN) return true;
      return false;
    };
    let eliminated = 0;
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst || inst.op !== IR.GUARD_BOUNDS) continue;
      const arrRef = inst.operands.left;
      const idxRef = inst.operands.right;
      const normalizedIdx = normalizeRef(idxRef);
      const key = `${arrRef}:${normalizedIdx}`;
      if (boundedSources.has(key)) {
        if (isNonNegative(idxRef)) {
          ir[i] = null;
          eliminated++;
          this.trace.guardCount--;
        } else {
          inst._upperBoundProven = true;
          eliminated++;
        }
      }
    }
    if (eliminated > 0) this._compact();
    return eliminated;
  }
  // --- Pass 1.5: Constant Propagation ---
  // Track known constant values through the IR and replace references with constants.
  // If a STORE writes a BOX_INT(CONST_INT(v)), the slot has known value v.
  // If a subsequent LOAD reads that slot (not already eliminated by S2LF),
  // and an UNBOX_INT follows, we can replace the unbox with CONST_INT(v).
  // Also tracks values through arithmetic: ADD_INT(const, const) → known constant.
  // This enables more constant folding in the next pass.
  constantPropagation() {
    const ir = this.trace.ir;
    const knownValues = /* @__PURE__ */ new Map();
    const slotValues = /* @__PURE__ */ new Map();
    let propagated = 0;
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.CONST_INT) {
        knownValues.set(i, inst.operands.value);
        continue;
      }
      if (inst.op === IR.ADD_INT || inst.op === IR.SUB_INT || inst.op === IR.MUL_INT || inst.op === IR.DIV_INT) {
        const lv = knownValues.get(inst.operands.left);
        const rv = knownValues.get(inst.operands.right);
        if (lv !== void 0 && rv !== void 0) {
          let result;
          switch (inst.op) {
            case IR.ADD_INT:
              result = lv + rv;
              break;
            case IR.SUB_INT:
              result = lv - rv;
              break;
            case IR.MUL_INT:
              result = lv * rv;
              break;
            case IR.DIV_INT:
              result = Math.trunc(lv / rv);
              break;
            case IR.MOD_INT:
              result = rv !== 0 ? lv % rv : null;
              break;
          }
          knownValues.set(i, result);
        }
        continue;
      }
      if (inst.op === IR.BOX_INT) {
        const rv = knownValues.get(inst.operands.ref);
        if (rv !== void 0) knownValues.set(i, rv);
        continue;
      }
      if (inst.op === IR.UNBOX_INT) {
        const rv = knownValues.get(inst.operands.ref);
        if (rv !== void 0) {
          inst.op = IR.CONST_INT;
          inst.operands = { value: rv };
          knownValues.set(i, rv);
          propagated++;
          continue;
        }
      }
      if (inst.op === IR.STORE_LOCAL) {
        const sv = knownValues.get(inst.operands.value);
        if (sv !== void 0) {
          slotValues.set(`local:${inst.operands.slot}`, sv);
        } else {
          slotValues.delete(`local:${inst.operands.slot}`);
        }
        continue;
      }
      if (inst.op === IR.STORE_GLOBAL) {
        const sv = knownValues.get(inst.operands.value);
        if (sv !== void 0) {
          slotValues.set(`global:${inst.operands.index}`, sv);
        } else {
          slotValues.delete(`global:${inst.operands.index}`);
        }
        continue;
      }
      if (inst.op === IR.LOAD_LOCAL) {
        const sv = slotValues.get(`local:${inst.operands.slot}`);
        if (sv !== void 0) knownValues.set(i, sv);
        continue;
      }
      if (inst.op === IR.LOAD_GLOBAL) {
        const sv = slotValues.get(`global:${inst.operands.index}`);
        if (sv !== void 0) knownValues.set(i, sv);
        continue;
      }
      if (inst.op === IR.NEG) {
        const rv = knownValues.get(inst.operands.ref);
        if (rv !== void 0) {
          inst.op = IR.CONST_INT;
          inst.operands = { value: -rv };
          knownValues.set(i, -rv);
          propagated++;
        }
        continue;
      }
      if (inst.op === IR.CALL || inst.op === IR.SELF_CALL) {
        slotValues.clear();
      }
      if (inst.op === IR.LOOP_END) {
        slotValues.clear();
      }
    }
    return propagated;
  }
  // --- Pass 2: Constant Folding ---
  // Fold arithmetic on two CONST_INT values into a single CONST_INT.
  // Also fold UNBOX_INT(CONST_INT) → same constant value, and
  // BOX_INT of a known constant → CONST_INT.
  constantFolding() {
    const ir = this.trace.ir;
    const constValues = /* @__PURE__ */ new Map();
    let folded = 0;
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.CONST_INT) {
        constValues.set(i, inst.operands.value);
        continue;
      }
      if (inst.op === IR.UNBOX_INT) {
        const refInst = ir[inst.operands.ref];
        if (refInst && refInst.op === IR.CONST_INT) {
          inst.op = IR.CONST_INT;
          inst.operands = { value: refInst.operands.value };
          constValues.set(i, refInst.operands.value);
          folded++;
          continue;
        }
        if (constValues.has(inst.operands.ref)) {
          inst.op = IR.CONST_INT;
          inst.operands = { value: constValues.get(inst.operands.ref) };
          constValues.set(i, inst.operands.value);
          folded++;
          continue;
        }
      }
      if (inst.op === IR.ADD_INT || inst.op === IR.SUB_INT || inst.op === IR.MUL_INT || inst.op === IR.DIV_INT) {
        const leftVal = constValues.get(inst.operands.left);
        const rightVal = constValues.get(inst.operands.right);
        if (leftVal !== void 0 && rightVal !== void 0) {
          let result;
          switch (inst.op) {
            case IR.ADD_INT:
              result = leftVal + rightVal;
              break;
            case IR.SUB_INT:
              result = leftVal - rightVal;
              break;
            case IR.MUL_INT:
              result = leftVal * rightVal;
              break;
            case IR.DIV_INT:
              result = Math.trunc(leftVal / rightVal);
              break;
            case IR.MOD_INT:
              result = rightVal !== 0 ? leftVal % rightVal : null;
              break;
          }
          inst.op = IR.CONST_INT;
          inst.operands = { value: result };
          constValues.set(i, result);
          folded++;
        }
      }
      if (inst.op === IR.EQ || inst.op === IR.NEQ || inst.op === IR.GT || inst.op === IR.LT) {
        const leftVal = constValues.get(inst.operands.left);
        const rightVal = constValues.get(inst.operands.right);
        if (leftVal !== void 0 && rightVal !== void 0) {
          let result;
          switch (inst.op) {
            case IR.EQ:
              result = leftVal === rightVal;
              break;
            case IR.NEQ:
              result = leftVal !== rightVal;
              break;
            case IR.GT:
              result = leftVal > rightVal;
              break;
            case IR.LT:
              result = leftVal < rightVal;
              break;
          }
          inst.op = IR.CONST_BOOL;
          inst.operands = { value: result };
          folded++;
        }
      }
    }
    return folded;
  }
  // --- Pass 3: Dead Code Elimination ---
  // Remove instructions whose results are never referenced by any live instruction.
  // Walk backwards marking live refs, then null out dead ones.
  deadCodeElimination() {
    const ir = this.trace.ir;
    const live = /* @__PURE__ */ new Set();
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst) continue;
      if (inst.op === IR.STORE_LOCAL || inst.op === IR.STORE_GLOBAL || inst.op === IR.GUARD_INT || inst.op === IR.GUARD_BOOL || inst.op === IR.GUARD_STRING || inst.op === IR.GUARD_ARRAY || inst.op === IR.GUARD_HASH || inst.op === IR.GUARD_BOUNDS || inst.op === IR.GUARD_TRUTHY || inst.op === IR.GUARD_FALSY || inst.op === IR.GUARD_CLOSURE || inst.op === IR.LOOP_START || inst.op === IR.LOOP_END || inst.op === IR.CALL || inst.op === IR.EXEC_TRACE || inst.op === IR.SELF_CALL || inst.op === IR.FUNC_RETURN || inst.op === IR.BUILTIN_PUSH) {
        live.add(i);
      }
    }
    for (let i = 0; i < ir.length; i++) {
      const inst = ir[i];
      if (!inst || !inst.snapshot) continue;
      for (const ref of inst.snapshot.locals.values()) {
        if (typeof ref === "number" && ref >= 0 && ref < ir.length && ir[ref]) live.add(ref);
      }
      for (const ref of inst.snapshot.globals.values()) {
        if (typeof ref === "number" && ref >= 0 && ref < ir.length && ir[ref]) live.add(ref);
      }
    }
    const VALUE_IS_REF = /* @__PURE__ */ new Set([IR.STORE_LOCAL, IR.STORE_GLOBAL]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const idx of live) {
        const inst = ir[idx];
        if (!inst) continue;
        const ops = inst.operands;
        for (const key of Object.keys(ops)) {
          const val = ops[key];
          if (typeof val !== "number" || val < 0 || val >= ir.length || !ir[val] || live.has(val)) continue;
          if (key === "ref" || key === "left" || key === "right" || key === "array" || key === "value" && (VALUE_IS_REF.has(inst.op) || inst.op === IR.BUILTIN_PUSH)) {
            live.add(val);
            changed = true;
          }
          if (key === "args" && Array.isArray(ops[key])) {
            for (const argRef of ops[key]) {
              if (typeof argRef === "number" && argRef >= 0 && argRef < ir.length && ir[argRef] && !live.has(argRef)) {
                live.add(argRef);
                changed = true;
              }
            }
          }
        }
      }
    }
    let eliminated = 0;
    for (let i = 0; i < ir.length; i++) {
      if (ir[i] && !live.has(i)) {
        ir[i] = null;
        eliminated++;
      }
    }
    if (eliminated > 0) this._compact();
    return eliminated;
  }
  // Compact the IR array: remove nulls, remap all references
  _compact() {
    const ir = this.trace.ir;
    const remap = /* @__PURE__ */ new Map();
    const newIr = [];
    for (let i = 0; i < ir.length; i++) {
      if (ir[i] !== null) {
        remap.set(i, newIr.length);
        ir[i].id = newIr.length;
        newIr.push(ir[i]);
      }
    }
    const REF_KEYS = /* @__PURE__ */ new Set(["ref", "left", "right", "value"]);
    const VALUE_IS_REF = /* @__PURE__ */ new Set([IR.STORE_LOCAL, IR.STORE_GLOBAL]);
    for (const inst of newIr) {
      const ops = inst.operands;
      for (const key of Object.keys(ops)) {
        if (typeof ops[key] !== "number") {
          if (key === "args" && Array.isArray(ops[key])) {
            ops[key] = ops[key].map((ref) => remap.has(ref) ? remap.get(ref) : ref);
          }
          continue;
        }
        if (key === "ref" || key === "left" || key === "right" || key === "array") {
          if (remap.has(ops[key])) ops[key] = remap.get(ops[key]);
        }
        if (key === "value" && (VALUE_IS_REF.has(inst.op) || inst.op === IR.BUILTIN_PUSH)) {
          if (remap.has(ops[key])) ops[key] = remap.get(ops[key]);
        }
      }
      if (inst.snapshot) {
        for (const [slot, ref] of inst.snapshot.locals) {
          if (remap.has(ref)) inst.snapshot.locals.set(slot, remap.get(ref));
        }
        for (const [idx, ref] of inst.snapshot.globals) {
          if (remap.has(ref)) inst.snapshot.globals.set(idx, remap.get(ref));
        }
      }
    }
    this.trace.ir = newIr;
  }
};
var FunctionCompiler = class {
  constructor(fn, constants, vm) {
    this.fn = fn;
    this.constants = constants;
    this.vm = vm;
    this._compiledSource = null;
  }
  compile() {
    const ins = this.fn.instructions;
    const numLocals = this.fn.numLocals;
    const jumpTargets = /* @__PURE__ */ new Set();
    let ip = 0;
    while (ip < ins.length) {
      const op = ins[ip];
      const def = lookup(op);
      const widths = def ? def.operandWidths : [];
      let offset = ip + 1;
      for (const w of widths) {
        if (w === 2) {
          const target = ins[offset] << 8 | ins[offset + 1];
          if (op === Opcodes.OpJump || op === Opcodes.OpJumpNotTruthy) {
            jumpTargets.add(target);
          }
          offset += 2;
        } else {
          offset += 1;
        }
      }
      ip = offset;
    }
    const lines = [];
    lines.push('"use strict";');
    lines.push(`const __s = new Array(32);`);
    lines.push(`let __sp = 0;`);
    for (let i = 0; i < numLocals; i++) {
      lines.push(`let __l${i} = __args[${i}] !== undefined ? __args[${i}] : __NULL;`);
    }
    ip = 0;
    while (ip < ins.length) {
      if (jumpTargets.has(ip)) {
      }
      const op = ins[ip];
      switch (op) {
        case Opcodes.OpConstant: {
          const constIdx = ins[ip + 1] << 8 | ins[ip + 2];
          ip += 3;
          const constVal = this.constants[constIdx];
          if (constVal instanceof MonkeyInteger) {
            lines.push(`__s[__sp++] = __cachedInteger(${constVal.value});`);
          } else if (constVal instanceof MonkeyBoolean) {
            lines.push(`__s[__sp++] = ${constVal.value ? "__TRUE" : "__FALSE"};`);
          } else {
            lines.push(`__s[__sp++] = __consts[${constIdx}];`);
          }
          break;
        }
        case Opcodes.OpGetLocal: {
          const slot = ins[ip + 1];
          ip += 2;
          lines.push(`__s[__sp++] = __l${slot};`);
          break;
        }
        case Opcodes.OpSetLocal: {
          const slot = ins[ip + 1];
          ip += 2;
          lines.push(`__l${slot} = __s[--__sp];`);
          break;
        }
        case Opcodes.OpGetGlobal: {
          const idx = ins[ip + 1] << 8 | ins[ip + 2];
          ip += 3;
          lines.push(`__s[__sp++] = __globals[${idx}];`);
          break;
        }
        case Opcodes.OpSetGlobal: {
          const idx = ins[ip + 1] << 8 | ins[ip + 2];
          ip += 3;
          lines.push(`__globals[${idx}] = __s[--__sp];`);
          break;
        }
        case Opcodes.OpGetFree: {
          const idx = ins[ip + 1];
          ip += 2;
          lines.push(`__s[__sp++] = __free[${idx}];`);
          break;
        }
        case Opcodes.OpAdd:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(l.value + r.value); }`);
          break;
        case Opcodes.OpSub:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(l.value - r.value); }`);
          break;
        case Opcodes.OpMul:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(l.value * r.value); }`);
          break;
        case Opcodes.OpDiv:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(Math.trunc(l.value / r.value)); }`);
          break;
        case Opcodes.OpEqual:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = l.value === r.value ? __TRUE : __FALSE; }`);
          break;
        case Opcodes.OpNotEqual:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = l.value !== r.value ? __TRUE : __FALSE; }`);
          break;
        case Opcodes.OpGreaterThan:
          ip += 1;
          lines.push(`{ const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = l.value > r.value ? __TRUE : __FALSE; }`);
          break;
        case Opcodes.OpMinus:
          ip += 1;
          lines.push(`{ const v = __s[--__sp]; __s[__sp++] = __cachedInteger(-v.value); }`);
          break;
        case Opcodes.OpBang:
          ip += 1;
          lines.push(`{ const v = __s[--__sp]; __s[__sp++] = __isTruthy(v) ? __FALSE : __TRUE; }`);
          break;
        case Opcodes.OpTrue:
          ip += 1;
          lines.push(`__s[__sp++] = __TRUE;`);
          break;
        case Opcodes.OpFalse:
          ip += 1;
          lines.push(`__s[__sp++] = __FALSE;`);
          break;
        case Opcodes.OpNull:
          ip += 1;
          lines.push(`__s[__sp++] = __NULL;`);
          break;
        case Opcodes.OpPop:
          ip += 1;
          lines.push(`--__sp;`);
          break;
        case Opcodes.OpReturnValue:
          ip += 1;
          lines.push(`return __s[--__sp];`);
          break;
        case Opcodes.OpReturn:
          ip += 1;
          lines.push(`return __NULL;`);
          break;
        case Opcodes.OpCurrentClosure:
          ip += 1;
          lines.push(`__s[__sp++] = __SELF_MARKER;`);
          break;
        case Opcodes.OpCall: {
          const numArgs = ins[ip + 1];
          ip += 2;
          const argExprs = [];
          for (let i = numArgs - 1; i >= 0; i--) {
            argExprs.unshift(`a${i}`);
          }
          lines.push(`{`);
          lines.push(`  const __callArgs = new Array(${numArgs});`);
          for (let i = numArgs - 1; i >= 0; i--) {
            lines.push(`  __callArgs[${i}] = __s[--__sp];`);
          }
          lines.push(`  const __callee = __s[--__sp];`);
          lines.push(`  if (__callee === __SELF_MARKER) {`);
          lines.push(`    __s[__sp++] = __self(__callArgs);`);
          lines.push(`  } else {`);
          lines.push(`    return null; /* bail: non-self call */`);
          lines.push(`  }`);
          lines.push(`}`);
          break;
        }
        case Opcodes.OpJump: {
          const target = ins[ip + 1] << 8 | ins[ip + 2];
          ip += 3;
          lines.push(`/* jump to ${target} */`);
          break;
        }
        case Opcodes.OpJumpNotTruthy: {
          const target = ins[ip + 1] << 8 | ins[ip + 2];
          ip += 3;
          lines.push(`if (!__isTruthy(__s[--__sp])) {`);
          lines.push(`  /* jump to ${target} \u2014 will be closed by jump/target */`);
          break;
        }
        // Superinstructions
        case Opcodes.OpGetLocalSubConst: {
          const slot = ins[ip + 1];
          const constIdx = ins[ip + 2] << 8 | ins[ip + 3];
          ip += 4;
          const constVal = this.constants[constIdx];
          if (constVal instanceof MonkeyInteger) {
            lines.push(`__s[__sp++] = __cachedInteger(__l${slot}.value - ${constVal.value});`);
          } else {
            lines.push(`__s[__sp++] = __cachedInteger(__l${slot}.value - __consts[${constIdx}].value);`);
          }
          break;
        }
        default: {
          ip += 1;
          const def = lookup(op);
          if (def && def.operandWidths) {
            for (const w of def.operandWidths) ip += w;
          }
          return null;
        }
      }
    }
    return null;
  }
  // Compile using a while+switch interpreter (eliminates dispatch overhead via V8 JIT)
  // Uses raw JS numbers internally for integer-heavy functions (like fib)
  compileSwitch() {
    const ins = this.fn.instructions;
    const numLocals = this.fn.numLocals;
    const canUseRawInts = this._canUseRawInts();
    if (canUseRawInts) {
      return this._compileSwitchRaw();
    }
    const lines = [];
    lines.push('"use strict";');
    lines.push(`const __s = [];`);
    lines.push(`let __sp = 0;`);
    for (let i = 0; i < numLocals; i++) {
      lines.push(`let __l${i} = ${i} < __args.length ? __args[${i}] : __NULL;`);
    }
    const boundaries = /* @__PURE__ */ new Set([0]);
    let ip = 0;
    while (ip < ins.length) {
      const op = ins[ip];
      const def = lookup(op);
      const widths = def ? def.operandWidths : [];
      let nextIp = ip + 1;
      for (const w of widths) nextIp += w;
      if (op === Opcodes.OpJump) {
        const target = ins[ip + 1] << 8 | ins[ip + 2];
        boundaries.add(target);
        boundaries.add(nextIp);
      } else if (op === Opcodes.OpJumpNotTruthy) {
        const target = ins[ip + 1] << 8 | ins[ip + 2];
        boundaries.add(target);
        boundaries.add(nextIp);
      } else if (op === Opcodes.OpReturnValue || op === Opcodes.OpReturn) {
        boundaries.add(nextIp);
      }
      ip = nextIp;
    }
    const blocks = [...boundaries].sort((a, b) => a - b);
    lines.push(`let __pc = 0;`);
    lines.push(`while (true) {`);
    lines.push(`  switch (__pc) {`);
    for (let bi = 0; bi < blocks.length; bi++) {
      const blockStart = blocks[bi];
      const blockEnd = bi + 1 < blocks.length ? blocks[bi + 1] : ins.length;
      if (blockStart >= ins.length) continue;
      lines.push(`    case ${blockStart}: {`);
      ip = blockStart;
      while (ip < blockEnd && ip < ins.length) {
        const op = ins[ip];
        switch (op) {
          case Opcodes.OpConstant: {
            const constIdx = ins[ip + 1] << 8 | ins[ip + 2];
            ip += 3;
            const constVal = this.constants[constIdx];
            if (constVal instanceof MonkeyInteger) {
              lines.push(`      __s[__sp++] = __cachedInteger(${constVal.value});`);
            } else if (constVal instanceof MonkeyBoolean) {
              lines.push(`      __s[__sp++] = ${constVal.value ? "__TRUE" : "__FALSE"};`);
            } else {
              lines.push(`      __s[__sp++] = __consts[${constIdx}];`);
            }
            break;
          }
          case Opcodes.OpGetLocal: {
            const slot = ins[ip + 1];
            ip += 2;
            lines.push(`      __s[__sp++] = __l${slot};`);
            break;
          }
          case Opcodes.OpSetLocal: {
            const slot = ins[ip + 1];
            ip += 2;
            lines.push(`      __l${slot} = __s[--__sp];`);
            break;
          }
          case Opcodes.OpGetGlobal: {
            const idx = ins[ip + 1] << 8 | ins[ip + 2];
            ip += 3;
            lines.push(`      __s[__sp++] = __globals[${idx}];`);
            break;
          }
          case Opcodes.OpSetGlobal: {
            const idx = ins[ip + 1] << 8 | ins[ip + 2];
            ip += 3;
            lines.push(`      __globals[${idx}] = __s[--__sp];`);
            break;
          }
          case Opcodes.OpGetFree: {
            const idx = ins[ip + 1];
            ip += 2;
            lines.push(`      __s[__sp++] = __free[${idx}];`);
            break;
          }
          case Opcodes.OpAdd:
            ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; if (l instanceof __MonkeyString) __s[__sp++] = new __MonkeyString(l.value + r.value); else __s[__sp++] = __cachedInteger(l.value + r.value); }`);
            break;
          case Opcodes.OpAddInt:
            ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(l.value + r.value); }`);
            break;
          case Opcodes.OpSub:
          case Opcodes.OpSubInt:
            ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(l.value - r.value); }`);
            break;
          case Opcodes.OpMul:
          case Opcodes.OpMulInt:
            ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(l.value * r.value); }`);
            break;
          case Opcodes.OpDiv:
          case Opcodes.OpDivInt:
            ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = __cachedInteger(Math.trunc(l.value / r.value)); }`);
            break;
          case Opcodes.OpEqual:
          case Opcodes.OpEqualInt:
            ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = (l === r || l.value === r.value) ? __TRUE : __FALSE; }`);
            break;
          case Opcodes.OpNotEqual:
          case Opcodes.OpNotEqualInt:
            ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = (l !== r && l.value !== r.value) ? __TRUE : __FALSE; }`);
            break;
          case Opcodes.OpGreaterThan:
          case Opcodes.OpGreaterThanInt:
            ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = l.value > r.value ? __TRUE : __FALSE; }`);
            break;
          case Opcodes.OpLessThanInt:
            ip += 1;
            lines.push(`      { const r = __s[--__sp], l = __s[--__sp]; __s[__sp++] = l.value < r.value ? __TRUE : __FALSE; }`);
            break;
          case Opcodes.OpMinus:
            ip += 1;
            lines.push(`      { const v = __s[--__sp]; __s[__sp++] = __cachedInteger(-v.value); }`);
            break;
          case Opcodes.OpBang:
            ip += 1;
            lines.push(`      { const v = __s[--__sp]; __s[__sp++] = __isTruthy(v) ? __FALSE : __TRUE; }`);
            break;
          case Opcodes.OpTrue:
            ip += 1;
            lines.push(`      __s[__sp++] = __TRUE;`);
            break;
          case Opcodes.OpFalse:
            ip += 1;
            lines.push(`      __s[__sp++] = __FALSE;`);
            break;
          case Opcodes.OpNull:
            ip += 1;
            lines.push(`      __s[__sp++] = __NULL;`);
            break;
          case Opcodes.OpPop:
            ip += 1;
            lines.push(`      --__sp;`);
            break;
          case Opcodes.OpReturnValue:
            ip += 1;
            lines.push(`      return __s[--__sp];`);
            break;
          case Opcodes.OpReturn:
            ip += 1;
            lines.push(`      return __NULL;`);
            break;
          case Opcodes.OpCurrentClosure:
            ip += 1;
            lines.push(`      __s[__sp++] = null; /* self marker */`);
            break;
          case Opcodes.OpCall: {
            const numArgs = ins[ip + 1];
            ip += 2;
            lines.push(`      {`);
            lines.push(`        const __callArgs = new Array(${numArgs});`);
            for (let i = numArgs - 1; i >= 0; i--) {
              lines.push(`        __callArgs[${i}] = __s[--__sp];`);
            }
            lines.push(`        --__sp; /* pop callee */`);
            lines.push(`        __s[__sp++] = __self(__callArgs);`);
            lines.push(`      }`);
            break;
          }
          case Opcodes.OpJump: {
            const target = ins[ip + 1] << 8 | ins[ip + 2];
            ip += 3;
            lines.push(`      __pc = ${target}; continue;`);
            break;
          }
          case Opcodes.OpJumpNotTruthy: {
            const target = ins[ip + 1] << 8 | ins[ip + 2];
            ip += 3;
            lines.push(`      if (!__isTruthy(__s[--__sp])) { __pc = ${target}; continue; }`);
            break;
          }
          case Opcodes.OpGetLocalSubConst: {
            const slot = ins[ip + 1];
            const constIdx = ins[ip + 2] << 8 | ins[ip + 3];
            ip += 4;
            const constVal = this.constants[constIdx];
            if (constVal instanceof MonkeyInteger) {
              lines.push(`      __s[__sp++] = __cachedInteger(__l${slot}.value - ${constVal.value});`);
            } else {
              lines.push(`      __s[__sp++] = __cachedInteger(__l${slot}.value - __consts[${constIdx}].value);`);
            }
            break;
          }
          default: {
            return null;
          }
        }
      }
      if (bi + 1 < blocks.length && blocks[bi + 1] < ins.length) {
        lines.push(`      __pc = ${blocks[bi + 1]}; continue;`);
      }
      lines.push(`    }`);
    }
    lines.push(`  }`);
    lines.push(`  break;`);
    lines.push(`}`);
    const body = lines.join("\n");
    this._compiledSource = body;
    try {
      const fn = new Function(
        "__args",
        "__globals",
        "__consts",
        "__free",
        "__MonkeyInteger",
        "__MonkeyBoolean",
        "__MonkeyString",
        "__TRUE",
        "__FALSE",
        "__NULL",
        "__cachedInteger",
        "__internString",
        "__isTruthy",
        "__self",
        body
      );
      return fn;
    } catch (e) {
      return null;
    }
  }
  // Check if this function can be compiled with raw integer optimization
  _canUseRawInts() {
    const ins = this.fn.instructions;
    const referencedConsts = /* @__PURE__ */ new Set();
    let ip = 0;
    while (ip < ins.length) {
      const op = ins[ip];
      const def = lookup(op);
      const widths = def ? def.operandWidths : [];
      let nextIp = ip + 1;
      if (op === Opcodes.OpConstant) {
        const idx = ins[ip + 1] << 8 | ins[ip + 2];
        referencedConsts.add(idx);
      }
      if (op === Opcodes.OpGetLocalSubConst) {
        const idx = ins[ip + 2] << 8 | ins[ip + 3];
        referencedConsts.add(idx);
      }
      for (const w of widths) nextIp += w;
      switch (op) {
        case Opcodes.OpConstant:
        case Opcodes.OpGetLocal:
        case Opcodes.OpSetLocal:
        case Opcodes.OpAdd:
        case Opcodes.OpSub:
        case Opcodes.OpMul:
        case Opcodes.OpDiv:
        case Opcodes.OpAddInt:
        case Opcodes.OpSubInt:
        case Opcodes.OpMulInt:
        case Opcodes.OpDivInt:
        case Opcodes.OpEqual:
        case Opcodes.OpNotEqual:
        case Opcodes.OpGreaterThan:
        case Opcodes.OpEqualInt:
        case Opcodes.OpNotEqualInt:
        case Opcodes.OpGreaterThanInt:
        case Opcodes.OpLessThanInt:
        case Opcodes.OpMinus:
        case Opcodes.OpBang:
        case Opcodes.OpTrue:
        case Opcodes.OpFalse:
        case Opcodes.OpNull:
        case Opcodes.OpPop:
        case Opcodes.OpReturnValue:
        case Opcodes.OpReturn:
        case Opcodes.OpJump:
        case Opcodes.OpJumpNotTruthy:
        case Opcodes.OpCurrentClosure:
        case Opcodes.OpCall:
        case Opcodes.OpGetLocalSubConst:
        case Opcodes.OpGetGlobal:
        case Opcodes.OpSetGlobal:
        case Opcodes.OpGetFree:
          break;
        default:
          return false;
      }
      ip = nextIp;
    }
    for (const idx of referencedConsts) {
      const c = this.constants[idx];
      if (c instanceof MonkeyInteger || c instanceof MonkeyBoolean) continue;
      return false;
    }
    return true;
  }
  // Compile with raw JS numbers — no boxing for integer arithmetic
  // Generates TWO functions: inner (raw args/return) and outer (boxed wrapper)
  _compileSwitchRaw() {
    const ins = this.fn.instructions;
    const numLocals = this.fn.numLocals;
    const numParams = this.fn.numParameters;
    const lines = [];
    lines.push('"use strict";');
    lines.push(`function __rawFib(__rawArgs) {`);
    for (let i = 0; i < numLocals; i++) {
      if (i < numParams) {
        lines.push(`  let __l${i} = __rawArgs[${i}];`);
      } else {
        lines.push(`  let __l${i} = 0;`);
      }
    }
    lines.push(`  const __s = [];`);
    lines.push(`  let __sp = 0;`);
    const boundaries = /* @__PURE__ */ new Set([0]);
    let ip = 0;
    while (ip < ins.length) {
      const op = ins[ip];
      const def = lookup(op);
      const widths = def ? def.operandWidths : [];
      let nextIp = ip + 1;
      for (const w of widths) nextIp += w;
      if (op === Opcodes.OpJump) {
        const target = ins[ip + 1] << 8 | ins[ip + 2];
        boundaries.add(target);
        boundaries.add(nextIp);
      } else if (op === Opcodes.OpJumpNotTruthy) {
        const target = ins[ip + 1] << 8 | ins[ip + 2];
        boundaries.add(target);
        boundaries.add(nextIp);
      } else if (op === Opcodes.OpReturnValue || op === Opcodes.OpReturn) {
        boundaries.add(nextIp);
      }
      ip = nextIp;
    }
    const blocks = [...boundaries].sort((a, b) => a - b);
    lines.push(`  let __pc = 0;`);
    lines.push(`  while (true) {`);
    lines.push(`    switch (__pc) {`);
    for (let bi = 0; bi < blocks.length; bi++) {
      const blockStart = blocks[bi];
      const blockEnd = bi + 1 < blocks.length ? blocks[bi + 1] : ins.length;
      if (blockStart >= ins.length) continue;
      lines.push(`      case ${blockStart}: {`);
      ip = blockStart;
      while (ip < blockEnd && ip < ins.length) {
        const op = ins[ip];
        switch (op) {
          case Opcodes.OpConstant: {
            const constIdx = ins[ip + 1] << 8 | ins[ip + 2];
            ip += 3;
            const constVal = this.constants[constIdx];
            if (constVal instanceof MonkeyInteger) {
              lines.push(`        __s[__sp++] = ${constVal.value};`);
            } else if (constVal instanceof MonkeyBoolean) {
              lines.push(`        __s[__sp++] = ${constVal.value};`);
            } else {
              return null;
            }
            break;
          }
          case Opcodes.OpGetLocal: {
            const slot = ins[ip + 1];
            ip += 2;
            lines.push(`        __s[__sp++] = __l${slot};`);
            break;
          }
          case Opcodes.OpSetLocal: {
            const slot = ins[ip + 1];
            ip += 2;
            lines.push(`        __l${slot} = __s[--__sp];`);
            break;
          }
          case Opcodes.OpGetGlobal: {
            const idx = ins[ip + 1] << 8 | ins[ip + 2];
            ip += 3;
            lines.push(`        __s[__sp++] = __globals[${idx}].value;`);
            break;
          }
          case Opcodes.OpSetGlobal: {
            const idx = ins[ip + 1] << 8 | ins[ip + 2];
            ip += 3;
            lines.push(`        __globals[${idx}] = __cachedInteger(__s[--__sp]);`);
            break;
          }
          case Opcodes.OpGetFree: {
            const idx = ins[ip + 1];
            ip += 2;
            lines.push(`        __s[__sp++] = __free[${idx}].value !== undefined ? __free[${idx}].value : __free[${idx}];`);
            break;
          }
          case Opcodes.OpAdd:
          case Opcodes.OpAddInt:
            ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] += r; }`);
            break;
          case Opcodes.OpSub:
          case Opcodes.OpSubInt:
            ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] -= r; }`);
            break;
          case Opcodes.OpMul:
          case Opcodes.OpMulInt:
            ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] *= r; }`);
            break;
          case Opcodes.OpDiv:
          case Opcodes.OpDivInt:
            ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] = Math.trunc(__s[__sp - 1] / r); }`);
            break;
          case Opcodes.OpEqual:
          case Opcodes.OpEqualInt:
            ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] = __s[__sp - 1] === r; }`);
            break;
          case Opcodes.OpNotEqual:
          case Opcodes.OpNotEqualInt:
            ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] = __s[__sp - 1] !== r; }`);
            break;
          case Opcodes.OpGreaterThan:
          case Opcodes.OpGreaterThanInt:
            ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] = __s[__sp - 1] > r; }`);
            break;
          case Opcodes.OpLessThanInt:
            ip += 1;
            lines.push(`        { const r = __s[--__sp]; __s[__sp - 1] = __s[__sp - 1] < r; }`);
            break;
          case Opcodes.OpMinus:
            ip += 1;
            lines.push(`        __s[__sp - 1] = -__s[__sp - 1];`);
            break;
          case Opcodes.OpBang:
            ip += 1;
            lines.push(`        __s[__sp - 1] = !__s[__sp - 1];`);
            break;
          case Opcodes.OpTrue:
            ip += 1;
            lines.push(`        __s[__sp++] = true;`);
            break;
          case Opcodes.OpFalse:
            ip += 1;
            lines.push(`        __s[__sp++] = false;`);
            break;
          case Opcodes.OpNull:
            ip += 1;
            lines.push(`        __s[__sp++] = 0;`);
            break;
          case Opcodes.OpPop:
            ip += 1;
            lines.push(`        --__sp;`);
            break;
          case Opcodes.OpReturnValue:
            ip += 1;
            lines.push(`        return __s[--__sp];`);
            break;
          case Opcodes.OpReturn:
            ip += 1;
            lines.push(`        return 0;`);
            break;
          case Opcodes.OpCurrentClosure:
            ip += 1;
            lines.push(`        __s[__sp++] = null;`);
            break;
          case Opcodes.OpCall: {
            const numArgs = ins[ip + 1];
            ip += 2;
            lines.push(`        {`);
            lines.push(`          const __ca = new Array(${numArgs});`);
            for (let i = numArgs - 1; i >= 0; i--) {
              lines.push(`          __ca[${i}] = __s[--__sp];`);
            }
            lines.push(`          --__sp;`);
            lines.push(`          __s[__sp++] = __rawFib(__ca);`);
            lines.push(`        }`);
            break;
          }
          case Opcodes.OpJump: {
            const target = ins[ip + 1] << 8 | ins[ip + 2];
            ip += 3;
            lines.push(`        __pc = ${target}; continue;`);
            break;
          }
          case Opcodes.OpJumpNotTruthy: {
            const target = ins[ip + 1] << 8 | ins[ip + 2];
            ip += 3;
            lines.push(`        if (!__s[--__sp]) { __pc = ${target}; continue; }`);
            break;
          }
          case Opcodes.OpGetLocalSubConst: {
            const slot = ins[ip + 1];
            const constIdx = ins[ip + 2] << 8 | ins[ip + 3];
            ip += 4;
            const constVal = this.constants[constIdx];
            if (constVal instanceof MonkeyInteger) {
              lines.push(`        __s[__sp++] = __l${slot} - ${constVal.value};`);
            } else {
              return null;
            }
            break;
          }
          default:
            return null;
        }
      }
      if (bi + 1 < blocks.length && blocks[bi + 1] < ins.length) {
        lines.push(`        __pc = ${blocks[bi + 1]}; continue;`);
      }
      lines.push(`      }`);
    }
    lines.push(`    }`);
    lines.push(`    break;`);
    lines.push(`  }`);
    lines.push(`}`);
    lines.push(`const __ra = new Array(__args.length);`);
    lines.push(`for (let i = 0; i < __args.length; i++) __ra[i] = __args[i] && __args[i].value !== undefined ? __args[i].value : 0;`);
    lines.push(`return __cachedInteger(__rawFib(__ra));`);
    const body = lines.join("\n");
    this._compiledSource = body;
    this._isRaw = true;
    try {
      const fn = new Function(
        "__args",
        "__globals",
        "__consts",
        "__free",
        "__MonkeyInteger",
        "__MonkeyBoolean",
        "__MonkeyString",
        "__TRUE",
        "__FALSE",
        "__NULL",
        "__cachedInteger",
        "__internString",
        "__isTruthy",
        "__self",
        "__selfRaw",
        body
      );
      return fn;
    } catch (e) {
      return null;
    }
  }
};

// src/vm.js
var STACK_SIZE = 2048;
var GLOBALS_SIZE = 65536;
var MAX_FRAMES = 1024;
var QUICKEN_THRESHOLD = 8;
var QUICKEN_MAP = {
  [Opcodes.OpAdd]: Opcodes.OpAddInt,
  [Opcodes.OpSub]: Opcodes.OpSubInt,
  [Opcodes.OpMul]: Opcodes.OpMulInt,
  [Opcodes.OpDiv]: Opcodes.OpDivInt,
  [Opcodes.OpMod]: Opcodes.OpModInt,
  [Opcodes.OpEqual]: Opcodes.OpEqualInt,
  [Opcodes.OpNotEqual]: Opcodes.OpNotEqualInt,
  [Opcodes.OpGreaterThan]: Opcodes.OpGreaterThanInt
};
var DEOPT_MAP = {};
for (const [gen, spec] of Object.entries(QUICKEN_MAP)) {
  DEOPT_MAP[spec] = Number(gen);
}
var Closure = class {
  constructor(fn, free = []) {
    this.fn = fn;
    this.free = free;
  }
  type() {
    return "CLOSURE";
  }
  inspect() {
    return `Closure[${this.fn.instructions.length}]`;
  }
};
var Frame = class {
  constructor(closure, basePointer) {
    this.closure = closure;
    this.ip = -1;
    this.basePointer = basePointer;
  }
  instructions() {
    return this.closure.fn.instructions;
  }
};
var BUILTINS2 = [
  // len
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    const arg = args[0];
    if (arg instanceof MonkeyString) return new MonkeyInteger(arg.value.length);
    if (arg instanceof MonkeyArray) return new MonkeyInteger(arg.elements.length);
    return new MonkeyError(`argument to \`len\` not supported, got ${arg.type()}`);
  }),
  // puts
  new MonkeyBuiltin((...args) => {
    for (const a of args) console.log(a.inspect());
    return NULL;
  }),
  // first
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyArray)) return new MonkeyError(`argument to \`first\` must be ARRAY, got ${args[0].type()}`);
    return args[0].elements.length > 0 ? args[0].elements[0] : NULL;
  }),
  // last
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyArray)) return new MonkeyError(`argument to \`last\` must be ARRAY, got ${args[0].type()}`);
    const els = args[0].elements;
    return els.length > 0 ? els[els.length - 1] : NULL;
  }),
  // rest
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyArray)) return new MonkeyError(`argument to \`rest\` must be ARRAY, got ${args[0].type()}`);
    const els = args[0].elements;
    if (els.length === 0) return NULL;
    return new MonkeyArray(els.slice(1));
  }),
  // push
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyArray)) return new MonkeyError(`argument to \`push\` must be ARRAY, got ${args[0].type()}`);
    return new MonkeyArray([...args[0].elements, args[1]]);
  }),
  // split
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString))
      return new MonkeyError(`arguments to \`split\` must be STRING`);
    return new MonkeyArray(args[0].value.split(args[1].value).map((s) => new MonkeyString(s)));
  }),
  // join
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyArray) || !(args[1] instanceof MonkeyString))
      return new MonkeyError(`arguments to \`join\` must be (ARRAY, STRING)`);
    return new MonkeyString(args[0].elements.map((e) => e instanceof MonkeyString ? e.value : e.inspect()).join(args[1].value));
  }),
  // trim
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyString)) return new MonkeyError(`argument to \`trim\` must be STRING`);
    return new MonkeyString(args[0].value.trim());
  }),
  // str_contains
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString))
      return new MonkeyError(`arguments to \`str_contains\` must be STRING`);
    return args[0].value.includes(args[1].value) ? TRUE : FALSE;
  }),
  // substr
  new MonkeyBuiltin((...args) => {
    if (args.length < 2 || args.length > 3) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=2 or 3`);
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyInteger))
      return new MonkeyError(`arguments to \`substr\` must be (STRING, INT[, INT])`);
    const str = args[0].value;
    const start = args[1].value;
    const end = args.length === 3 && args[2] instanceof MonkeyInteger ? args[2].value : str.length;
    return new MonkeyString(str.slice(start, end));
  }),
  // replace
  new MonkeyBuiltin((...args) => {
    if (args.length !== 3) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=3`);
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString) || !(args[2] instanceof MonkeyString))
      return new MonkeyError(`arguments to \`replace\` must be STRING`);
    return new MonkeyString(args[0].value.split(args[1].value).join(args[2].value));
  }),
  // int
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0] instanceof MonkeyInteger) return args[0];
    if (args[0] instanceof MonkeyString) {
      const n = parseInt(args[0].value);
      if (isNaN(n)) return NULL;
      return new MonkeyInteger(n);
    }
    return new MonkeyError(`cannot convert ${args[0].type()} to INT`);
  }),
  // str
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0] instanceof MonkeyString) return args[0];
    return new MonkeyString(args[0].inspect());
  }),
  // type
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    return new MonkeyString(args[0].type());
  }),
  // upper
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyString))
      return new MonkeyError(`argument to \`upper\` must be STRING`);
    return new MonkeyString(args[0].value.toUpperCase());
  }),
  // lower
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyString))
      return new MonkeyError(`argument to \`lower\` must be STRING`);
    return new MonkeyString(args[0].value.toLowerCase());
  }),
  // indexOf
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=2`);
    if (args[0] instanceof MonkeyString && args[1] instanceof MonkeyString) {
      return cachedInteger(args[0].value.indexOf(args[1].value));
    }
    if (args[0] instanceof MonkeyArray) {
      for (let i = 0; i < args[0].elements.length; i++) {
        if (args[0].elements[i].inspect() === args[1].inspect()) return cachedInteger(i);
      }
      return cachedInteger(-1);
    }
    return new MonkeyError(`first argument to \`indexOf\` must be STRING or ARRAY`);
  }),
  // startsWith
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2 || !(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString))
      return new MonkeyError(`arguments to \`startsWith\` must be (STRING, STRING)`);
    return args[0].value.startsWith(args[1].value) ? TRUE : FALSE;
  }),
  // endsWith
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2 || !(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString))
      return new MonkeyError(`arguments to \`endsWith\` must be (STRING, STRING)`);
    return args[0].value.endsWith(args[1].value) ? TRUE : FALSE;
  }),
  // char — convert integer to single character
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyInteger))
      return new MonkeyError(`argument to \`char\` must be INTEGER`);
    return new MonkeyString(String.fromCharCode(args[0].value));
  }),
  // ord — convert single character to integer
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyString))
      return new MonkeyError(`argument to \`ord\` must be STRING`);
    return cachedInteger(args[0].value.charCodeAt(0));
  }),
  // keys — get hash keys as array
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyHash))
      return new MonkeyError(`argument to \`keys\` must be HASH`);
    const keys = [];
    for (const [, pair] of args[0].pairs) {
      keys.push(pair.key);
    }
    return new MonkeyArray(keys);
  }),
  // values — get hash values as array
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyHash))
      return new MonkeyError(`argument to \`values\` must be HASH`);
    const values = [];
    for (const [, pair] of args[0].pairs) {
      values.push(pair.value);
    }
    return new MonkeyArray(values);
  }),
  // abs — absolute value
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyInteger))
      return new MonkeyError(`argument to \`abs\` must be INTEGER`);
    return cachedInteger(Math.abs(args[0].value));
  }),
  // sort — sort an array (integers/strings)
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray))
      return new MonkeyError(`argument to \`sort\` must be ARRAY`);
    const sorted = [...args[0].elements].sort((a, b) => {
      if (a instanceof MonkeyInteger && b instanceof MonkeyInteger) return a.value - b.value;
      return a.inspect().localeCompare(b.inspect());
    });
    return new MonkeyArray(sorted);
  }),
  // reverse — reverse an array
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray))
      return new MonkeyError(`argument to \`reverse\` must be ARRAY`);
    return new MonkeyArray([...args[0].elements].reverse());
  }),
  // contains — check if array/string contains a value
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=2`);
    if (args[0] instanceof MonkeyArray) {
      return args[0].elements.some((el) => el.inspect() === args[1].inspect()) ? TRUE : FALSE;
    }
    if (args[0] instanceof MonkeyString && args[1] instanceof MonkeyString) {
      return args[0].value.includes(args[1].value) ? TRUE : FALSE;
    }
    return new MonkeyError(`\`contains\` not supported for ${args[0].type()}`);
  }),
  // sum — sum an array of integers
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray))
      return new MonkeyError(`argument to \`sum\` must be ARRAY`);
    let total = 0;
    for (const el of args[0].elements) {
      if (el instanceof MonkeyInteger) total += el.value;
    }
    return cachedInteger(total);
  }),
  // max — maximum of array
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray))
      return new MonkeyError(`argument to \`max\` must be ARRAY`);
    let m = -Infinity;
    for (const el of args[0].elements) {
      if (el instanceof MonkeyInteger && el.value > m) m = el.value;
    }
    return m === -Infinity ? NULL : cachedInteger(m);
  }),
  // min — minimum of array
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray))
      return new MonkeyError(`argument to \`min\` must be ARRAY`);
    let m = Infinity;
    for (const el of args[0].elements) {
      if (el instanceof MonkeyInteger && el.value < m) m = el.value;
    }
    return m === Infinity ? NULL : cachedInteger(m);
  }),
  // range — range(n) or range(start, end) or range(start, end, step)
  new MonkeyBuiltin((...args) => {
    if (args.length < 1 || args.length > 3) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1-3`);
    let start = 0, end, step = 1;
    if (args.length === 1) {
      end = args[0].value;
    } else {
      start = args[0].value;
      end = args[1].value;
      if (args.length === 3) step = args[2].value;
    }
    const result = [];
    if (step > 0) {
      for (let i = start; i < end; i += step) result.push(cachedInteger(i));
    } else if (step < 0) {
      for (let i = start; i > end; i += step) result.push(cachedInteger(i));
    }
    return new MonkeyArray(result);
  }),
  // flat — flatten one level
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray))
      return new MonkeyError(`argument to \`flat\` must be ARRAY`);
    const result = [];
    for (const el of args[0].elements) {
      if (el instanceof MonkeyArray) result.push(...el.elements);
      else result.push(el);
    }
    return new MonkeyArray(result);
  }),
  // zip — zip two arrays into pairs
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2 || !(args[0] instanceof MonkeyArray) || !(args[1] instanceof MonkeyArray))
      return new MonkeyError(`zip requires two ARRAY arguments`);
    const len = Math.min(args[0].elements.length, args[1].elements.length);
    const result = [];
    for (let i = 0; i < len; i++) {
      result.push(new MonkeyArray([args[0].elements[i], args[1].elements[i]]));
    }
    return new MonkeyArray(result);
  }),
  // enumerate — returns [[0, el0], [1, el1], ...]
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray))
      return new MonkeyError(`argument to \`enumerate\` must be ARRAY`);
    const result = [];
    for (let i = 0; i < args[0].elements.length; i++) {
      result.push(new MonkeyArray([cachedInteger(i), args[0].elements[i]]));
    }
    return new MonkeyArray(result);
  }),
  // Ok
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    return new MonkeyResult(true, args[0]);
  }),
  // Err
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    return new MonkeyResult(false, args[0]);
  }),
  // is_ok
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyResult)) return FALSE;
    return args[0].isOk ? TRUE : FALSE;
  }),
  // is_err
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyResult)) return FALSE;
    return args[0].isOk ? FALSE : TRUE;
  }),
  // unwrap
  new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyResult)) return new MonkeyError("unwrap requires a Result");
    if (!args[0].isOk) return new MonkeyError("unwrap called on Err: " + args[0].value.inspect());
    return args[0].value;
  }),
  // unwrap_or: Result, default → value (Ok value or default)
  new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return new MonkeyError(`wrong number of arguments. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyResult)) return args[0];
    return args[0].isOk ? args[0].value : args[1];
  })
];
var VM = class _VM {
  constructor(bytecode) {
    this.constants = bytecode.constants;
    this.globals = new Array(GLOBALS_SIZE);
    this.stack = new Array(STACK_SIZE);
    this.sp = 0;
    const mainFn = new CompiledFunction(bytecode.instructions);
    const mainClosure = new Closure(mainFn);
    this.frames = new Array(MAX_FRAMES);
    this.frames[0] = new Frame(mainClosure, 0);
    this.framesIndex = 1;
    this.jit = null;
    this.recorder = null;
    this._traceConsts = [];
  }
  enableJIT() {
    this.jit = new JIT();
    return this;
  }
  /** Create a VM that reuses an existing globals store (for REPL) */
  static withGlobals(bytecode, globals) {
    const vm = new _VM(bytecode);
    vm.globals = globals;
    return vm;
  }
  currentFrame() {
    return this.frames[this.framesIndex - 1];
  }
  pushFrame(frame) {
    this.frames[this.framesIndex] = frame;
    this.framesIndex++;
  }
  popFrame() {
    this.framesIndex--;
    return this.frames[this.framesIndex];
  }
  stackTop() {
    if (this.sp === 0) return null;
    return this.stack[this.sp - 1];
  }
  lastPoppedStackElem() {
    return this.stack[this.sp];
  }
  push(obj) {
    if (this.sp >= STACK_SIZE) throw new Error("stack overflow");
    this.stack[this.sp] = obj;
    this.sp++;
  }
  pop() {
    const obj = this.stack[this.sp - 1];
    this.sp--;
    return obj;
  }
  run() {
    let ip, ins, op;
    let frame = this.currentFrame();
    const recording = () => this.recorder && this.recorder.recording && !(this.recorder._skipDepth > 0);
    while (frame.ip < frame.closure.fn.instructions.length - 1) {
      frame.ip++;
      ip = frame.ip;
      ins = frame.closure.fn.instructions;
      op = ins[ip];
      if (recording() && this.recorder.instrCount > 0 && ip === this.recorder.startIp && this.framesIndex === this.recorder.startFrame && this.recorder.inlineDepth === 0) {
        const trace = this.recorder.stop();
        if (trace && this.jit && this.jit.compile(trace, this)) {
          this.jit.storeTrace(trace);
          if (!trace.isSideTrace) {
            try {
              this._executeTrace(trace);
            } catch (e) {
              for (const [key, t] of this.jit.traces) {
                if (t === trace) {
                  this.jit.traces.delete(key);
                  break;
                }
              }
            }
          }
          this.recorder = null;
          continue;
        }
        this.recorder = null;
      }
      if (recording() && this.recorder.instrCount > 0 && this.recorder.shouldStopSideTrace(ip, this.framesIndex)) {
        const trace = this.recorder.stop();
        if (trace && this.jit && this.jit.compile(trace, this)) {
          this.jit.storeTrace(trace);
        }
        this.recorder = null;
      }
      if (recording() && ++this.recorder.instrCount > 200) {
        this._abortRecording();
      }
      switch (op) {
        case Opcodes.OpConstant: {
          const constIdx = ins[ip + 1] << 8 | ins[ip + 2];
          frame.ip += 2;
          const constVal = this.constants[constIdx];
          this.push(constVal);
          if (recording()) {
            this._recordPush(op, constVal, [constIdx]);
          }
          break;
        }
        case Opcodes.OpPop:
          this.pop();
          if (recording()) {
            this.recorder.popRef();
          }
          break;
        case Opcodes.OpAdd:
        case Opcodes.OpSub:
        case Opcodes.OpMul:
        case Opcodes.OpDiv:
        case Opcodes.OpMod: {
          const right = this.pop();
          const left = this.pop();
          if (left instanceof MonkeyInteger && right instanceof MonkeyInteger) {
            if (recording()) {
              this.recorder.recordIntArith(op, left, right);
            }
            const specOp = QUICKEN_MAP[op];
            if (specOp !== void 0) {
              const counters = this._getQuickenCounters(ins);
              const count = (counters[ip] || 0) + 1;
              counters[ip] = count;
              if (count >= QUICKEN_THRESHOLD) {
                ins[ip] = specOp;
              }
            }
            let result;
            switch (op) {
              case Opcodes.OpAdd:
                result = left.value + right.value;
                break;
              case Opcodes.OpSub:
                result = left.value - right.value;
                break;
              case Opcodes.OpMul:
                result = left.value * right.value;
                break;
              case Opcodes.OpDiv:
                result = Math.trunc(left.value / right.value);
                break;
              case Opcodes.OpMod:
                result = left.value % right.value;
                break;
            }
            this.push(cachedInteger(result));
          } else if ((left instanceof MonkeyFloat || right instanceof MonkeyFloat) && (left instanceof MonkeyInteger || left instanceof MonkeyFloat) && (right instanceof MonkeyInteger || right instanceof MonkeyFloat)) {
            if (recording()) {
              this._abortRecording();
            }
            let result;
            switch (op) {
              case Opcodes.OpAdd:
                result = left.value + right.value;
                break;
              case Opcodes.OpSub:
                result = left.value - right.value;
                break;
              case Opcodes.OpMul:
                result = left.value * right.value;
                break;
              case Opcodes.OpDiv:
                result = left.value / right.value;
                break;
              case Opcodes.OpMod:
                result = left.value % right.value;
                break;
            }
            this.push(new MonkeyFloat(result));
          } else if (left instanceof MonkeyString && right instanceof MonkeyString && op === Opcodes.OpAdd) {
            if (recording()) {
              const rRef = this.recorder.popRef();
              const lRef = this.recorder.popRef();
              if (this.recorder.knownType(lRef) !== "string" && this.recorder.knownType(lRef) !== "raw_string") this.recorder.guardType(lRef, left);
              if (this.recorder.knownType(rRef) !== "string" && this.recorder.knownType(rRef) !== "raw_string") this.recorder.guardType(rRef, right);
              let lRaw = lRef;
              if (this.recorder.knownType(lRef) !== "raw_string") {
                lRaw = this.recorder.trace.addInst(IR.UNBOX_STRING, { ref: lRef });
                this.recorder.typeMap.set(lRaw, "raw_string");
              }
              let rRaw = rRef;
              if (this.recorder.knownType(rRef) !== "raw_string") {
                rRaw = this.recorder.trace.addInst(IR.UNBOX_STRING, { ref: rRef });
                this.recorder.typeMap.set(rRaw, "raw_string");
              }
              const concatRef = this.recorder.trace.addInst(IR.CONCAT, { left: lRaw, right: rRaw });
              this.recorder.typeMap.set(concatRef, "raw_string");
              const boxedRef = this.recorder.trace.addInst(IR.BOX_STRING, { ref: concatRef });
              this.recorder.typeMap.set(boxedRef, "string");
              this.recorder.pushRef(boxedRef);
            }
            this.push(new MonkeyString(left.value + right.value));
          } else if (left instanceof MonkeyString && right instanceof MonkeyInteger && op === Opcodes.OpMul) {
            if (recording()) {
              this.recorder.popRef();
              this.recorder.popRef();
              this.recorder.abort("string multiplication not JIT-compiled");
            }
            const n = right.value;
            this.push(new MonkeyString(n > 0 ? left.value.repeat(n) : ""));
          } else if (left instanceof MonkeyInteger && right instanceof MonkeyString && op === Opcodes.OpMul) {
            if (recording()) {
              this.recorder.popRef();
              this.recorder.popRef();
              this.recorder.abort("string multiplication not JIT-compiled");
            }
            const n = left.value;
            this.push(new MonkeyString(n > 0 ? right.value.repeat(n) : ""));
          } else if (left instanceof MonkeyArray && right instanceof MonkeyArray && op === Opcodes.OpAdd) {
            this.push(new MonkeyArray([...left.elements, ...right.elements]));
          } else {
            throw new Error(`unsupported types for ${op}: ${left.type()} and ${right.type()}`);
          }
          break;
        }
        case Opcodes.OpTrue:
          this.push(TRUE);
          if (recording()) {
            this._recordPush(op, TRUE, []);
          }
          break;
        case Opcodes.OpFalse:
          this.push(FALSE);
          if (recording()) {
            this._recordPush(op, FALSE, []);
          }
          break;
        case Opcodes.OpEqual:
        case Opcodes.OpNotEqual:
        case Opcodes.OpGreaterThan: {
          const right2 = this.pop();
          const left2 = this.pop();
          if (left2 instanceof MonkeyInteger && right2 instanceof MonkeyInteger) {
            if (recording()) {
              this.recorder.recordComparison(op, left2, right2);
            }
            const specOp2 = QUICKEN_MAP[op];
            if (specOp2 !== void 0) {
              const counters2 = this._getQuickenCounters(ins);
              const count2 = (counters2[ip] || 0) + 1;
              counters2[ip] = count2;
              if (count2 >= QUICKEN_THRESHOLD) {
                ins[ip] = specOp2;
              }
            }
            let result;
            switch (op) {
              case Opcodes.OpEqual:
                result = left2.value === right2.value;
                break;
              case Opcodes.OpNotEqual:
                result = left2.value !== right2.value;
                break;
              case Opcodes.OpGreaterThan:
                result = left2.value > right2.value;
                break;
            }
            this.push(result ? TRUE : FALSE);
          } else if (left2 instanceof MonkeyBoolean && right2 instanceof MonkeyBoolean) {
            if (recording()) {
              this._abortRecording();
            }
            let result;
            switch (op) {
              case Opcodes.OpEqual:
                result = left2.value === right2.value;
                break;
              case Opcodes.OpNotEqual:
                result = left2.value !== right2.value;
                break;
              default:
                throw new Error(`unknown operator for booleans`);
            }
            this.push(result ? TRUE : FALSE);
          } else if ((left2 instanceof MonkeyFloat || right2 instanceof MonkeyFloat) && (left2 instanceof MonkeyInteger || left2 instanceof MonkeyFloat) && (right2 instanceof MonkeyInteger || right2 instanceof MonkeyFloat)) {
            if (recording()) {
              this._abortRecording();
            }
            let result;
            switch (op) {
              case Opcodes.OpEqual:
                result = left2.value === right2.value;
                break;
              case Opcodes.OpNotEqual:
                result = left2.value !== right2.value;
                break;
              case Opcodes.OpGreaterThan:
                result = left2.value > right2.value;
                break;
            }
            this.push(result ? TRUE : FALSE);
          } else if (left2 instanceof MonkeyString && right2 instanceof MonkeyString) {
            if (recording()) {
              this._abortRecording();
            }
            let result;
            switch (op) {
              case Opcodes.OpEqual:
                result = left2.value === right2.value;
                break;
              case Opcodes.OpNotEqual:
                result = left2.value !== right2.value;
                break;
              case Opcodes.OpGreaterThan:
                result = left2.value > right2.value;
                break;
            }
            this.push(result ? TRUE : FALSE);
          } else if (left2 === NULL || right2 === NULL) {
            if (recording()) {
              this._abortRecording();
            }
            const result = op === Opcodes.OpEqual ? left2 === right2 : left2 !== right2;
            this.push(result ? TRUE : FALSE);
          } else if (left2 instanceof MonkeyEnum && right2 instanceof MonkeyEnum) {
            if (recording()) {
              this._abortRecording();
            }
            const eq = left2.enumName === right2.enumName && left2.variant === right2.variant;
            const result = op === Opcodes.OpEqual ? eq : !eq;
            this.push(result ? TRUE : FALSE);
          } else {
            throw new Error(`unsupported comparison: ${left2.type()} and ${right2.type()}`);
          }
          break;
        }
        case Opcodes.OpMinus: {
          const operand = this.pop();
          if (operand instanceof MonkeyFloat) {
            if (recording()) {
              this._abortRecording();
            }
            this.push(new MonkeyFloat(-operand.value));
            break;
          }
          if (!(operand instanceof MonkeyInteger)) {
            throw new Error(`unsupported type for negation: ${operand.type()}`);
          }
          if (recording()) {
            const ref = this.recorder.popRef();
            if (this.recorder.knownType(ref) !== "int") this.recorder.guardType(ref, operand);
            const unboxed = this.recorder.trace.addInst(IR.UNBOX_INT, { ref });
            const negRef = this.recorder.trace.addInst(IR.NEG, { ref: unboxed });
            const boxed = this.recorder.trace.addInst(IR.BOX_INT, { ref: negRef });
            this.recorder.typeMap.set(boxed, "int");
            this.recorder.pushRef(boxed);
          }
          this.push(cachedInteger(-operand.value));
          break;
        }
        case Opcodes.OpBang: {
          const operand2 = this.pop();
          if (recording()) {
            const ref = this.recorder.popRef();
            const notRef = this.recorder.trace.addInst(IR.NOT, { ref });
            this.recorder.typeMap.set(notRef, "raw_bool");
            const boxed = this.recorder.trace.addInst(IR.CONST_BOOL, { ref: notRef });
            this.recorder.typeMap.set(boxed, "bool");
            this.recorder.pushRef(boxed);
          }
          if (operand2 === TRUE) this.push(FALSE);
          else if (operand2 === FALSE) this.push(TRUE);
          else if (operand2 === NULL) this.push(TRUE);
          else this.push(FALSE);
          break;
        }
        case Opcodes.OpJumpNotTruthy: {
          const target = ins[ip + 1] << 8 | ins[ip + 2];
          frame.ip += 2;
          const condition = this.pop();
          const truthy = this.isTruthy(condition);
          if (recording()) {
            const condRef = this.recorder.popRef();
            const overrideExitIp = this.recorder.getGuardExitIp();
            if (truthy) {
              const exitIp = overrideExitIp !== null ? overrideExitIp : target;
              this.recorder.addGuardInst(IR.GUARD_TRUTHY, { ref: condRef, exitIp });
              this.recorder.trace.guardCount++;
            } else {
              const exitIp = overrideExitIp !== null ? overrideExitIp : ip + 3;
              this.recorder.addGuardInst(IR.GUARD_FALSY, { ref: condRef, exitIp });
              this.recorder.trace.guardCount++;
            }
          }
          if (!truthy) {
            frame.ip = target - 1;
          }
          break;
        }
        case Opcodes.OpJump: {
          const target2 = ins[ip + 1] << 8 | ins[ip + 2];
          if (this.jit && target2 <= ip && !(recording() && this.recorder.inlineDepth > 0)) {
            const closureId = this._closureId();
            const existingTrace = this.jit.getTrace(closureId, target2);
            if (existingTrace && existingTrace.compiled) {
              if (recording() && target2 !== this.recorder.startIp && !(this.recorder.isSideTrace && existingTrace === this.recorder.parentTrace)) {
                const constIdx = this._ensureTraceConst(existingTrace.compiled);
                this.recorder.trace.addInst(IR.EXEC_TRACE, { constIdx });
                this._executeTrace(existingTrace);
                break;
              } else if (!recording()) {
                const savedSp = this.sp;
                try {
                  this._executeTrace(existingTrace);
                } catch (e) {
                  this.sp = savedSp;
                  for (const [key, t] of this.jit.traces) {
                    if (t === existingTrace) {
                      this.jit.traces.delete(key);
                      break;
                    }
                  }
                  frame.ip = target2 - 1;
                }
                break;
              }
            }
            if (!recording() && this.jit.countEdge(closureId, target2)) {
              this._startRecording(target2);
            }
          }
          frame.ip = target2 - 1;
          break;
        }
        case Opcodes.OpNull:
          this.push(NULL);
          if (recording()) {
            this._recordPush(op, NULL, []);
          }
          break;
        case Opcodes.OpSetGlobal: {
          const globalIdx = ins[ip + 1] << 8 | ins[ip + 2];
          frame.ip += 2;
          const setGlobalVal = this.pop();
          this.globals[globalIdx] = setGlobalVal;
          if (recording()) {
            const valRef = this.recorder.popRef();
            this.recorder.trace.addInst(IR.STORE_GLOBAL, { index: globalIdx, value: valRef });
            this.recorder.trackGlobalStore(globalIdx, valRef);
          }
          break;
        }
        case Opcodes.OpGetGlobal: {
          const globalIdx2 = ins[ip + 1] << 8 | ins[ip + 2];
          frame.ip += 2;
          const getGlobalVal = this.globals[globalIdx2];
          this.push(getGlobalVal);
          if (recording()) {
            const ref = this.recorder.trace.addInst(IR.LOAD_GLOBAL, { index: globalIdx2 });
            this.recorder.pushRef(ref);
            this.recorder.trackGlobalLoad(globalIdx2, ref);
          }
          break;
        }
        case Opcodes.OpSetLocal: {
          const localIdx = ins[ip + 1];
          frame.ip += 1;
          const setVal = this.pop();
          this.stack[frame.basePointer + localIdx] = setVal;
          if (recording()) {
            const valRef = this.recorder.popRef();
            const absSlot = this.recorder.currentBaseOffset() + localIdx;
            this.recorder.trace.addInst(IR.STORE_LOCAL, { slot: absSlot, value: valRef });
            this.recorder.trackLocalStore(absSlot, valRef);
          }
          break;
        }
        case Opcodes.OpGetLocal: {
          const localIdx2 = ins[ip + 1];
          frame.ip += 1;
          const localVal = this.stack[frame.basePointer + localIdx2];
          this.push(localVal);
          if (recording()) {
            const absSlot = this.recorder.currentBaseOffset() + localIdx2;
            const inlineRef = this.recorder.inlineSlotRefs.get(absSlot);
            if (inlineRef !== void 0) {
              this.recorder.pushRef(inlineRef);
              this.recorder.trackLocalLoad(absSlot, inlineRef);
            } else {
              const ref = this.recorder.trace.addInst(IR.LOAD_LOCAL, { slot: absSlot });
              this.recorder.pushRef(ref);
              this.recorder.trackLocalLoad(absSlot, ref);
            }
          }
          break;
        }
        case Opcodes.OpArray: {
          if (recording()) {
            this._abortRecording();
          }
          const numElements = ins[ip + 1] << 8 | ins[ip + 2];
          frame.ip += 2;
          const elements = this.stack.slice(this.sp - numElements, this.sp);
          this.sp -= numElements;
          this.push(new MonkeyArray([...elements]));
          break;
        }
        case Opcodes.OpHash: {
          if (recording()) {
            this._abortRecording();
          }
          const numPairs = ins[ip + 1] << 8 | ins[ip + 2];
          frame.ip += 2;
          const pairs = /* @__PURE__ */ new Map();
          const hashElems = this.stack.slice(this.sp - numPairs, this.sp);
          this.sp -= numPairs;
          for (let i = 0; i < hashElems.length; i += 2) {
            const key = hashElems[i];
            const value = hashElems[i + 1];
            if (!key.fastHashKey) throw new Error(`unusable as hash key: ${key.type()}`);
            pairs.set(key.fastHashKey(), { key, value });
          }
          this.push(new MonkeyHash(pairs));
          break;
        }
        case Opcodes.OpIndex: {
          const index = this.pop();
          const left3 = this.pop();
          if (recording()) {
            if (left3 instanceof MonkeyArray && index instanceof MonkeyInteger) {
              const idxRef = this.recorder.popRef();
              const arrRef = this.recorder.popRef();
              if (this.recorder.knownType(arrRef) !== "array") {
                const exitIp = this.recorder.getGuardExitIp();
                this.recorder.addGuardInst(IR.GUARD_ARRAY, { ref: arrRef, exitIp });
                this.recorder.typeMap.set(arrRef, "array");
                this.recorder.trace.guardCount++;
              }
              if (this.recorder.knownType(idxRef) !== "int" && this.recorder.knownType(idxRef) !== "raw_int") {
                this.recorder.guardType(idxRef, index);
              }
              let idxUnboxed = idxRef;
              if (this.recorder.knownType(idxRef) !== "raw_int") {
                idxUnboxed = this.recorder.trace.addInst(IR.UNBOX_INT, { ref: idxRef });
                this.recorder.typeMap.set(idxUnboxed, "raw_int");
              }
              const exitIp2 = this.recorder.getGuardExitIp();
              this.recorder.addGuardInst(IR.GUARD_BOUNDS, { left: arrRef, right: idxUnboxed, exitIp: exitIp2 });
              this.recorder.trace.guardCount++;
              const resultRef = this.recorder.trace.addInst(IR.INDEX_ARRAY, { left: arrRef, right: idxUnboxed });
              this.recorder.typeMap.set(resultRef, "object");
              this.recorder.pushRef(resultRef);
            } else if (left3 instanceof MonkeyHash) {
              const keyRef = this.recorder.popRef();
              const hashRef = this.recorder.popRef();
              const exitIpH = this.recorder.getGuardExitIp();
              this.recorder.addGuardInst(IR.GUARD_HASH, { ref: hashRef, exitIp: exitIpH });
              this.recorder.typeMap.set(hashRef, "hash");
              this.recorder.trace.guardCount++;
              const resultRef = this.recorder.trace.addInst(IR.INDEX_HASH, { left: hashRef, right: keyRef });
              this.recorder.typeMap.set(resultRef, "object");
              this.recorder.pushRef(resultRef);
            } else {
              this._abortRecording();
            }
          }
          if (left3 instanceof MonkeyArray && index instanceof MonkeyInteger) {
            let i = index.value;
            if (i < 0) i += left3.elements.length;
            if (i < 0 || i >= left3.elements.length) {
              this.push(NULL);
            } else {
              this.push(left3.elements[i]);
            }
          } else if (left3 instanceof MonkeyHash) {
            if (!index.fastHashKey) throw new Error(`unusable as hash key: ${index.type()}`);
            const pair = left3.pairs.get(index.fastHashKey());
            this.push(pair ? pair.value : NULL);
          } else if (left3 instanceof MonkeyString && index instanceof MonkeyInteger) {
            let i = index.value;
            if (i < 0) i += left3.value.length;
            if (i < 0 || i >= left3.value.length) {
              this.push(NULL);
            } else {
              this.push(new MonkeyString(left3.value[i]));
            }
          } else if (left3 instanceof MonkeyString && index instanceof MonkeyString) {
            switch (index.value) {
              case "length":
                this.push(new MonkeyInteger(left3.value.length));
                break;
              default:
                this.push(NULL);
                break;
            }
          } else if (left3 instanceof MonkeyArray && index instanceof MonkeyString) {
            switch (index.value) {
              case "length":
                this.push(new MonkeyInteger(left3.elements.length));
                break;
              default:
                this.push(NULL);
                break;
            }
          } else {
            throw new Error(`index operator not supported: ${left3.type()}`);
          }
          break;
        }
        case Opcodes.OpCall: {
          const numArgs = ins[ip + 1];
          frame.ip += 1;
          const callee = this.stack[this.sp - 1 - numArgs];
          if (callee instanceof Closure) {
            if (callee.fn.hasRestParam) {
              const requiredParams = callee.fn.numParameters;
              const closurePos = this.sp - 1 - numArgs;
              const bp = closurePos + 1;
              if (numArgs < requiredParams) {
                for (let i = numArgs; i < requiredParams; i++) {
                  this.stack[bp + i] = NULL;
                }
                this.stack[bp + requiredParams] = new MonkeyArray([]);
                this.sp = bp + requiredParams + 1;
              } else {
                const restElements = [];
                for (let i = requiredParams; i < numArgs; i++) {
                  restElements.push(this.stack[bp + i]);
                }
                this.stack[bp + requiredParams] = new MonkeyArray(restElements);
                this.sp = bp + requiredParams + 1;
              }
              const callFrame2 = new Frame(callee, bp);
              this.pushFrame(callFrame2);
              this.sp = callFrame2.basePointer + callee.fn.numLocals;
              frame = callFrame2;
              break;
            } else if (numArgs > callee.fn.numParameters) {
              throw new Error(`wrong number of arguments: want=${callee.fn.numParameters}, got=${numArgs}`);
            }
            const missingArgs = callee.fn.numParameters - numArgs;
            for (let ma = 0; ma < missingArgs; ma++) {
              this.push(NULL);
            }
            const effectiveNumArgs = numArgs + missingArgs;
            if (this.jit && !recording()) {
              const funcTrace = this.jit.getFuncTrace(callee.fn);
              if (funcTrace && funcTrace.compiled) {
                try {
                  const result = this._executeFuncTrace(funcTrace, callee, effectiveNumArgs);
                  if (result && !result.exit) {
                    this.sp = this.sp - effectiveNumArgs - 1;
                    this.push(result);
                    break;
                  }
                } catch (e) {
                  this.jit.funcTraces.delete(callee.fn);
                }
              }
            }
            if (recording() && this.recorder.isFuncTrace && callee.fn === this.recorder.tracedFn) {
              const argRefs = [];
              for (let i = 0; i < numArgs; i++) {
                argRefs.unshift(this.recorder.popRef());
              }
              this.recorder.popRef();
              const ref = this.recorder.trace.addInst(IR.SELF_CALL, { args: argRefs });
              const callFrame2 = new Frame(callee, this.sp - numArgs);
              this.pushFrame(callFrame2);
              this.sp = callFrame2.basePointer + callee.fn.numLocals;
              frame = callFrame2;
              this.recorder._skipDepth = (this.recorder._skipDepth || 0) + 1;
              this.recorder._skipReturnFrame = this.framesIndex;
              this.recorder._pendingSelfCallRef = ref;
              break;
            }
            if (recording()) {
              const rootBp = this.frames[this.recorder.startFrame - 1].basePointer;
              const calleeBp = this.sp - numArgs;
              const baseOffset = calleeBp - rootBp;
              const closureRef = this.recorder.peekRef(numArgs);
              if (closureRef !== void 0) {
                this.recorder.trace.addInst(IR.GUARD_CLOSURE, {
                  ref: closureRef,
                  fnId: callee.fn.id,
                  exitIp: -1
                  // Special: invalidate trace on mismatch
                });
                this.recorder.trace.guardCount++;
              }
              const argRefs = [];
              for (let i = 0; i < numArgs; i++) {
                argRefs.unshift(this.recorder.popRef());
              }
              this.recorder.popRef();
              if (!this.recorder.enterInlineFrame(baseOffset, callee.fn.numLocals, ip)) {
                this._abortRecording();
              } else if (this._hasBackwardJump(callee.fn.instructions)) {
                this.recorder.leaveInlineFrame();
                this._abortRecording();
              } else {
                for (let i = 0; i < numArgs; i++) {
                  this.recorder.inlineSlotRefs.set(baseOffset + i, argRefs[i]);
                }
              }
            }
            const callFrame = new Frame(callee, this.sp - effectiveNumArgs);
            this.pushFrame(callFrame);
            this.sp = callFrame.basePointer + callee.fn.numLocals;
            frame = callFrame;
            if (this.jit && !recording() && !this.jit.getFuncTrace(callee.fn) && !this.jit.uncompilableFns.has(callee.fn)) {
              if (this.jit.countFuncCall(callee.fn)) {
                const trace = this.jit.compileFunction(callee.fn, this.constants, this);
                if (trace) {
                  this.jit.funcTraces.set(callee.fn, trace);
                  this.jit.traceCount++;
                } else {
                  this.jit.uncompilableFns.add(callee.fn);
                }
              }
            }
          } else if (callee instanceof MonkeyBuiltin) {
            const builtinIdx = BUILTINS2.indexOf(callee);
            if (recording() && builtinIdx === 0 && numArgs === 1) {
              const argRef = this.recorder.popRef();
              this.recorder.popRef();
              const ref = this.recorder.trace.addInst(IR.BUILTIN_LEN, { ref: argRef });
              this.recorder.typeMap.set(ref, "raw_int");
              this.recorder.pushRef(ref);
              const args = this.stack.slice(this.sp - numArgs, this.sp);
              const result = callee.fn(...args);
              this.sp = this.sp - numArgs - 1;
              this.push(result !== void 0 ? result : NULL);
            } else if (recording() && builtinIdx === 5 && numArgs === 2) {
              const valRef = this.recorder.popRef();
              const arrRef = this.recorder.popRef();
              this.recorder.popRef();
              const ref = this.recorder.trace.addInst(IR.BUILTIN_PUSH, { array: arrRef, value: valRef });
              this.recorder.typeMap.set(ref, "object");
              this.recorder.pushRef(ref);
              const args = this.stack.slice(this.sp - numArgs, this.sp);
              const result = callee.fn(...args);
              this.sp = this.sp - numArgs - 1;
              this.push(result !== void 0 ? result : NULL);
            } else {
              if (recording()) {
                this._abortRecording();
              }
              const args = this.stack.slice(this.sp - numArgs, this.sp);
              const result = callee.fn(...args);
              this.sp = this.sp - numArgs - 1;
              this.push(result !== void 0 ? result : NULL);
            }
          } else {
            throw new Error(`calling non-function/non-builtin: got ${callee?.constructor?.name || typeof callee} (sp=${this.sp}, bp=${frame.basePointer})`);
          }
          break;
        }
        case Opcodes.OpReturnValue: {
          const returnValue = this.pop();
          if (this.recorder && this.recorder.recording && this.recorder._skipDepth > 0) {
            const retFrame2 = this.popFrame();
            this.sp = retFrame2.basePointer - 1;
            this.push(returnValue);
            frame = this.currentFrame();
            if (this.framesIndex < this.recorder._skipReturnFrame) {
              this.recorder._skipDepth--;
              if (this.recorder._skipDepth === 0 && this.recorder._pendingSelfCallRef !== void 0) {
                this.recorder.pushRef(this.recorder._pendingSelfCallRef);
                this.recorder._pendingSelfCallRef = void 0;
              }
            }
            break;
          }
          if (recording() && this.recorder.isFuncTrace && this.recorder.inlineDepth === 0 && this.framesIndex === this.recorder.startFrame) {
            const retRef = this.recorder.popRef();
            this.recorder.trace.addInst(IR.FUNC_RETURN, { ref: retRef });
            const trace = this.recorder.stop();
            if (trace && this.jit && this.jit.compile(trace, this)) {
              this.jit.storeFuncTrace(trace);
            }
            this.recorder = null;
            const retFrame2 = this.popFrame();
            this.sp = retFrame2.basePointer - 1;
            this.push(returnValue);
            frame = this.currentFrame();
            break;
          }
          if (recording() && this.recorder.inlineDepth > 0) {
            const retRef = this.recorder.popRef();
            this.recorder.leaveInlineFrame();
            const retFrame2 = this.popFrame();
            this.sp = retFrame2.basePointer - 1;
            this.push(returnValue);
            frame = this.currentFrame();
            this.recorder.pushRef(retRef);
            break;
          }
          const retFrame = this.popFrame();
          this.sp = retFrame.basePointer - 1;
          this.push(returnValue);
          frame = this.currentFrame();
          break;
        }
        case Opcodes.OpReturn: {
          if (this.recorder && this.recorder.recording && this.recorder._skipDepth > 0) {
            const frame22 = this.popFrame();
            this.sp = frame22.basePointer - 1;
            this.push(NULL);
            frame = this.currentFrame();
            if (this.framesIndex < this.recorder._skipReturnFrame) {
              this.recorder._skipDepth--;
              if (this.recorder._skipDepth === 0 && this.recorder._pendingSelfCallRef !== void 0) {
                this.recorder.pushRef(this.recorder._pendingSelfCallRef);
                this.recorder._pendingSelfCallRef = void 0;
              }
            }
            break;
          }
          if (recording() && this.recorder.isFuncTrace && this.recorder.inlineDepth === 0 && this.framesIndex === this.recorder.startFrame) {
            const nullRef = this.recorder.trace.addInst(IR.CONST_NULL);
            this.recorder.trace.addInst(IR.FUNC_RETURN, { ref: nullRef });
            const trace = this.recorder.stop();
            if (trace && this.jit && this.jit.compile(trace, this)) {
              this.jit.storeFuncTrace(trace);
            }
            this.recorder = null;
            const frame22 = this.popFrame();
            this.sp = frame22.basePointer - 1;
            this.push(NULL);
            frame = this.currentFrame();
            break;
          }
          if (recording() && this.recorder.inlineDepth > 0) {
            this.recorder.leaveInlineFrame();
            const frame22 = this.popFrame();
            this.sp = frame22.basePointer - 1;
            this.push(NULL);
            frame = this.currentFrame();
            const nullRef = this.recorder.trace.addInst(IR.CONST_NULL);
            this.recorder.typeMap.set(nullRef, "null");
            this.recorder.pushRef(nullRef);
            break;
          }
          const frame2 = this.popFrame();
          this.sp = frame2.basePointer - 1;
          this.push(NULL);
          frame = this.currentFrame();
          break;
        }
        case Opcodes.OpClosure: {
          const constIdx2 = ins[ip + 1] << 8 | ins[ip + 2];
          const numFree = ins[ip + 3];
          frame.ip += 3;
          const fn = this.constants[constIdx2];
          const free = new Array(numFree);
          for (let i = 0; i < numFree; i++) {
            free[i] = this.stack[this.sp - numFree + i];
          }
          this.sp -= numFree;
          const closure = new Closure(fn, free);
          this.push(closure);
          if (recording()) {
            for (let i = 0; i < numFree; i++) {
              this.recorder.popRef();
            }
            const closureRef = this.recorder.trace.addInst(IR.CONST_OBJ, {
              constIdx: this._ensureTraceConst(closure)
            });
            this.recorder.typeMap.set(closureRef, "object");
            this.recorder.pushRef(closureRef);
          }
          break;
        }
        case Opcodes.OpGetFree: {
          const freeIdx = ins[ip + 1];
          frame.ip += 1;
          const freeVal = frame.closure.free[freeIdx];
          this.push(freeVal);
          if (recording()) {
            if (this.recorder.inlineDepth > 0) {
              this._recordPushAsConst(freeVal);
            } else {
              this._recordPush(op, freeVal, [freeIdx]);
            }
          }
          break;
        }
        case Opcodes.OpSetFree: {
          const freeIdx2 = ins[ip + 1];
          frame.ip += 1;
          frame.closure.free[freeIdx2] = this.pop();
          if (recording()) {
            this.recorder.abort("OpSetFree not JIT-compiled");
          }
          break;
        }
        case Opcodes.OpSetIndex: {
          const val = this.pop();
          const index = this.pop();
          const obj = this.pop();
          if (obj instanceof MonkeyArray && index instanceof MonkeyInteger) {
            let i = index.value;
            if (i < 0) i += obj.elements.length;
            if (i >= 0 && i < obj.elements.length) {
              obj.elements[i] = val;
            }
          } else if (obj instanceof MonkeyHash) {
            if (index.fastHashKey) {
              obj.pairs.set(index.fastHashKey(), { key: index, value: val });
            }
          }
          this.push(val);
          if (recording()) {
            this.recorder.abort("OpSetIndex not JIT-compiled");
          }
          break;
        }
        case Opcodes.OpSlice: {
          const end = this.pop();
          const start = this.pop();
          const obj = this.pop();
          if (obj instanceof MonkeyArray) {
            const len = obj.elements.length;
            let s = start === NULL ? 0 : start.value;
            let e = end === NULL ? len : end.value;
            if (s < 0) s += len;
            if (e < 0) e += len;
            if (s < 0) s = 0;
            if (e > len) e = len;
            this.push(new MonkeyArray(obj.elements.slice(s, e)));
          } else if (obj instanceof MonkeyString) {
            const len = obj.value.length;
            let s = start === NULL ? 0 : start.value;
            let e = end === NULL ? len : end.value;
            if (s < 0) s += len;
            if (e < 0) e += len;
            if (s < 0) s = 0;
            if (e > len) e = len;
            this.push(new MonkeyString(obj.value.slice(s, e)));
          } else {
            this.push(NULL);
          }
          if (recording()) {
            this.recorder.abort("OpSlice not JIT-compiled");
          }
          break;
        }
        case Opcodes.OpTypeCheck: {
          const localIdx = ins[ip + 1];
          const typeIdx = ins[ip + 2] << 8 | ins[ip + 3];
          frame.ip += 3;
          const val = this.stack[frame.basePointer + localIdx];
          const typeName = this.constants[typeIdx];
          let ok = false;
          switch (typeName) {
            case "int":
              ok = val instanceof MonkeyInteger;
              break;
            case "bool":
              ok = val instanceof MonkeyBoolean;
              break;
            case "string":
              ok = val instanceof MonkeyString;
              break;
            case "array":
              ok = val instanceof MonkeyArray;
              break;
            case "hash":
              ok = val instanceof MonkeyHash;
              break;
            case "fn":
              ok = val instanceof Closure || val instanceof MonkeyFunction || val instanceof MonkeyBuiltin;
              break;
            case "null":
              ok = val === NULL;
              break;
            case "Ok":
              ok = val instanceof MonkeyResult && val.isOk;
              break;
            case "Err":
              ok = val instanceof MonkeyResult && !val.isOk;
              break;
            default:
              ok = true;
          }
          if (!ok) {
            const actualType = val === NULL ? "null" : val.constructor.name.replace("Monkey", "").toLowerCase();
            throw new Error(`Type error: expected ${typeName}, got ${actualType}`);
          }
          if (recording()) {
            const absSlot = this.recorder.currentBaseOffset() + localIdx;
            this.recorder.trustedTypes.set(absSlot, typeName);
          }
          break;
        }
        case Opcodes.OpTypeIs: {
          const typeIdx8 = ins[ip + 1] << 8 | ins[ip + 2];
          frame.ip += 2;
          const val8 = this.pop();
          const typeName8 = this.constants[typeIdx8];
          let ok8 = false;
          switch (typeName8) {
            case "int":
              ok8 = val8 instanceof MonkeyInteger;
              break;
            case "bool":
              ok8 = val8 instanceof MonkeyBoolean;
              break;
            case "string":
              ok8 = val8 instanceof MonkeyString;
              break;
            case "array":
              ok8 = val8 instanceof MonkeyArray;
              break;
            case "hash":
              ok8 = val8 instanceof MonkeyHash;
              break;
            case "fn":
              ok8 = val8 instanceof Closure || val8 instanceof MonkeyFunction || val8 instanceof MonkeyBuiltin;
              break;
            case "null":
              ok8 = val8 === NULL;
              break;
            case "Ok":
              ok8 = val8 instanceof MonkeyResult && val8.isOk;
              break;
            case "Err":
              ok8 = val8 instanceof MonkeyResult && !val8.isOk;
              break;
            default:
              ok8 = false;
          }
          this.push(ok8 ? TRUE : FALSE);
          if (recording()) {
            this.recorder.abort("OpTypeIs not JIT-compiled");
          }
          break;
        }
        case Opcodes.OpResultValue: {
          const rv = this.pop();
          if (rv instanceof MonkeyResult) {
            this.push(rv.value);
          } else {
            this.push(NULL);
          }
          break;
        }
        case Opcodes.OpCurrentClosure:
          this.push(frame.closure);
          if (recording()) {
            const closureRef = this.recorder.trace.addInst(IR.CONST_OBJ, {
              constIdx: this._ensureTraceConst(frame.closure)
            });
            this.recorder.typeMap.set(closureRef, "object");
            this.recorder.pushRef(closureRef);
          }
          break;
        case Opcodes.OpGetBuiltin: {
          const builtinIdx = ins[ip + 1];
          frame.ip += 1;
          this.push(BUILTINS2[builtinIdx]);
          if (recording()) {
            const ref = this.recorder.trace.addInst(IR.CONST_OBJ, {
              constIdx: this._ensureTraceConst(BUILTINS2[builtinIdx])
            });
            this.recorder.typeMap.set(ref, "object");
            this.recorder.pushRef(ref);
          }
          break;
        }
        case Opcodes.OpAddConst:
        case Opcodes.OpSubConst:
        case Opcodes.OpMulConst:
        case Opcodes.OpModConst:
        case Opcodes.OpDivConst: {
          const constIdx3 = ins[ip + 1] << 8 | ins[ip + 2];
          frame.ip += 2;
          const left4 = this.pop();
          const right4 = this.constants[constIdx3];
          if (left4 instanceof MonkeyInteger && right4 instanceof MonkeyInteger) {
            if (recording()) {
              const constRef = this.recorder.trace.addInst(IR.CONST_INT, { value: right4.value });
              this.recorder.typeMap.set(constRef, "raw_int");
              this.recorder.pushRef(constRef);
              this.recorder.recordIntArith(op, left4, right4);
            }
            let result;
            switch (op) {
              case Opcodes.OpAddConst:
                result = left4.value + right4.value;
                break;
              case Opcodes.OpSubConst:
                result = left4.value - right4.value;
                break;
              case Opcodes.OpMulConst:
                result = left4.value * right4.value;
                break;
              case Opcodes.OpDivConst:
                result = Math.trunc(left4.value / right4.value);
                break;
              case Opcodes.OpModConst:
                result = left4.value % right4.value;
                break;
            }
            this.push(cachedInteger(result));
          } else if (left4 instanceof MonkeyString && right4 instanceof MonkeyString && op === Opcodes.OpAddConst) {
            if (recording()) {
              const constRef = this.recorder.trace.addInst(IR.CONST_OBJ, { constIdx: constIdx3 });
              this.recorder.typeMap.set(constRef, "string");
              const lRef = this.recorder.popRef();
              if (this.recorder.knownType(lRef) !== "string" && this.recorder.knownType(lRef) !== "raw_string") this.recorder.guardType(lRef, left4);
              let lRaw = lRef;
              if (this.recorder.knownType(lRef) !== "raw_string") {
                lRaw = this.recorder.trace.addInst(IR.UNBOX_STRING, { ref: lRef });
                this.recorder.typeMap.set(lRaw, "raw_string");
              }
              let rRaw = constRef;
              if (this.recorder.knownType(constRef) !== "raw_string") {
                rRaw = this.recorder.trace.addInst(IR.UNBOX_STRING, { ref: constRef });
                this.recorder.typeMap.set(rRaw, "raw_string");
              }
              const concatRef = this.recorder.trace.addInst(IR.CONCAT, { left: lRaw, right: rRaw });
              this.recorder.typeMap.set(concatRef, "raw_string");
              const boxedRef = this.recorder.trace.addInst(IR.BOX_STRING, { ref: concatRef });
              this.recorder.typeMap.set(boxedRef, "string");
              this.recorder.pushRef(boxedRef);
            }
            this.push(new MonkeyString(left4.value + right4.value));
          } else if (left4 instanceof MonkeyString && right4 instanceof MonkeyInteger && op === Opcodes.OpMulConst) {
            if (recording()) {
              this.recorder.popRef();
              this.recorder.abort("string multiplication not JIT-compiled");
            }
            const n = right4.value;
            this.push(new MonkeyString(n > 0 ? left4.value.repeat(n) : ""));
          } else if (left4 instanceof MonkeyInteger && right4 instanceof MonkeyString && op === Opcodes.OpMulConst) {
            if (recording()) {
              this.recorder.popRef();
              this.recorder.abort("string multiplication not JIT-compiled");
            }
            const n = left4.value;
            this.push(new MonkeyString(n > 0 ? right4.value.repeat(n) : ""));
          } else {
            throw new Error(`unsupported types for constant op: ${left4.type()} and ${right4.type()}`);
          }
          break;
        }
        // Superinstructions: fused OpGetLocal + Op*Const
        case Opcodes.OpGetLocalAddConst:
        case Opcodes.OpGetLocalSubConst:
        case Opcodes.OpGetLocalMulConst:
        case Opcodes.OpGetLocalDivConst: {
          const localIdx3 = ins[ip + 1];
          const constIdx4 = ins[ip + 2] << 8 | ins[ip + 3];
          frame.ip += 3;
          const leftVal = this.stack[frame.basePointer + localIdx3];
          const rightVal = this.constants[constIdx4];
          if (leftVal instanceof MonkeyInteger && rightVal instanceof MonkeyInteger) {
            if (recording()) {
              const absSlot = this.recorder.currentBaseOffset() + localIdx3;
              const inlineRef = this.recorder.inlineSlotRefs.get(absSlot);
              let localRef;
              if (inlineRef !== void 0) {
                localRef = inlineRef;
              } else {
                localRef = this.recorder.trace.addInst(IR.LOAD_LOCAL, { slot: absSlot });
              }
              this.recorder.trackLocalLoad(absSlot, localRef);
              this.recorder.pushRef(localRef);
              const constRef = this.recorder.trace.addInst(IR.CONST_INT, { value: rightVal.value });
              this.recorder.typeMap.set(constRef, "raw_int");
              this.recorder.pushRef(constRef);
              const baseOp = op === Opcodes.OpGetLocalAddConst ? Opcodes.OpAdd : op === Opcodes.OpGetLocalSubConst ? Opcodes.OpSub : op === Opcodes.OpGetLocalMulConst ? Opcodes.OpMul : Opcodes.OpDiv;
              this.recorder.recordIntArith(baseOp, leftVal, rightVal);
            }
            let result;
            switch (op) {
              case Opcodes.OpGetLocalAddConst:
                result = leftVal.value + rightVal.value;
                break;
              case Opcodes.OpGetLocalSubConst:
                result = leftVal.value - rightVal.value;
                break;
              case Opcodes.OpGetLocalMulConst:
                result = leftVal.value * rightVal.value;
                break;
              case Opcodes.OpGetLocalDivConst:
                result = Math.trunc(leftVal.value / rightVal.value);
                break;
            }
            this.push(cachedInteger(result));
          } else if (leftVal instanceof MonkeyString && rightVal instanceof MonkeyString && op === Opcodes.OpGetLocalAddConst) {
            if (recording()) {
              this._abortRecording();
            }
            this.push(new MonkeyString(leftVal.value + rightVal.value));
          } else {
            throw new Error(`unsupported types for local+const op: ${leftVal.type()} and ${rightVal.type()}`);
          }
          break;
        }
        // Integer-specialized opcodes: skip instanceof checks for the fast path.
        // If quickened (not compiler-emitted), deopt back to generic on type mismatch.
        // Integer-specialized opcodes with inlined stack operations.
        // Direct stack[] access avoids this.pop()/this.push() method call overhead.
        case Opcodes.OpAddInt: {
          const r = this.stack[--this.sp];
          const l = this.stack[--this.sp];
          if (!(l instanceof MonkeyInteger) || !(r instanceof MonkeyInteger)) {
            ins[ip] = Opcodes.OpAdd;
            this.stack[this.sp++] = l;
            this.stack[this.sp++] = r;
            frame.ip--;
            break;
          }
          if (recording()) {
            this.recorder.recordIntArith(op, l, r);
          }
          this.stack[this.sp++] = cachedInteger(l.value + r.value);
          break;
        }
        case Opcodes.OpSubInt: {
          const r = this.stack[--this.sp];
          const l = this.stack[--this.sp];
          if (!(l instanceof MonkeyInteger) || !(r instanceof MonkeyInteger)) {
            ins[ip] = Opcodes.OpSub;
            this.stack[this.sp++] = l;
            this.stack[this.sp++] = r;
            frame.ip--;
            break;
          }
          if (recording()) {
            this.recorder.recordIntArith(op, l, r);
          }
          this.stack[this.sp++] = cachedInteger(l.value - r.value);
          break;
        }
        case Opcodes.OpMulInt: {
          const r = this.stack[--this.sp];
          const l = this.stack[--this.sp];
          if (!(l instanceof MonkeyInteger) || !(r instanceof MonkeyInteger)) {
            ins[ip] = Opcodes.OpMul;
            this.stack[this.sp++] = l;
            this.stack[this.sp++] = r;
            frame.ip--;
            break;
          }
          if (recording()) {
            this.recorder.recordIntArith(op, l, r);
          }
          this.stack[this.sp++] = cachedInteger(l.value * r.value);
          break;
        }
        case Opcodes.OpDivInt: {
          const r = this.stack[--this.sp];
          const l = this.stack[--this.sp];
          if (!(l instanceof MonkeyInteger) || !(r instanceof MonkeyInteger)) {
            ins[ip] = Opcodes.OpDiv;
            this.stack[this.sp++] = l;
            this.stack[this.sp++] = r;
            frame.ip--;
            break;
          }
          if (recording()) {
            this.recorder.recordIntArith(op, l, r);
          }
          this.stack[this.sp++] = cachedInteger(Math.trunc(l.value / r.value));
          break;
        }
        case Opcodes.OpModInt: {
          const r = this.stack[--this.sp];
          const l = this.stack[--this.sp];
          if (!(l instanceof MonkeyInteger) || !(r instanceof MonkeyInteger)) {
            ins[ip] = Opcodes.OpMod;
            this.stack[this.sp++] = l;
            this.stack[this.sp++] = r;
            frame.ip--;
            break;
          }
          if (recording()) {
            this.recorder.recordIntArith(op, l, r);
          }
          this.stack[this.sp++] = cachedInteger(l.value % r.value);
          break;
        }
        case Opcodes.OpGreaterThanInt: {
          const r = this.stack[--this.sp];
          const l = this.stack[--this.sp];
          if (!(l instanceof MonkeyInteger) || !(r instanceof MonkeyInteger)) {
            ins[ip] = Opcodes.OpGreaterThan;
            this.stack[this.sp++] = l;
            this.stack[this.sp++] = r;
            frame.ip--;
            break;
          }
          if (recording()) {
            this.recorder.recordComparison(op, l, r);
          }
          this.stack[this.sp++] = l.value > r.value ? TRUE : FALSE;
          break;
        }
        case Opcodes.OpLessThanInt: {
          const r = this.stack[--this.sp];
          const l = this.stack[--this.sp];
          if (!(l instanceof MonkeyInteger) || !(r instanceof MonkeyInteger)) {
            throw new Error(`unsupported types for LessThanInt: ${l.type()} and ${r.type()}`);
          }
          if (recording()) {
            this.recorder.recordComparison(op, l, r);
          }
          this.stack[this.sp++] = l.value < r.value ? TRUE : FALSE;
          break;
        }
        case Opcodes.OpEqualInt: {
          const r = this.stack[--this.sp];
          const l = this.stack[--this.sp];
          if (!(l instanceof MonkeyInteger) || !(r instanceof MonkeyInteger)) {
            ins[ip] = Opcodes.OpEqual;
            this.stack[this.sp++] = l;
            this.stack[this.sp++] = r;
            frame.ip--;
            break;
          }
          if (recording()) {
            this.recorder.recordComparison(op, l, r);
          }
          this.stack[this.sp++] = l.value === r.value ? TRUE : FALSE;
          break;
        }
        case Opcodes.OpNotEqualInt: {
          const r = this.stack[--this.sp];
          const l = this.stack[--this.sp];
          if (!(l instanceof MonkeyInteger) || !(r instanceof MonkeyInteger)) {
            ins[ip] = Opcodes.OpNotEqual;
            this.stack[this.sp++] = l;
            this.stack[this.sp++] = r;
            frame.ip--;
            break;
          }
          if (recording()) {
            this.recorder.recordComparison(op, l, r);
          }
          this.stack[this.sp++] = l.value !== r.value ? TRUE : FALSE;
          break;
        }
        case Opcodes.OpSetFree: {
          const fIdx = ins[ip + 1];
          frame.ip += 1;
          frame.closure.free[fIdx] = this.stack[--this.sp];
          break;
        }
        case Opcodes.OpSetIndex: {
          const val5 = this.stack[--this.sp];
          const idx5 = this.stack[--this.sp];
          const obj5 = this.stack[--this.sp];
          if (obj5 instanceof MonkeyArray && idx5 instanceof MonkeyInteger) {
            let i5 = idx5.value;
            if (i5 < 0) i5 += obj5.elements.length;
            if (i5 >= 0 && i5 < obj5.elements.length) obj5.elements[i5] = val5;
          } else if (obj5 instanceof MonkeyHash && idx5.fastHashKey) {
            obj5.pairs.set(idx5.fastHashKey(), { key: idx5, value: val5 });
          }
          this.stack[this.sp++] = val5;
          break;
        }
        case Opcodes.OpSlice: {
          const end5 = this.stack[--this.sp];
          const start5 = this.stack[--this.sp];
          const obj6 = this.stack[--this.sp];
          if (obj6 instanceof MonkeyArray) {
            const len5 = obj6.elements.length;
            let s5 = start5 === NULL ? 0 : start5.value;
            let e5 = end5 === NULL ? len5 : end5.value;
            if (s5 < 0) s5 += len5;
            if (e5 < 0) e5 += len5;
            if (s5 < 0) s5 = 0;
            if (e5 > len5) e5 = len5;
            this.stack[this.sp++] = new MonkeyArray(obj6.elements.slice(s5, e5));
          } else if (obj6 instanceof MonkeyString) {
            const len5 = obj6.value.length;
            let s5 = start5 === NULL ? 0 : start5.value;
            let e5 = end5 === NULL ? len5 : end5.value;
            if (s5 < 0) s5 += len5;
            if (e5 < 0) e5 += len5;
            if (s5 < 0) s5 = 0;
            if (e5 > len5) e5 = len5;
            this.stack[this.sp++] = new MonkeyString(obj6.value.slice(s5, e5));
          } else {
            this.stack[this.sp++] = NULL;
          }
          break;
        }
        case Opcodes.OpTypeCheck: {
          const localIdx7 = ins[ip + 1];
          const typeIdx7 = ins[ip + 2] << 8 | ins[ip + 3];
          frame.ip += 3;
          const val7 = this.stack[frame.basePointer + localIdx7];
          const typeName7 = this.constants[typeIdx7];
          let ok7 = false;
          switch (typeName7) {
            case "int":
              ok7 = val7 instanceof MonkeyInteger;
              break;
            case "bool":
              ok7 = val7 instanceof MonkeyBoolean;
              break;
            case "string":
              ok7 = val7 instanceof MonkeyString;
              break;
            case "array":
              ok7 = val7 instanceof MonkeyArray;
              break;
            case "hash":
              ok7 = val7 instanceof MonkeyHash;
              break;
            case "fn":
              ok7 = val7 instanceof Closure || val7 instanceof MonkeyFunction || val7 instanceof MonkeyBuiltin;
              break;
            case "null":
              ok7 = val7 === NULL;
              break;
            case "Ok":
              ok7 = val7 instanceof MonkeyResult && val7.isOk;
              break;
            case "Err":
              ok7 = val7 instanceof MonkeyResult && !val7.isOk;
              break;
            default:
              ok7 = true;
          }
          if (!ok7) {
            const actualType7 = val7 === NULL ? "null" : val7.constructor.name.replace("Monkey", "").toLowerCase();
            throw new Error(`Type error: expected ${typeName7}, got ${actualType7}`);
          }
          break;
        }
        case Opcodes.OpTypeIs: {
          const typeIdx9 = ins[ip + 1] << 8 | ins[ip + 2];
          frame.ip += 2;
          const val9 = this.stack[--this.sp];
          const typeName9 = this.constants[typeIdx9];
          let ok9 = false;
          switch (typeName9) {
            case "int":
              ok9 = val9 instanceof MonkeyInteger;
              break;
            case "bool":
              ok9 = val9 instanceof MonkeyBoolean;
              break;
            case "string":
              ok9 = val9 instanceof MonkeyString;
              break;
            case "array":
              ok9 = val9 instanceof MonkeyArray;
              break;
            case "hash":
              ok9 = val9 instanceof MonkeyHash;
              break;
            case "fn":
              ok9 = val9 instanceof Closure || val9 instanceof MonkeyFunction || val9 instanceof MonkeyBuiltin;
              break;
            case "null":
              ok9 = val9 === NULL;
              break;
            case "Ok":
              ok9 = val9 instanceof MonkeyResult && val9.isOk;
              break;
            case "Err":
              ok9 = val9 instanceof MonkeyResult && !val9.isOk;
              break;
            default:
              ok9 = false;
          }
          this.stack[this.sp++] = ok9 ? TRUE : FALSE;
          break;
        }
        default:
          throw new Error(`unknown opcode: ${op}`);
      }
    }
  }
  isTruthy(obj) {
    if (obj instanceof MonkeyBoolean) return obj.value;
    if (obj === NULL) return false;
    return true;
  }
  // --- JIT Integration ---
  // Store a runtime object as a trace constant, returning its index
  // Used for closures and other objects that don't exist in the bytecode constant pool
  _ensureTraceConst(obj) {
    let idx = this._traceConsts.indexOf(obj);
    if (idx === -1) {
      idx = this._traceConsts.length;
      this._traceConsts.push(obj);
    }
    return this.constants.length + idx;
  }
  // Get a stable identity for the current closure (for trace keying)
  _hasBackwardJump(instructions) {
    const OpJump = Opcodes.OpJump;
    for (let i = 0; i < instructions.length - 2; i++) {
      if (instructions[i] === OpJump) {
        const target = instructions[i + 1] << 8 | instructions[i + 2];
        if (target <= i) return true;
        i += 2;
      }
    }
    return false;
  }
  _closureId() {
    return this.currentFrame().closure.fn.id;
  }
  // Execute a compiled trace, returns true if trace ran (even if it exited)
  _executeTrace(trace) {
    const frame = this.currentFrame();
    const allConsts = this._traceConsts.length > 0 ? [...this.constants, ...this._traceConsts] : this.constants;
    let currentTrace = trace;
    for (; ; ) {
      const result = currentTrace.compiled(
        this.stack,
        this.sp,
        frame.basePointer,
        this.globals,
        allConsts,
        frame.closure.free,
        MonkeyInteger,
        MonkeyBoolean,
        MonkeyString,
        MonkeyArray,
        TRUE,
        FALSE,
        NULL,
        cachedInteger,
        internString,
        this.isTruthy,
        trace.sideTraces
      );
      currentTrace.executionCount++;
      if (!result) return false;
      switch (result.exit) {
        case "guard_falsy":
        case "guard_truthy":
        case "guard":
          if (result.ip !== void 0) {
            frame.ip = result.ip - 1;
          }
          if (result.snapshot) {
            if (result.snapshot.globals) {
              for (const [idx, value] of Object.entries(result.snapshot.globals)) {
                this.globals[Number(idx)] = value;
              }
            }
            if (result.snapshot.locals) {
              for (const [slot, value] of Object.entries(result.snapshot.locals)) {
                this.stack[frame.basePointer + Number(slot)] = value;
              }
            }
          }
          trace.sideExits.set(
            result.guardIdx,
            (trace.sideExits.get(result.guardIdx) || 0) + 1
          );
          if (this.jit && !this.recorder && this.jit.shouldRecordSideTrace(trace, result.guardIdx)) {
            this._startSideTraceRecording(trace, result.guardIdx, result.ip);
          }
          return true;
        case "loop_back":
          return true;
        case "invalidate":
          for (const [key, t] of this.jit.traces) {
            if (t === trace) {
              this.jit.traces.delete(key);
              break;
            }
          }
          frame.ip = trace.startIp - 1;
          return true;
        case "max_iter":
          frame.ip = trace.startIp - 1;
          return true;
        case "call":
          frame.ip = trace.startIp - 1;
          return true;
        default:
          return true;
      }
    }
  }
  // Start recording a trace at the current loop header
  _startRecording(ip) {
    this.recorder = new TraceRecorder(this);
    this.recorder.start(this._closureId(), ip);
  }
  _abortRecording() {
    if (this.recorder && this.jit) {
      this.jit.recordAbort(this.recorder.trace?.frameId ?? this._closureId(), this.recorder.startIp);
    }
    if (this.recorder) this.recorder.abort();
    this.recorder = null;
  }
  // Get or create quickening counters for a bytecode array.
  // Counters track consecutive same-type observations per instruction position.
  _getQuickenCounters(instructions) {
    if (!instructions._quickenCounters) {
      instructions._quickenCounters = {};
    }
    return instructions._quickenCounters;
  }
  // Start recording a side trace from a guard exit
  _startSideTraceRecording(parentTrace, guardIdx, exitIp) {
    this.recorder = new TraceRecorder(this);
    this.recorder.startSideTrace(parentTrace, guardIdx, exitIp, this._closureId());
  }
  // Execute a compiled function trace
  _executeFuncTrace(trace, closure, numArgs) {
    const bp = this.sp - numArgs;
    const allConsts = this._traceConsts.length > 0 ? [...this.constants, ...this._traceConsts] : this.constants;
    const args = new Array(numArgs);
    for (let i = 0; i < numArgs; i++) {
      args[i] = this.stack[bp + i];
    }
    const compiler = trace._compiler;
    const isRaw = compiler && compiler._isRaw;
    const self = (callArgs) => {
      return trace.compiled(
        callArgs,
        this.globals,
        allConsts,
        closure.free,
        MonkeyInteger,
        MonkeyBoolean,
        MonkeyString,
        TRUE,
        FALSE,
        NULL,
        cachedInteger,
        internString,
        this.isTruthy,
        self,
        selfRaw
      );
    };
    const selfRaw = isRaw ? (callArgs) => {
      const boxedArgs = callArgs.map((v) => cachedInteger(v));
      const result2 = trace.compiled(
        boxedArgs,
        this.globals,
        allConsts,
        closure.free,
        MonkeyInteger,
        MonkeyBoolean,
        MonkeyString,
        TRUE,
        FALSE,
        NULL,
        cachedInteger,
        internString,
        this.isTruthy,
        self,
        selfRaw
      );
      return result2 && result2.value !== void 0 ? result2.value : 0;
    } : void 0;
    const result = trace.compiled(
      args,
      this.globals,
      allConsts,
      closure.free,
      MonkeyInteger,
      MonkeyBoolean,
      MonkeyString,
      TRUE,
      FALSE,
      NULL,
      cachedInteger,
      internString,
      this.isTruthy,
      self,
      selfRaw
    );
    trace.executionCount++;
    if (result === null) {
      return { exit: "guard", ip: 0 };
    }
    return result;
  }
  // Execute a compiled side trace
  _executeSideTrace(sideTrace, parentTrace, allConsts) {
    const frame = this.currentFrame();
    const emptySideTraces = /* @__PURE__ */ new Map();
    const result = sideTrace.compiled(
      this.stack,
      this.sp,
      frame.basePointer,
      this.globals,
      allConsts,
      frame.closure.free,
      MonkeyInteger,
      MonkeyBoolean,
      MonkeyString,
      MonkeyArray,
      TRUE,
      FALSE,
      NULL,
      cachedInteger,
      internString,
      this.isTruthy,
      emptySideTraces
    );
    sideTrace.executionCount++;
    return result;
  }
  // Record the current opcode into the trace (called after execution)
  _record(op, ip, ins) {
    if (!this.recorder || !this.recorder.recording) return;
    if (this.recorder._skipDepth > 0) return;
    if (!this.recorder.isFuncTrace && this.recorder.instrCount > 0 && ip === this.recorder.startIp) {
      const trace = this.recorder.stop();
      if (trace && this.jit.compile(trace, this)) {
        this.jit.storeTrace(trace);
      }
      this.recorder = null;
      return;
    }
    if (++this.recorder.instrCount > 200) {
      this._abortRecording();
      return;
    }
  }
  // Record a value being pushed (maps VM push to IR ref tracking)
  _recordPush(op, value, operands) {
    if (!this.recorder || !this.recorder.recording) return;
    const r = this.recorder;
    const trace = r.trace;
    switch (op) {
      case Opcodes.OpConstant: {
        if (value instanceof MonkeyInteger) {
          const ref = trace.addInst(IR.CONST_INT, { value: value.value });
          r.typeMap.set(ref, "raw_int");
          r.pushRef(ref);
        } else if (value instanceof MonkeyBoolean) {
          const ref = trace.addInst(IR.CONST_BOOL, { value: value.value });
          r.typeMap.set(ref, "bool");
          r.pushRef(ref);
        } else if (value instanceof MonkeyString) {
          const ref = trace.addInst(IR.CONST_OBJ, { constIdx: operands[0] });
          r.typeMap.set(ref, "string");
          r.pushRef(ref);
        } else {
          const ref = trace.addInst(IR.CONST_OBJ, { constIdx: operands[0] });
          r.typeMap.set(ref, "object");
          r.pushRef(ref);
        }
        break;
      }
      case Opcodes.OpGetLocal: {
        const ref = trace.addInst(IR.LOAD_LOCAL, { slot: operands[0] });
        r.pushRef(ref);
        break;
      }
      case Opcodes.OpGetGlobal: {
        const ref = trace.addInst(IR.LOAD_GLOBAL, { index: operands[0] });
        r.pushRef(ref);
        break;
      }
      case Opcodes.OpGetFree: {
        const ref = trace.addInst(IR.LOAD_FREE, { index: operands[0] });
        r.pushRef(ref);
        break;
      }
      case Opcodes.OpTrue: {
        const ref = trace.addInst(IR.CONST_BOOL, { value: true });
        r.typeMap.set(ref, "bool");
        r.pushRef(ref);
        break;
      }
      case Opcodes.OpFalse: {
        const ref = trace.addInst(IR.CONST_BOOL, { value: false });
        r.typeMap.set(ref, "bool");
        r.pushRef(ref);
        break;
      }
      case Opcodes.OpNull: {
        const ref = trace.addInst(IR.CONST_NULL);
        r.typeMap.set(ref, "null");
        r.pushRef(ref);
        break;
      }
    }
  }
  // Record a runtime value as a constant in the trace IR
  // Used for inlined closure free variables (captured by value, won't change)
  _recordPushAsConst(value) {
    if (!this.recorder || !this.recorder.recording) return;
    const r = this.recorder;
    const trace = r.trace;
    if (value instanceof MonkeyInteger) {
      const ref = trace.addInst(IR.CONST_INT, { value: value.value });
      r.typeMap.set(ref, "raw_int");
      r.pushRef(ref);
    } else if (value instanceof MonkeyBoolean) {
      const ref = trace.addInst(IR.CONST_BOOL, { value: value.value });
      r.typeMap.set(ref, "bool");
      r.pushRef(ref);
    } else if (value instanceof MonkeyString) {
      const idx = this._ensureTraceConst(value);
      const ref = trace.addInst(IR.CONST_OBJ, { constIdx: idx });
      r.typeMap.set(ref, "string");
      r.pushRef(ref);
    } else {
      const idx = this._ensureTraceConst(value);
      const ref = trace.addInst(IR.CONST_OBJ, { constIdx: idx });
      r.typeMap.set(ref, "object");
      r.pushRef(ref);
    }
  }
};

// src/evaluator.js
var builtins = /* @__PURE__ */ new Map([
  ["len", new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    const arg = args[0];
    if (arg instanceof MonkeyString) return new MonkeyInteger(arg.value.length);
    if (arg instanceof MonkeyArray) return new MonkeyInteger(arg.elements.length);
    return newError(`argument to \`len\` not supported, got ${arg.type()}`);
  })],
  ["first", new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0].type() !== OBJ.ARRAY) return newError(`argument to \`first\` must be ARRAY, got ${args[0].type()}`);
    return args[0].elements.length > 0 ? args[0].elements[0] : NULL;
  })],
  ["last", new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0].type() !== OBJ.ARRAY) return newError(`argument to \`last\` must be ARRAY, got ${args[0].type()}`);
    const els = args[0].elements;
    return els.length > 0 ? els[els.length - 1] : NULL;
  })],
  ["rest", new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0].type() !== OBJ.ARRAY) return newError(`argument to \`rest\` must be ARRAY, got ${args[0].type()}`);
    const els = args[0].elements;
    return els.length > 0 ? new MonkeyArray(els.slice(1)) : NULL;
  })],
  ["push", new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    if (args[0].type() !== OBJ.ARRAY) return newError(`argument to \`push\` must be ARRAY, got ${args[0].type()}`);
    return new MonkeyArray([...args[0].elements, args[1]]);
  })],
  ["puts", new MonkeyBuiltin((...args) => {
    for (const arg of args) console.log(arg.inspect());
    return NULL;
  })],
  ["split", new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString))
      return newError(`arguments to \`split\` must be STRING`);
    return new MonkeyArray(args[0].value.split(args[1].value).map((s) => new MonkeyString(s)));
  })],
  ["join", new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyArray) || !(args[1] instanceof MonkeyString))
      return newError(`arguments to \`join\` must be (ARRAY, STRING)`);
    return new MonkeyString(args[0].elements.map((e) => e instanceof MonkeyString ? e.value : e.inspect()).join(args[1].value));
  })],
  ["trim", new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyString)) return newError(`argument to \`trim\` must be STRING`);
    return new MonkeyString(args[0].value.trim());
  })],
  ["str_contains", new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString))
      return newError(`arguments to \`str_contains\` must be STRING`);
    return args[0].value.includes(args[1].value) ? TRUE : FALSE;
  })],
  ["substr", new MonkeyBuiltin((...args) => {
    if (args.length < 2 || args.length > 3) return newError(`wrong number of arguments. got=${args.length}, want=2 or 3`);
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyInteger))
      return newError(`arguments to \`substr\` must be (STRING, INT[, INT])`);
    const str = args[0].value;
    const start = args[1].value;
    const end = args.length === 3 && args[2] instanceof MonkeyInteger ? args[2].value : str.length;
    return new MonkeyString(str.slice(start, end));
  })],
  ["replace", new MonkeyBuiltin((...args) => {
    if (args.length !== 3) return newError(`wrong number of arguments. got=${args.length}, want=3`);
    if (!(args[0] instanceof MonkeyString) || !(args[1] instanceof MonkeyString) || !(args[2] instanceof MonkeyString))
      return newError(`arguments to \`replace\` must be STRING`);
    return new MonkeyString(args[0].value.split(args[1].value).join(args[2].value));
  })],
  ["int", new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0] instanceof MonkeyInteger) return args[0];
    if (args[0] instanceof MonkeyString) {
      const n = parseInt(args[0].value);
      if (isNaN(n)) return NULL;
      return new MonkeyInteger(n);
    }
    return newError(`cannot convert ${args[0].type()} to INT`);
  })],
  ["str", new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (args[0] instanceof MonkeyString) return args[0];
    return new MonkeyString(args[0].inspect());
  })],
  ["type", new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    return new MonkeyString(args[0].type());
  })],
  ["ord", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.STRING) return newError("ord requires one string argument");
    return new MonkeyInteger(args[0].value.charCodeAt(0));
  })],
  ["char", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.INTEGER) return newError("char requires one integer argument");
    return new MonkeyString(String.fromCharCode(args[0].value));
  })],
  ["abs", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.INTEGER) return newError("abs requires one integer argument");
    return new MonkeyInteger(Math.abs(args[0].value));
  })],
  ["upper", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.STRING) return newError("upper requires one string argument");
    return new MonkeyString(args[0].value.toUpperCase());
  })],
  ["lower", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.STRING) return newError("lower requires one string argument");
    return new MonkeyString(args[0].value.toLowerCase());
  })],
  ["indexOf", new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    if (args[0].type() === OBJ.STRING && args[1].type() === OBJ.STRING) {
      return new MonkeyInteger(args[0].value.indexOf(args[1].value));
    }
    return newError("indexOf requires two string arguments");
  })],
  ["startsWith", new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    return nativeBoolToBooleanObject(args[0].value.startsWith(args[1].value));
  })],
  ["endsWith", new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    return nativeBoolToBooleanObject(args[0].value.endsWith(args[1].value));
  })],
  ["keys", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.HASH) return newError("keys requires one hash argument");
    const arr = [];
    for (const [, { key }] of args[0].pairs) arr.push(key);
    return new MonkeyArray(arr);
  })],
  ["values", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || args[0].type() !== OBJ.HASH) return newError("values requires one hash argument");
    const arr = [];
    for (const [, { value }] of args[0].pairs) arr.push(value);
    return new MonkeyArray(arr);
  })],
  ["sort", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray)) return newError("sort requires one array argument");
    const sorted = [...args[0].elements].sort((a, b) => {
      if (a instanceof MonkeyInteger && b instanceof MonkeyInteger) return a.value - b.value;
      return a.inspect().localeCompare(b.inspect());
    });
    return new MonkeyArray(sorted);
  })],
  ["reverse", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray)) return newError("reverse requires one array argument");
    return new MonkeyArray([...args[0].elements].reverse());
  })],
  ["contains", new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError("contains requires two arguments");
    if (args[0] instanceof MonkeyArray) {
      return nativeBoolToBooleanObject(args[0].elements.some((el) => el.inspect() === args[1].inspect()));
    }
    if (args[0] instanceof MonkeyString && args[1] instanceof MonkeyString) {
      return nativeBoolToBooleanObject(args[0].value.includes(args[1].value));
    }
    return newError("contains not supported for " + args[0].type());
  })],
  ["sum", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray)) return newError("sum requires one array argument");
    let total = 0;
    for (const el of args[0].elements) {
      if (el instanceof MonkeyInteger) total += el.value;
    }
    return new MonkeyInteger(total);
  })],
  ["max", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray)) return newError("max requires one array argument");
    let m = -Infinity;
    for (const el of args[0].elements) {
      if (el instanceof MonkeyInteger && el.value > m) m = el.value;
    }
    return m === -Infinity ? NULL : new MonkeyInteger(m);
  })],
  ["min", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray)) return newError("min requires one array argument");
    let m = Infinity;
    for (const el of args[0].elements) {
      if (el instanceof MonkeyInteger && el.value < m) m = el.value;
    }
    return m === Infinity ? NULL : new MonkeyInteger(m);
  })],
  ["range", new MonkeyBuiltin((...args) => {
    let start = 0, end, step = 1;
    if (args.length === 1) {
      end = args[0].value;
    } else if (args.length === 2) {
      start = args[0].value;
      end = args[1].value;
    } else if (args.length === 3) {
      start = args[0].value;
      end = args[1].value;
      step = args[2].value;
    } else return newError("range requires 1-3 arguments");
    const result = [];
    if (step > 0) for (let i = start; i < end; i += step) result.push(new MonkeyInteger(i));
    else if (step < 0) for (let i = start; i > end; i += step) result.push(new MonkeyInteger(i));
    return new MonkeyArray(result);
  })],
  ["flat", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray)) return newError("flat requires one array argument");
    const result = [];
    for (const el of args[0].elements) {
      if (el instanceof MonkeyArray) result.push(...el.elements);
      else result.push(el);
    }
    return new MonkeyArray(result);
  })],
  ["zip", new MonkeyBuiltin((...args) => {
    if (args.length !== 2 || !(args[0] instanceof MonkeyArray) || !(args[1] instanceof MonkeyArray))
      return newError("zip requires two array arguments");
    const len = Math.min(args[0].elements.length, args[1].elements.length);
    const result = [];
    for (let i = 0; i < len; i++) result.push(new MonkeyArray([args[0].elements[i], args[1].elements[i]]));
    return new MonkeyArray(result);
  })],
  ["enumerate", new MonkeyBuiltin((...args) => {
    if (args.length !== 1 || !(args[0] instanceof MonkeyArray)) return newError("enumerate requires one array argument");
    const result = [];
    for (let i = 0; i < args[0].elements.length; i++) result.push(new MonkeyArray([new MonkeyInteger(i), args[0].elements[i]]));
    return new MonkeyArray(result);
  })],
  ["Ok", new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    return new MonkeyResult(true, args[0]);
  })],
  ["Err", new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    return new MonkeyResult(false, args[0]);
  })],
  ["is_ok", new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyResult)) return FALSE;
    return args[0].isOk ? TRUE : FALSE;
  })],
  ["is_err", new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyResult)) return FALSE;
    return args[0].isOk ? FALSE : TRUE;
  })],
  ["unwrap", new MonkeyBuiltin((...args) => {
    if (args.length !== 1) return newError(`wrong number of arguments. got=${args.length}, want=1`);
    if (!(args[0] instanceof MonkeyResult)) return newError("unwrap requires a Result");
    if (!args[0].isOk) return newError("unwrap called on Err: " + args[0].value.inspect());
    return args[0].value;
  })],
  ["unwrap_or", new MonkeyBuiltin((...args) => {
    if (args.length !== 2) return newError(`wrong number of arguments. got=${args.length}, want=2`);
    if (!(args[0] instanceof MonkeyResult)) return args[0];
    return args[0].isOk ? args[0].value : args[1];
  })]
]);
function newError(msg) {
  return new MonkeyError(msg);
}
function isError(obj) {
  return obj && obj.type() === OBJ.ERROR;
}
function nativeBoolToBooleanObject(val) {
  return val ? TRUE : FALSE;
}
function isTruthy(obj) {
  if (obj === NULL || obj === FALSE) return false;
  if (obj === TRUE) return true;
  return true;
}
function monkeyEval(node, env) {
  if (node instanceof Program) return evalProgram(node.statements, env);
  if (node instanceof ExpressionStatement) return monkeyEval(node.expression, env);
  if (node instanceof BlockStatement) return evalBlockStatement(node.statements, env);
  if (node instanceof LetStatement) {
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
    env.set(node.name.value, val, node.isConst);
    return void 0;
  }
  if (node instanceof DestructuringLet) {
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
    if (val instanceof MonkeyArray) {
      for (let i = 0; i < node.names.length; i++) {
        if (node.names[i]) {
          env.set(node.names[i].value, i < val.elements.length ? val.elements[i] : NULL);
        }
      }
    }
    return void 0;
  }
  if (node instanceof HashDestructuringLet) {
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
    if (val instanceof MonkeyHash) {
      for (const name of node.names) {
        const key = internString(name.value);
        const hashKey = key.fastHashKey();
        const pair = val.pairs.get(hashKey);
        env.set(name.value, pair ? pair.value : NULL);
      }
    }
    return void 0;
  }
  if (node instanceof ReturnStatement) {
    const val = monkeyEval(node.returnValue, env);
    if (isError(val)) return val;
    return new MonkeyReturnValue(val);
  }
  if (node instanceof ImportStatement) {
    const mod = getModule(node.moduleName);
    if (!mod) return newError(`unknown module: ${node.moduleName}`);
    if (node.bindings) {
      for (const name of node.bindings) {
        const key = new MonkeyString(name);
        const hk = key.fastHashKey ? key.fastHashKey() : key.hashKey();
        const pair = mod.pairs.get(hk);
        if (pair) {
          env.set(name, pair.value);
        } else {
          env.set(name, NULL);
        }
      }
      return mod;
    }
    env.set(node.alias || node.moduleName, mod);
    return mod;
  }
  if (node instanceof EnumStatement) {
    const pairs = /* @__PURE__ */ new Map();
    for (let i = 0; i < node.variants.length; i++) {
      const key = new MonkeyString(node.variants[i]);
      const value = new MonkeyEnum(node.name, node.variants[i], i);
      pairs.set(key.fastHashKey ? key.fastHashKey() : key.hashKey(), { key, value });
    }
    const enumHash = new MonkeyHash(pairs);
    env.set(node.name, enumHash);
    return enumHash;
  }
  if (node instanceof IntegerLiteral) return new MonkeyInteger(node.value);
  if (node instanceof FloatLiteral) return new MonkeyFloat(node.value);
  if (node instanceof StringLiteral) return internString(node.value);
  if (node instanceof BooleanLiteral) return nativeBoolToBooleanObject(node.value);
  if (node instanceof PrefixExpression) {
    const right = monkeyEval(node.right, env);
    if (isError(right)) return right;
    return evalPrefixExpression(node.operator, right);
  }
  if (node instanceof RangeExpression) {
    const start = monkeyEval(node.start, env);
    if (isError(start)) return start;
    const end = monkeyEval(node.end, env);
    if (isError(end)) return end;
    if (!(start instanceof MonkeyInteger) || !(end instanceof MonkeyInteger)) {
      return new MonkeyError("range requires integer bounds");
    }
    const elements = [];
    for (let i = start.value; i < end.value; i++) {
      elements.push(new MonkeyInteger(i));
    }
    return new MonkeyArray(elements);
  }
  if (node instanceof InfixExpression) {
    if (node.operator === "&&") {
      const left2 = monkeyEval(node.left, env);
      if (isError(left2)) return left2;
      if (!isTruthy(left2)) return left2;
      return monkeyEval(node.right, env);
    }
    if (node.operator === "||") {
      const left2 = monkeyEval(node.left, env);
      if (isError(left2)) return left2;
      if (isTruthy(left2)) return left2;
      return monkeyEval(node.right, env);
    }
    if (node.operator === "??") {
      const left2 = monkeyEval(node.left, env);
      if (isError(left2)) return left2;
      if (left2 !== NULL && left2 !== void 0) return left2;
      return monkeyEval(node.right, env);
    }
    const left = monkeyEval(node.left, env);
    if (isError(left)) return left;
    const right = monkeyEval(node.right, env);
    if (isError(right)) return right;
    return evalInfixExpression(node.operator, left, right);
  }
  if (node instanceof IfExpression) return evalIfExpression(node, env);
  if (node instanceof WhileExpression) return evalWhileExpression(node, env);
  if (node instanceof DoWhileExpression) {
    do {
      const result = monkeyEval(node.body, env);
      if (isError(result)) return result;
      if (result instanceof MonkeyReturnValue) return result;
      if (result instanceof MonkeyBreak) break;
      if (result instanceof MonkeyContinue) continue;
      const cond = monkeyEval(node.condition, env);
      if (isError(cond)) return cond;
      if (!isTruthy(cond)) break;
    } while (true);
    return NULL;
  }
  if (node instanceof ForExpression) return evalForExpression(node, env);
  if (node instanceof ForInExpression) return evalForInExpression(node, env);
  if (node instanceof BreakStatement) return new MonkeyBreak();
  if (node instanceof ContinueStatement) return new MonkeyContinue();
  if (node instanceof NullLiteral) return NULL;
  if (node instanceof TernaryExpression) {
    const condition = monkeyEval(node.condition, env);
    if (isError(condition)) return condition;
    return isTruthy(condition) ? monkeyEval(node.consequence, env) : monkeyEval(node.alternative, env);
  }
  if (node instanceof MatchExpression) {
    const subject = monkeyEval(node.subject, env);
    if (isError(subject)) return subject;
    for (const arm of node.arms) {
      if (arm.pattern === null) {
        if (arm.guard) {
          const guardVal = monkeyEval(arm.guard, env);
          if (!isTruthy(guardVal)) continue;
        }
        return monkeyEval(arm.value, env);
      }
      if (arm.pattern instanceof TypePattern) {
        const typeName = arm.pattern.typeName;
        let matches = false;
        switch (typeName) {
          case "int":
            matches = subject instanceof MonkeyInteger;
            break;
          case "string":
            matches = subject instanceof MonkeyString;
            break;
          case "bool":
            matches = subject instanceof MonkeyBoolean;
            break;
          case "array":
            matches = subject instanceof MonkeyArray;
            break;
          case "hash":
            matches = subject instanceof MonkeyHash;
            break;
          case "fn":
            matches = subject instanceof MonkeyFunction2;
            break;
          case "null":
            matches = subject === NULL;
            break;
          case "Ok":
            matches = subject instanceof MonkeyResult && subject.isOk;
            break;
          case "Err":
            matches = subject instanceof MonkeyResult && !subject.isOk;
            break;
        }
        if (matches) {
          const innerEnv = new Environment(env);
          const bindValue = typeName === "Ok" || typeName === "Err" ? subject.value : subject;
          innerEnv.set(arm.pattern.binding.value, bindValue);
          if (arm.guard) {
            const guardVal = monkeyEval(arm.guard, innerEnv);
            if (!isTruthy(guardVal)) continue;
          }
          return monkeyEval(arm.value, innerEnv);
        }
        continue;
      }
      if (arm.pattern instanceof OrPattern) {
        let matched = false;
        for (const p of arm.pattern.patterns) {
          const pVal = monkeyEval(p, env);
          if (isError(pVal)) return pVal;
          if (subject.inspect() === pVal.inspect()) {
            matched = true;
            break;
          }
        }
        if (matched) {
          if (arm.guard) {
            const guardVal = monkeyEval(arm.guard, env);
            if (!isTruthy(guardVal)) continue;
          }
          return monkeyEval(arm.value, env);
        }
        continue;
      }
      if (arm.guard && arm.pattern instanceof Identifier) {
        const innerEnv = new Environment(env);
        innerEnv.set(arm.pattern.value, subject);
        const guardVal = monkeyEval(arm.guard, innerEnv);
        if (isTruthy(guardVal)) {
          return monkeyEval(arm.value, innerEnv);
        }
        continue;
      }
      const pattern = monkeyEval(arm.pattern, env);
      if (isError(pattern)) return pattern;
      if (subject.inspect() === pattern.inspect()) {
        if (arm.guard) {
          const guardVal = monkeyEval(arm.guard, env);
          if (!isTruthy(guardVal)) continue;
        }
        return monkeyEval(arm.value, env);
      }
    }
    return NULL;
  }
  if (node instanceof TemplateLiteral) return evalTemplateLiteral(node, env);
  if (node instanceof AssignExpression) {
    if (env.isConst(node.name.value)) return new MonkeyError(`cannot assign to const variable: ${node.name.value}`);
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
    env.set(node.name.value, val);
    return val;
  }
  if (node instanceof Identifier) return evalIdentifier(node, env);
  if (node instanceof FunctionLiteral) {
    const fn = new MonkeyFunction2(node.parameters, node.body, env);
    fn.defaults = node.defaults || [];
    return fn;
  }
  if (node instanceof CallExpression) {
    const fn = monkeyEval(node.function, env);
    if (isError(fn)) return fn;
    const args = evalExpressions(node.arguments, env);
    if (args.length === 1 && isError(args[0])) return args[0];
    return applyFunction(fn, args);
  }
  if (node instanceof ArrayLiteral) {
    const result = [];
    for (const el of node.elements) {
      if (el instanceof SpreadElement) {
        const arr = monkeyEval(el.expression, env);
        if (isError(arr)) return arr;
        if (arr instanceof MonkeyArray) {
          result.push(...arr.elements);
        } else {
          return newError(`spread requires array, got ${arr.type()}`);
        }
      } else {
        const val = monkeyEval(el, env);
        if (isError(val)) return val;
        result.push(val);
      }
    }
    return new MonkeyArray(result);
  }
  if (node instanceof ArrayComprehension) {
    const iterable = monkeyEval(node.iterable, env);
    if (isError(iterable)) return iterable;
    if (!(iterable instanceof MonkeyArray)) {
      return newError(`comprehension requires array, got ${iterable.type()}`);
    }
    const result = [];
    for (const elem of iterable.elements) {
      const innerEnv = new Environment(env);
      innerEnv.set(node.variable, elem);
      if (node.condition) {
        const cond = monkeyEval(node.condition, innerEnv);
        if (isError(cond)) return cond;
        if (!isTruthy(cond)) continue;
      }
      const val = monkeyEval(node.body, innerEnv);
      if (isError(val)) return val;
      result.push(val);
    }
    return new MonkeyArray(result);
  }
  if (node instanceof IndexAssignExpression) {
    const obj = monkeyEval(node.left, env);
    if (isError(obj)) return obj;
    const index = monkeyEval(node.index, env);
    if (isError(index)) return index;
    const val = monkeyEval(node.value, env);
    if (isError(val)) return val;
    if (obj instanceof MonkeyArray && index instanceof MonkeyInteger) {
      let i = index.value;
      if (i < 0) i += obj.elements.length;
      if (i >= 0 && i < obj.elements.length) {
        obj.elements[i] = val;
      }
    } else if (obj instanceof MonkeyHash) {
      if (index.fastHashKey) {
        obj.pairs.set(index.fastHashKey(), { key: index, value: val });
      }
    }
    return val;
  }
  if (node instanceof SliceExpression) {
    const obj = monkeyEval(node.left, env);
    if (isError(obj)) return obj;
    const start = node.start ? monkeyEval(node.start, env) : null;
    if (start && isError(start)) return start;
    const end = node.end ? monkeyEval(node.end, env) : null;
    if (end && isError(end)) return end;
    if (obj instanceof MonkeyArray) {
      const len = obj.elements.length;
      let s = start ? start.value : 0;
      let e = end ? end.value : len;
      if (s < 0) s += len;
      if (e < 0) e += len;
      return new MonkeyArray(obj.elements.slice(s, e));
    }
    if (obj instanceof MonkeyString) {
      const len = obj.value.length;
      let s = start ? start.value : 0;
      let e = end ? end.value : len;
      if (s < 0) s += len;
      if (e < 0) e += len;
      return new MonkeyString(obj.value.slice(s, e));
    }
    return NULL;
  }
  if (node instanceof IndexExpression) {
    const left = monkeyEval(node.left, env);
    if (isError(left)) return left;
    const index = monkeyEval(node.index, env);
    if (isError(index)) return index;
    return evalIndexExpression(left, index);
  }
  if (node instanceof OptionalChainExpression) {
    const left = monkeyEval(node.left, env);
    if (isError(left)) return left;
    if (left === NULL || left === void 0) return NULL;
    const index = monkeyEval(node.index, env);
    if (isError(index)) return index;
    return evalIndexExpression(left, index);
  }
  if (node instanceof HashLiteral) {
    return evalHashLiteral(node, env);
  }
  return NULL;
}
function evalProgram(stmts, env) {
  let result;
  for (const stmt of stmts) {
    result = monkeyEval(stmt, env);
    if (result instanceof MonkeyReturnValue) return result.value;
    if (result instanceof MonkeyError) return result;
  }
  return result;
}
function evalBlockStatement(stmts, env) {
  let result;
  for (const stmt of stmts) {
    result = monkeyEval(stmt, env);
    if (result) {
      const rt = result.type();
      if (rt === OBJ.RETURN || rt === OBJ.ERROR) return result;
      if (result instanceof MonkeyBreak || result instanceof MonkeyContinue) return result;
    }
  }
  return result;
}
function evalPrefixExpression(op, right) {
  switch (op) {
    case "!":
      return evalBangOperator(right);
    case "-":
      return evalMinusPrefix(right);
    default:
      return newError(`unknown operator: ${op}${right.type()}`);
  }
}
function evalBangOperator(right) {
  if (right === TRUE) return FALSE;
  if (right === FALSE) return TRUE;
  if (right === NULL) return TRUE;
  return FALSE;
}
function evalMinusPrefix(right) {
  if (right.type() === OBJ.FLOAT) return new MonkeyFloat(-right.value);
  if (right.type() !== OBJ.INTEGER) return newError(`unknown operator: -${right.type()}`);
  return new MonkeyInteger(-right.value);
}
function evalInfixExpression(op, left, right) {
  if ((left.type() === OBJ.INTEGER || left.type() === OBJ.FLOAT) && (right.type() === OBJ.INTEGER || right.type() === OBJ.FLOAT)) {
    return evalNumericInfix(op, left, right);
  }
  if (op === "*") {
    if (left.type() === OBJ.STRING && right.type() === OBJ.INTEGER) {
      const n = right.value;
      return new MonkeyString(n > 0 ? left.value.repeat(n) : "");
    }
    if (left.type() === OBJ.INTEGER && right.type() === OBJ.STRING) {
      const n = left.value;
      return new MonkeyString(n > 0 ? right.value.repeat(n) : "");
    }
  }
  if (left.type() === OBJ.STRING && right.type() === OBJ.STRING) {
    if (op === "+") return new MonkeyString(left.value + right.value);
    if (op === "==") return nativeBoolToBooleanObject(left.value === right.value);
    if (op === "!=") return nativeBoolToBooleanObject(left.value !== right.value);
    if (op === "<") return nativeBoolToBooleanObject(left.value < right.value);
    if (op === ">") return nativeBoolToBooleanObject(left.value > right.value);
    if (op === "<=") return nativeBoolToBooleanObject(left.value <= right.value);
    if (op === ">=") return nativeBoolToBooleanObject(left.value >= right.value);
    return newError(`unknown operator: ${left.type()} ${op} ${right.type()}`);
  }
  if (left.type() === OBJ.ARRAY && right.type() === OBJ.ARRAY && op === "+") {
    return new MonkeyArray([...left.elements, ...right.elements]);
  }
  if (left.type() === "ENUM" && right.type() === "ENUM") {
    const eq = left.enumName === right.enumName && left.variant === right.variant;
    if (op === "==") return nativeBoolToBooleanObject(eq);
    if (op === "!=") return nativeBoolToBooleanObject(!eq);
  }
  if (op === "==") return nativeBoolToBooleanObject(left === right);
  if (op === "!=") return nativeBoolToBooleanObject(left !== right);
  if (left.type() !== right.type()) {
    return newError(`type mismatch: ${left.type()} ${op} ${right.type()}`);
  }
  return newError(`unknown operator: ${left.type()} ${op} ${right.type()}`);
}
function evalNumericInfix(op, left, right) {
  const l = left.value, r = right.value;
  const isFloat = left.type() === OBJ.FLOAT || right.type() === OBJ.FLOAT;
  const mkNum = (v) => isFloat ? new MonkeyFloat(v) : new MonkeyInteger(v);
  switch (op) {
    case "+":
      return mkNum(l + r);
    case "-":
      return mkNum(l - r);
    case "*":
      return mkNum(l * r);
    case "/":
      return isFloat ? new MonkeyFloat(l / r) : new MonkeyInteger(Math.trunc(l / r));
    case "%":
      return mkNum(l % r);
    case "<":
      return nativeBoolToBooleanObject(l < r);
    case ">":
      return nativeBoolToBooleanObject(l > r);
    case "<=":
      return nativeBoolToBooleanObject(l <= r);
    case ">=":
      return nativeBoolToBooleanObject(l >= r);
    case "==":
      return nativeBoolToBooleanObject(l === r);
    case "!=":
      return nativeBoolToBooleanObject(l !== r);
    default:
      return newError(`unknown operator: ${left.type()} ${op} ${right.type()}`);
  }
}
function evalIfExpression(node, env) {
  const condition = monkeyEval(node.condition, env);
  if (isError(condition)) return condition;
  if (isTruthy(condition)) return monkeyEval(node.consequence, env);
  if (node.alternative) return monkeyEval(node.alternative, env);
  return NULL;
}
function evalWhileExpression(node, env) {
  while (true) {
    const condition = monkeyEval(node.condition, env);
    if (isError(condition)) return condition;
    if (!isTruthy(condition)) break;
    const result = monkeyEval(node.body, env);
    if (isError(result)) return result;
    if (result instanceof MonkeyReturnValue) return result;
    if (result instanceof MonkeyBreak) break;
    if (result instanceof MonkeyContinue) continue;
  }
  return NULL;
}
function evalForExpression(node, env) {
  const initResult = monkeyEval(node.init, env);
  if (isError(initResult)) return initResult;
  while (true) {
    const condition = monkeyEval(node.condition, env);
    if (isError(condition)) return condition;
    if (!isTruthy(condition)) break;
    const bodyResult = monkeyEval(node.body, env);
    if (isError(bodyResult)) return bodyResult;
    if (bodyResult instanceof MonkeyReturnValue) return bodyResult;
    if (bodyResult instanceof MonkeyBreak) break;
    if (bodyResult instanceof MonkeyContinue) {
    }
    const updateResult = monkeyEval(node.update, env);
    if (isError(updateResult)) return updateResult;
  }
  return NULL;
}
function evalForInExpression(node, env) {
  const iterable = monkeyEval(node.iterable, env);
  if (isError(iterable)) return iterable;
  let elements;
  if (iterable instanceof MonkeyArray) {
    elements = iterable.elements;
  } else if (iterable instanceof MonkeyString) {
    elements = iterable.value.split("").map((c) => new MonkeyString(c));
  } else {
    return new MonkeyError(`for-in: expected ARRAY or STRING, got ${iterable.type()}`);
  }
  for (const elem of elements) {
    env.set(node.variable, elem);
    const bodyResult = monkeyEval(node.body, env);
    if (isError(bodyResult)) return bodyResult;
    if (bodyResult instanceof MonkeyReturnValue) return bodyResult;
    if (bodyResult instanceof MonkeyBreak) break;
    if (bodyResult instanceof MonkeyContinue) continue;
  }
  return NULL;
}
function evalTemplateLiteral(node, env) {
  let result = "";
  for (const part of node.parts) {
    const val = monkeyEval(part, env);
    if (isError(val)) return val;
    result += val.inspect();
  }
  return new MonkeyString(result);
}
function evalIdentifier(node, env) {
  const val = env.get(node.value);
  if (val !== void 0) return val;
  const builtin = builtins.get(node.value);
  if (builtin) return builtin;
  return newError(`identifier not found: ${node.value}`);
}
function evalExpressions(exps, env) {
  const result = [];
  for (const exp of exps) {
    const val = monkeyEval(exp, env);
    if (isError(val)) return [val];
    result.push(val);
  }
  return result;
}
function applyFunction(fn, args) {
  if (fn instanceof MonkeyFunction2) {
    const extendedEnv = new Environment(fn.env);
    for (let i = 0; i < fn.parameters.length; i++) {
      if (i < args.length) {
        extendedEnv.set(fn.parameters[i].value, args[i]);
      } else if (fn.defaults && fn.defaults[i]) {
        const defaultVal = monkeyEval(fn.defaults[i], extendedEnv);
        extendedEnv.set(fn.parameters[i].value, defaultVal);
      } else {
        extendedEnv.set(fn.parameters[i].value, NULL);
      }
    }
    const result = monkeyEval(fn.body, extendedEnv);
    if (result instanceof MonkeyReturnValue) return result.value;
    return result;
  }
  if (fn instanceof MonkeyBuiltin) return fn.fn(...args);
  return newError(`not a function: ${fn.type()}`);
}
function evalIndexExpression(left, index) {
  if (left.type() === OBJ.ARRAY && index.type() === OBJ.INTEGER) {
    let idx = index.value;
    if (idx < 0) idx += left.elements.length;
    const max = left.elements.length - 1;
    if (idx < 0 || idx > max) return NULL;
    return left.elements[idx];
  }
  if (left.type() === OBJ.HASH) {
    if (typeof index.fastHashKey !== "function") {
      return newError(`unusable as hash key: ${index.type()}`);
    }
    const pair = left.pairs.get(index.fastHashKey());
    if (!pair) return NULL;
    return pair.value;
  }
  if (left.type() === OBJ.STRING && index instanceof MonkeyInteger) {
    let idx = index.value;
    if (idx < 0) idx += left.value.length;
    if (idx < 0 || idx >= left.value.length) return NULL;
    return new MonkeyString(left.value[idx]);
  }
  if (left.type() === OBJ.STRING && index instanceof MonkeyString) {
    switch (index.value) {
      case "length":
        return new MonkeyInteger(left.value.length);
      default:
        return NULL;
    }
  }
  if (left.type() === OBJ.ARRAY && index instanceof MonkeyString) {
    switch (index.value) {
      case "length":
        return new MonkeyInteger(left.elements.length);
      default:
        return NULL;
    }
  }
  return newError(`index operator not supported: ${left.type()}`);
}
function evalHashLiteral(node, env) {
  const pairs = /* @__PURE__ */ new Map();
  for (const [keyNode, valueNode] of node.pairs) {
    const key = monkeyEval(keyNode, env);
    if (isError(key)) return key;
    if (typeof key.fastHashKey !== "function") {
      return newError(`unusable as hash key: ${key.type()}`);
    }
    const value = monkeyEval(valueNode, env);
    if (isError(value)) return value;
    pairs.set(key.fastHashKey(), { key, value });
  }
  return new MonkeyHash(pairs);
}

// src/stdlib.js
var STDLIB_SOURCE = `
let map = fn(arr, f) {
  let result = [];
  for (x in arr) { result = push(result, f(x)); }
  result
};

let filter = fn(arr, f) {
  let result = [];
  for (x in arr) { if (f(x)) { result = push(result, x); } }
  result
};

let reduce = fn(arr, initial, f) {
  let acc = initial;
  for (x in arr) { acc = f(acc, x); }
  acc
};

let forEach = fn(arr, f) {
  for (x in arr) { f(x); }
};

let range = fn(a, b = null) {
  let result = [];
  if (b == null) {
    for (let i = 0; i < a; i += 1) { result = push(result, i); }
  } else {
    for (let i = a; i < b; i += 1) { result = push(result, i); }
  }
  result
};

let contains = fn(arr, val) {
  for (x in arr) { if (x == val) { return true; } }
  false
};

let reverse = fn(arr) {
  let result = [];
  for (let i = len(arr) - 1; i > 0 - 1; i -= 1) {
    result = push(result, arr[i]);
  }
  result
};

let sum = fn(arr) {
  let total = 0;
  for (x in arr) { total += x; }
  total
};

let max = fn(arr) {
  let m = arr[0];
  for (let i = 1; i < len(arr); i += 1) {
    if (arr[i] > m) { m = arr[i]; }
  }
  m
};

let min = fn(arr) {
  let m = arr[0];
  for (let i = 1; i < len(arr); i += 1) {
    if (arr[i] < m) { m = arr[i]; }
  }
  m
};

let zip = fn(a, b) {
  let result = [];
  let n = len(a);
  if (len(b) < n) { n = len(b); }
  for (let i = 0; i < n; i += 1) {
    result = push(result, [a[i], b[i]]);
  }
  result
};

let enumerate = fn(arr) {
  let result = [];
  for (let i = 0; i < len(arr); i += 1) {
    result = push(result, [i, arr[i]]);
  }
  result
};

let flat = fn(arr) {
  let result = [];
  for (x in arr) {
    if (type(x) == "ARRAY") {
      for (y in x) { result = push(result, y); }
    } else {
      result = push(result, x);
    }
  }
  result
};

let sort = fn(arr) {
  let n = len(arr);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n - i - 1; j += 1) {
      if (arr[j] > arr[j + 1]) {
        let temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
      }
    }
  }
  arr
};

let compose = fn(f, g) { fn(x) { f(g(x)) } };
let pipe2 = fn(f, g) { fn(x) { g(f(x)) } };
let partial = fn(f, a) { fn(b) { f(a, b) } };
let memoize = fn(f) {
  let cache = {};
  fn(x) {
    let key = str(x);
    if (cache[key] == null) {
      cache[key] = f(x);
    }
    cache[key]
  }
};
let flip = fn(f) { fn(a, b) { f(b, a) } };
let always = fn(x) { fn() { x } };
let apply = fn(f, args) { f(args[0], args[1]) };
`;
function withStdlib(code) {
  return STDLIB_SOURCE + "\n" + code;
}

// src/transpiler.js
var Transpiler = class {
  constructor() {
    this.indent = 0;
  }
  transpile(program) {
    return program.statements.map((s) => this.transpileNode(s)).join("\n");
  }
  i() {
    return "  ".repeat(this.indent);
  }
  transpileNode(node) {
    if (node instanceof Program) {
      return node.statements.map((s) => this.transpileNode(s)).join("\n");
    }
    if (node instanceof LetStatement) {
      return `${this.i()}let ${node.name.value} = ${this.transpileNode(node.value)};`;
    }
    if (node instanceof ReturnStatement) {
      return `${this.i()}return ${this.transpileNode(node.returnValue)};`;
    }
    if (node instanceof ImportStatement) {
      if (node.bindings) {
        return `${this.i()}const { ${node.bindings.join(", ")} } = __monkey_modules.${node.moduleName};`;
      }
      const name = node.alias || node.moduleName;
      return `${this.i()}const ${name} = __monkey_modules.${node.moduleName};`;
    }
    if (node instanceof EnumStatement) {
      const entries = node.variants.map((v, i) => `${v}: "${node.name}.${v}"`).join(", ");
      return `${this.i()}const ${node.name} = Object.freeze({ ${entries} });`;
    }
    if (node instanceof ArrayComprehension) {
      const cond = node.condition ? `.filter(${node.variable} => ${this.transpileNode(node.condition)})` : "";
      return `[...${this.transpileNode(node.iterable)}${cond}].map(${node.variable} => ${this.transpileNode(node.body)})`;
    }
    if (node instanceof ExpressionStatement) {
      return `${this.i()}${this.transpileNode(node.expression)};`;
    }
    if (node instanceof BlockStatement) {
      this.indent++;
      const body = node.statements.map((s) => this.transpileNode(s)).join("\n");
      this.indent--;
      return body;
    }
    if (node instanceof IntegerLiteral) {
      return String(node.value);
    }
    if (node instanceof BooleanLiteral) {
      return String(node.value);
    }
    if (node instanceof StringLiteral) {
      return JSON.stringify(node.value);
    }
    if (node instanceof NullLiteral) {
      return "null";
    }
    if (node instanceof Identifier) {
      return node.value;
    }
    if (node instanceof PrefixExpression) {
      return `(${node.operator}${this.transpileNode(node.right)})`;
    }
    if (node instanceof InfixExpression) {
      return `(${this.transpileNode(node.left)} ${node.operator} ${this.transpileNode(node.right)})`;
    }
    if (node instanceof IfExpression) {
      let result = `(${this.transpileNode(node.condition)}) {
`;
      result += this.transpileNode(node.consequence);
      result += `
${this.i()}}`;
      if (node.alternative) {
        result += ` else {
${this.transpileNode(node.alternative)}
${this.i()}}`;
      }
      return `${this.i()}if ${result}`;
    }
    if (node instanceof FunctionLiteral) {
      const params = node.parameters.map((p, i) => {
        if (node.defaults && node.defaults[i]) {
          return `${p.value} = ${this.transpileNode(node.defaults[i])}`;
        }
        return p.value;
      }).join(", ");
      this.indent++;
      const body = node.body.statements.map((s) => this.transpileNode(s)).join("\n");
      this.indent--;
      return `function(${params}) {
${body}
${this.i()}}`;
    }
    if (node instanceof CallExpression) {
      const fn = this.transpileNode(node.function);
      const args = node.arguments.map((a) => this.transpileNode(a)).join(", ");
      const builtinMap = {
        "puts": "console.log",
        "len": "((x) => x.length)",
        "push": "((a, v) => [...a, v])",
        "str": "String",
        "int": "parseInt"
      };
      if (node.function instanceof Identifier && builtinMap[node.function.value]) {
        return `${builtinMap[node.function.value]}(${args})`;
      }
      return `${fn}(${args})`;
    }
    if (node instanceof ArrayLiteral) {
      return `[${node.elements.map((e) => this.transpileNode(e)).join(", ")}]`;
    }
    if (node instanceof IndexExpression) {
      return `${this.transpileNode(node.left)}[${this.transpileNode(node.index)}]`;
    }
    if (node instanceof HashLiteral) {
      const pairs = [];
      for (const [key, value] of node.pairs) {
        pairs.push(`${this.transpileNode(key)}: ${this.transpileNode(value)}`);
      }
      return `{${pairs.join(", ")}}`;
    }
    if (node instanceof AssignExpression) {
      return `${this.transpileNode(node.name)} = ${this.transpileNode(node.value)}`;
    }
    if (node instanceof IndexAssignExpression) {
      return `${this.transpileNode(node.left)}[${this.transpileNode(node.index)}] = ${this.transpileNode(node.value)}`;
    }
    if (node instanceof WhileExpression) {
      return `${this.i()}while (${this.transpileNode(node.condition)}) {
${this.transpileNode(node.body)}
${this.i()}}`;
    }
    if (node instanceof ForExpression) {
      const init = this.transpileNode(node.init).replace(/;$/, "");
      return `${this.i()}for (${init}; ${this.transpileNode(node.condition)}; ${this.transpileNode(node.update)}) {
${this.transpileNode(node.body)}
${this.i()}}`;
    }
    if (node instanceof ForInExpression) {
      return `${this.i()}for (const ${node.variable} of ${this.transpileNode(node.iterable)}) {
${this.transpileNode(node.body)}
${this.i()}}`;
    }
    if (node instanceof BreakStatement) {
      return `${this.i()}break`;
    }
    if (node instanceof ContinueStatement) {
      return `${this.i()}continue`;
    }
    if (node instanceof TernaryExpression) {
      return `(${this.transpileNode(node.condition)} ? ${this.transpileNode(node.consequence)} : ${this.transpileNode(node.alternative)})`;
    }
    if (node instanceof TemplateLiteral) {
      const parts = node.parts.map((p) => {
        if (p instanceof StringLiteral) return p.value;
        return `\${${this.transpileNode(p)}}`;
      });
      return "`" + parts.join("") + "`";
    }
    if (node instanceof SliceExpression) {
      const start = node.start ? this.transpileNode(node.start) : "0";
      const end = node.end ? this.transpileNode(node.end) : "";
      return `${this.transpileNode(node.left)}.slice(${start}${end ? ", " + end : ""})`;
    }
    if (node instanceof DestructuringLet) {
      const names = node.names.map((n) => n ? n.value : "_").join(", ");
      return `${this.i()}let [${names}] = ${this.transpileNode(node.value)};`;
    }
    if (node instanceof HashDestructuringLet) {
      const names = node.names.map((n) => n.value).join(", ");
      return `${this.i()}let {${names}} = ${this.transpileNode(node.value)};`;
    }
    if (node instanceof RangeExpression) {
      const start = this.transpileNode(node.start);
      const end = this.transpileNode(node.end);
      return `Array.from({length: ${end} - ${start}}, (_, i) => i + ${start})`;
    }
    if (node instanceof MatchExpression) {
      const subject = this.transpileNode(node.subject);
      const arms = node.arms.map((arm) => {
        if (arm.pattern === null) {
          const hasTypePatterns = node.arms.some((a) => a.pattern instanceof TypePattern);
          if (hasTypePatterns) {
            return `${this.i()}  { return ${this.transpileNode(arm.value)}; }`;
          }
          return `${this.i()}  default: return ${this.transpileNode(arm.value)};`;
        }
        if (arm.pattern instanceof TypePattern) {
          const tn = arm.pattern.typeName;
          const binding = arm.pattern.binding.value;
          let check;
          switch (tn) {
            case "int":
              check = `typeof __subj === 'number'`;
              break;
            case "string":
              check = `typeof __subj === 'string'`;
              break;
            case "bool":
              check = `typeof __subj === 'boolean'`;
              break;
            case "array":
              check = `Array.isArray(__subj)`;
              break;
            case "fn":
              check = `typeof __subj === 'function'`;
              break;
            case "Ok":
              check = `__subj && __subj.__isOk === true`;
              break;
            case "Err":
              check = `__subj && __subj.__isOk === false`;
              break;
            default:
              check = `true`;
              break;
          }
          const bindExpr = tn === "Ok" || tn === "Err" ? "__subj.value" : "__subj";
          return `${this.i()}  if (${check}) { let ${binding} = ${bindExpr}; return ${this.transpileNode(arm.value)}; }`;
        }
        return `${this.i()}  case ${this.transpileNode(arm.pattern)}: return ${this.transpileNode(arm.value)};`;
      }).join("\n");
      return `((__subj) => {
${arms}
${this.i()}})(${subject})`;
    }
    if (node instanceof TypePattern) {
      return `/* type pattern: ${node.typeName}(${node.binding.value}) */`;
    }
    return `/* unsupported: ${node.constructor.name} */`;
  }
};

// src/wasm.js
function encodeULEB128(value) {
  const bytes = [];
  do {
    let byte = value & 127;
    value >>>= 7;
    if (value !== 0) byte |= 128;
    bytes.push(byte);
  } while (value !== 0);
  return bytes;
}
function encodeSLEB128(value) {
  const bytes = [];
  let more = true;
  while (more) {
    let byte = value & 127;
    value >>= 7;
    if (value === 0 && (byte & 64) === 0 || value === -1 && (byte & 64) !== 0) {
      more = false;
    } else {
      byte |= 128;
    }
    bytes.push(byte);
  }
  return bytes;
}
function encodeString(str) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  return [...encodeULEB128(bytes.length), ...bytes];
}
var ValType = {
  i32: 127,
  i64: 126,
  f32: 125,
  f64: 124,
  funcref: 112,
  externref: 111
};
var Op = {
  // Control
  unreachable: 0,
  nop: 1,
  block: 2,
  loop: 3,
  if: 4,
  else: 5,
  end: 11,
  br: 12,
  br_if: 13,
  br_table: 14,
  return: 15,
  call: 16,
  call_indirect: 17,
  // Parametric
  drop: 26,
  select: 27,
  // Variable
  local_get: 32,
  local_set: 33,
  local_tee: 34,
  global_get: 35,
  global_set: 36,
  // Memory
  i32_load: 40,
  i64_load: 41,
  f32_load: 42,
  f64_load: 43,
  i32_store: 54,
  i64_store: 55,
  f32_store: 56,
  f64_store: 57,
  i32_load8_s: 44,
  i32_load8_u: 45,
  i32_load16_s: 46,
  i32_load16_u: 47,
  i32_store8: 58,
  i32_store16: 59,
  memory_size: 63,
  memory_grow: 64,
  // Constants
  i32_const: 65,
  i64_const: 66,
  f32_const: 67,
  f64_const: 68,
  // i32 comparison
  i32_eqz: 69,
  i32_eq: 70,
  i32_ne: 71,
  i32_lt_s: 72,
  i32_lt_u: 73,
  i32_gt_s: 74,
  i32_gt_u: 75,
  i32_le_s: 76,
  i32_le_u: 77,
  i32_ge_s: 78,
  i32_ge_u: 79,
  // i32 arithmetic
  i32_clz: 103,
  i32_ctz: 104,
  i32_popcnt: 105,
  i32_add: 106,
  i32_sub: 107,
  i32_mul: 108,
  i32_div_s: 109,
  i32_div_u: 110,
  i32_rem_s: 111,
  i32_rem_u: 112,
  i32_and: 113,
  i32_or: 114,
  i32_xor: 115,
  i32_shl: 116,
  i32_shr_s: 117,
  i32_shr_u: 118,
  i32_rotl: 119,
  i32_rotr: 120,
  // f64 comparison
  f64_eq: 97,
  f64_ne: 98,
  f64_lt: 99,
  f64_gt: 100,
  f64_le: 101,
  f64_ge: 102,
  // f64 arithmetic
  f64_abs: 153,
  f64_neg: 154,
  f64_ceil: 155,
  f64_floor: 156,
  f64_trunc: 157,
  f64_sqrt: 159,
  f64_add: 160,
  f64_sub: 161,
  f64_mul: 162,
  f64_div: 163,
  f64_min: 164,
  f64_max: 165,
  // Conversions
  i32_trunc_f64_s: 170,
  f64_convert_i32_s: 183,
  i32_wrap_i64: 167,
  i64_extend_i32_s: 172
};
var Section = {
  Custom: 0,
  Type: 1,
  Import: 2,
  Function: 3,
  Table: 4,
  Memory: 5,
  Global: 6,
  Export: 7,
  Start: 8,
  Element: 9,
  Code: 10,
  Data: 11,
  DataCount: 12
};
var ExportKind = {
  Func: 0,
  Table: 1,
  Memory: 2,
  Global: 3
};
var FuncBodyBuilder = class {
  constructor() {
    this.locals = [];
    this.code = [];
  }
  addLocal(type, count = 1) {
    this.locals.push({ type, count });
  }
  emit(opcode, ...operands) {
    this.code.push(opcode);
    for (const op of operands) {
      if (Array.isArray(op)) {
        this.code.push(...op);
      } else {
        this.code.push(op);
      }
    }
    return this;
  }
  i32Const(value) {
    return this.emit(Op.i32_const, ...encodeSLEB128(value));
  }
  f64Const(value) {
    const buf = new ArrayBuffer(8);
    new Float64Array(buf)[0] = value;
    return this.emit(Op.f64_const, ...new Uint8Array(buf));
  }
  localGet(index) {
    return this.emit(Op.local_get, ...encodeULEB128(index));
  }
  localSet(index) {
    return this.emit(Op.local_set, ...encodeULEB128(index));
  }
  localTee(index) {
    return this.emit(Op.local_tee, ...encodeULEB128(index));
  }
  globalGet(index) {
    return this.emit(Op.global_get, ...encodeULEB128(index));
  }
  globalSet(index) {
    return this.emit(Op.global_set, ...encodeULEB128(index));
  }
  call(funcIndex) {
    return this.emit(Op.call, ...encodeULEB128(funcIndex));
  }
  callIndirect(typeIndex, tableIndex = 0) {
    return this.emit(Op.call_indirect, ...encodeULEB128(typeIndex), ...encodeULEB128(tableIndex));
  }
  // Control flow helpers
  block(blockType = 64) {
    return this.emit(Op.block, blockType);
  }
  loop(blockType = 64) {
    return this.emit(Op.loop, blockType);
  }
  if_(blockType = 64) {
    return this.emit(Op.if, blockType);
  }
  else_() {
    return this.emit(Op.else);
  }
  end() {
    return this.emit(Op.end);
  }
  br(labelIndex) {
    return this.emit(Op.br, ...encodeULEB128(labelIndex));
  }
  brIf(labelIndex) {
    return this.emit(Op.br_if, ...encodeULEB128(labelIndex));
  }
  return_() {
    return this.emit(Op.return);
  }
  drop() {
    return this.emit(Op.drop);
  }
  // Memory helpers (align=2 for i32, align=3 for f64)
  i32Load(offset = 0, align = 2) {
    return this.emit(Op.i32_load, ...encodeULEB128(align), ...encodeULEB128(offset));
  }
  i32Store(offset = 0, align = 2) {
    return this.emit(Op.i32_store, ...encodeULEB128(align), ...encodeULEB128(offset));
  }
  encode() {
    const localBytes = [];
    localBytes.push(...encodeULEB128(this.locals.length));
    for (const { type, count } of this.locals) {
      localBytes.push(...encodeULEB128(count), type);
    }
    const body = [...localBytes, ...this.code, Op.end];
    return [...encodeULEB128(body.length), ...body];
  }
};
var WasmModuleBuilder = class {
  constructor() {
    this.types = [];
    this.imports = [];
    this.functions = [];
    this.memories = [];
    this.globals = [];
    this.exports = [];
    this.tables = [];
    this.elements = [];
    this.dataSegments = [];
    this._typeCache = /* @__PURE__ */ new Map();
  }
  // Add or reuse a function type signature. Returns the type index.
  addType(params, results) {
    const key = `${params.join(",")}->${results.join(",")}`;
    if (this._typeCache.has(key)) return this._typeCache.get(key);
    const idx = this.types.length;
    this.types.push({ params, results });
    this._typeCache.set(key, idx);
    return idx;
  }
  // Add a function import. Returns the function index.
  addImport(module, name, params, results) {
    const typeIndex = this.addType(params, results);
    const idx = this.imports.length;
    this.imports.push({ module, name, kind: 0, typeIndex });
    return idx;
  }
  // Add a function. Returns the function index (imports.length + functions.length - 1).
  addFunction(params, results) {
    const typeIndex = this.addType(params, results);
    const body = new FuncBodyBuilder();
    const idx = this.imports.length + this.functions.length;
    this.functions.push({ typeIndex, body });
    return { index: idx, body };
  }
  // Add a memory (min pages, optional max pages). Returns memory index.
  addMemory(min, max) {
    const idx = this.memories.length;
    this.memories.push({ min, max });
    return idx;
  }
  // Add a mutable global. Returns global index.
  addGlobal(type, mutable, initValue = 0) {
    const idx = this.globals.length;
    this.globals.push({ type, mutable, initValue });
    return idx;
  }
  // Add an export.
  addExport(name, kind, index) {
    this.exports.push({ name, kind, index });
  }
  // Add a table (for funcref, call_indirect). Returns table index.
  addTable(type, min, max) {
    const idx = this.tables.length;
    this.tables.push({ type: type || ValType.funcref, min, max });
    return idx;
  }
  // Add an element segment (initializes table entries).
  addElement(tableIndex, offset, funcIndices) {
    this.elements.push({ tableIndex, offset, funcIndices });
  }
  // Add a data segment (at a fixed offset in memory).
  addDataSegment(offset, bytes) {
    this.dataSegments.push({ offset, bytes: Array.isArray(bytes) ? bytes : [...bytes] });
  }
  // Build the complete WASM binary.
  build() {
    const sections = [];
    if (this.types.length > 0) {
      const bytes = [];
      bytes.push(...encodeULEB128(this.types.length));
      for (const { params, results } of this.types) {
        bytes.push(96);
        bytes.push(...encodeULEB128(params.length));
        bytes.push(...params);
        bytes.push(...encodeULEB128(results.length));
        bytes.push(...results);
      }
      sections.push(this._makeSection(Section.Type, bytes));
    }
    if (this.imports.length > 0) {
      const bytes = [];
      bytes.push(...encodeULEB128(this.imports.length));
      for (const { module: module2, name, kind, typeIndex } of this.imports) {
        bytes.push(...encodeString(module2));
        bytes.push(...encodeString(name));
        bytes.push(kind);
        bytes.push(...encodeULEB128(typeIndex));
      }
      sections.push(this._makeSection(Section.Import, bytes));
    }
    if (this.functions.length > 0) {
      const bytes = [];
      bytes.push(...encodeULEB128(this.functions.length));
      for (const { typeIndex } of this.functions) {
        bytes.push(...encodeULEB128(typeIndex));
      }
      sections.push(this._makeSection(Section.Function, bytes));
    }
    if (this.tables.length > 0) {
      const bytes = [];
      bytes.push(...encodeULEB128(this.tables.length));
      for (const { type, min, max } of this.tables) {
        bytes.push(type);
        if (max !== void 0) {
          bytes.push(1);
          bytes.push(...encodeULEB128(min));
          bytes.push(...encodeULEB128(max));
        } else {
          bytes.push(0);
          bytes.push(...encodeULEB128(min));
        }
      }
      sections.push(this._makeSection(Section.Table, bytes));
    }
    if (this.memories.length > 0) {
      const bytes = [];
      bytes.push(...encodeULEB128(this.memories.length));
      for (const { min, max } of this.memories) {
        if (max !== void 0) {
          bytes.push(1);
          bytes.push(...encodeULEB128(min));
          bytes.push(...encodeULEB128(max));
        } else {
          bytes.push(0);
          bytes.push(...encodeULEB128(min));
        }
      }
      sections.push(this._makeSection(Section.Memory, bytes));
    }
    if (this.globals.length > 0) {
      const bytes = [];
      bytes.push(...encodeULEB128(this.globals.length));
      for (const { type, mutable, initValue } of this.globals) {
        bytes.push(type);
        bytes.push(mutable ? 1 : 0);
        if (type === ValType.i32) {
          bytes.push(Op.i32_const, ...encodeSLEB128(initValue), Op.end);
        } else if (type === ValType.f64) {
          const buf = new ArrayBuffer(8);
          new Float64Array(buf)[0] = initValue;
          bytes.push(Op.f64_const, ...new Uint8Array(buf), Op.end);
        }
      }
      sections.push(this._makeSection(Section.Global, bytes));
    }
    if (this.exports.length > 0) {
      const bytes = [];
      bytes.push(...encodeULEB128(this.exports.length));
      for (const { name, kind, index } of this.exports) {
        bytes.push(...encodeString(name));
        bytes.push(kind);
        bytes.push(...encodeULEB128(index));
      }
      sections.push(this._makeSection(Section.Export, bytes));
    }
    if (this.elements.length > 0) {
      const bytes = [];
      bytes.push(...encodeULEB128(this.elements.length));
      for (const { tableIndex, offset, funcIndices } of this.elements) {
        bytes.push(0);
        bytes.push(Op.i32_const, ...encodeSLEB128(offset), Op.end);
        bytes.push(...encodeULEB128(funcIndices.length));
        for (const fi of funcIndices) {
          bytes.push(...encodeULEB128(fi));
        }
      }
      sections.push(this._makeSection(Section.Element, bytes));
    }
    if (this.functions.length > 0) {
      const bytes = [];
      bytes.push(...encodeULEB128(this.functions.length));
      for (const { body } of this.functions) {
        bytes.push(...body.encode());
      }
      sections.push(this._makeSection(Section.Code, bytes));
    }
    if (this.dataSegments.length > 0) {
      const bytes = [];
      bytes.push(...encodeULEB128(this.dataSegments.length));
      for (const { offset, bytes: data } of this.dataSegments) {
        bytes.push(0);
        bytes.push(Op.i32_const, ...encodeSLEB128(offset), Op.end);
        bytes.push(...encodeULEB128(data.length));
        bytes.push(...data);
      }
      sections.push(this._makeSection(Section.Data, bytes));
    }
    const module = [
      0,
      97,
      115,
      109,
      // magic: \0asm
      1,
      0,
      0,
      0
      // version: 1
    ];
    for (const section of sections) {
      module.push(...section);
    }
    return new Uint8Array(module);
  }
  _makeSection(id, bytes) {
    return [id, ...encodeULEB128(bytes.length), ...bytes];
  }
};

// src/wasm-optimize.js
function peepholeOptimize(body) {
  return 0;
}

// src/wasm-compiler.js
var TAG_STRING = 1;
var TAG_ARRAY = 2;
var TAG_CLOSURE = 3;
var Scope = class {
  constructor(parent = null) {
    this.parent = parent;
    this.vars = /* @__PURE__ */ new Map();
    this.nextLocal = parent ? 0 : 0;
  }
  define(name, index, type = ValType.i32) {
    this.vars.set(name, { index, type });
  }
  resolve(name) {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.resolve(name);
    return null;
  }
};
var WasmCompiler = class {
  constructor() {
    this.builder = new WasmModuleBuilder();
    this.functions = [];
    this.globalScope = new Scope();
    this.currentFunc = null;
    this.currentBody = null;
    this.currentScope = null;
    this.nextParamIndex = 0;
    this.nextLocalIndex = 0;
    this.loopStack = [];
    this.errors = [];
    this.stringConstants = [];
    this.nextDataOffset = 16;
    this.closureFuncs = [];
    this.nextTableSlot = 0;
    this.stats = {
      constantsFolded: 0,
      functionsCompiled: 0,
      closuresCreated: 0,
      stringsAllocated: 0,
      arraysAllocated: 0
    };
    this.builder.addMemory(1);
    this.builder.addExport("memory", ExportKind.Memory, 0);
    this.heapPtr = this.builder.addGlobal(ValType.i32, true, 4096);
    this._runtimeFuncs = {};
  }
  compile(input) {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);
    const program = parser.parseProgram();
    if (parser.errors.length > 0) {
      this.errors = parser.errors;
      return null;
    }
    return this.compileProgram(program);
  }
  compileProgram(program) {
    this._addRuntimeFunctions();
    const topLevelFuncNames = /* @__PURE__ */ new Set();
    for (const stmt of program.statements) {
      if (stmt instanceof LetStatement && (stmt.value instanceof FunctionLiteral || stmt.value instanceof void 0)) {
        topLevelFuncNames.add(stmt.name.value);
      }
    }
    for (const stmt of program.statements) {
      if (stmt instanceof LetStatement && (stmt.value instanceof FunctionLiteral || stmt.value instanceof void 0)) {
        const params = new Set(stmt.value.parameters.map((p) => p.value || p.token?.literal));
        const hasFreeVars = this._hasFreeVariables(stmt.value, params, topLevelFuncNames);
        if (!hasFreeVars) {
          this._declareFunction(stmt.name.value, stmt.value);
        }
      }
    }
    const mainType = this.builder.addType([], [ValType.i32]);
    const { index: mainIdx, body: mainBody } = this.builder.addFunction([], [ValType.i32]);
    this.builder.addExport("main", ExportKind.Func, mainIdx);
    this.currentFunc = { name: "main", index: mainIdx };
    this.currentBody = mainBody;
    this.currentScope = new Scope(this.globalScope);
    this.nextParamIndex = 0;
    this.nextLocalIndex = 0;
    let lastIsExpr = false;
    for (let i = 0; i < program.statements.length; i++) {
      const stmt = program.statements[i];
      lastIsExpr = false;
      if (stmt instanceof LetStatement && (stmt.value instanceof FunctionLiteral || stmt.value instanceof void 0)) {
        const binding = this.currentScope.resolve(stmt.name.value);
        if (binding && binding.type === "func") {
          continue;
        }
      }
      if (stmt instanceof ExpressionStatement) {
        this.compileNode(stmt.expression);
        if (i < program.statements.length - 1) {
          mainBody.drop();
        } else {
          lastIsExpr = true;
        }
      } else if (stmt instanceof ReturnStatement) {
        this.compileNode(stmt.returnValue);
        mainBody.return_();
        lastIsExpr = true;
      } else {
        this.compileStatement(stmt);
      }
    }
    if (!lastIsExpr) {
      mainBody.i32Const(0);
    }
    this._compileFunctions();
    for (const sc of this.stringConstants) {
      const encoder = new TextEncoder();
      const strBytes = encoder.encode(sc.value);
      const data = new Uint8Array(8 + strBytes.length);
      const view = new DataView(data.buffer);
      view.setInt32(0, TAG_STRING, true);
      view.setInt32(4, strBytes.length, true);
      data.set(strBytes, 8);
      this.builder.addDataSegment(sc.offset, [...data]);
    }
    if (this.closureFuncs.length > 0) {
      const tableSize = this.closureFuncs.length;
      this.builder.addTable(ValType.funcref, tableSize, tableSize);
      const funcIndices = this.closureFuncs.map((cf) => cf.wasmFuncIndex);
      this.builder.addElement(0, 0, funcIndices);
    }
    for (const func of this.builder.functions) {
      peepholeOptimize(func.body);
    }
    return this.builder;
  }
  _addRuntimeFunctions() {
    const putsIdx = this.builder.addImport("env", "puts", [ValType.i32], []);
    this._runtimeFuncs.puts = putsIdx;
    this.globalScope.define("puts", putsIdx, "func");
    const strIdx = this.builder.addImport("env", "str", [ValType.i32], [ValType.i32]);
    this._runtimeFuncs.str = strIdx;
    this.globalScope.define("str", strIdx, "func");
    const strConcatIdx = this.builder.addImport("env", "__str_concat", [ValType.i32, ValType.i32], [ValType.i32]);
    this._runtimeFuncs.strConcat = strConcatIdx;
    const strEqIdx = this.builder.addImport("env", "__str_eq", [ValType.i32, ValType.i32], [ValType.i32]);
    this._runtimeFuncs.strEq = strEqIdx;
    const restIdx = this.builder.addImport("env", "__rest", [ValType.i32], [ValType.i32]);
    this._runtimeFuncs.rest = restIdx;
    const typeIdx = this.builder.addImport("env", "__type", [ValType.i32], [ValType.i32]);
    this._runtimeFuncs.type = typeIdx;
    this.globalScope.define("type", typeIdx, "func");
    const intIdx = this.builder.addImport("env", "__int", [ValType.i32], [ValType.i32]);
    this._runtimeFuncs.int = intIdx;
    this.globalScope.define("int", intIdx, "func");
    const sliceIdx = this.builder.addImport("env", "__slice", [ValType.i32, ValType.i32, ValType.i32], [ValType.i32]);
    this._runtimeFuncs.slice = sliceIdx;
    const { index: allocIdx, body: allocBody } = this.builder.addFunction(
      [ValType.i32],
      [ValType.i32]
    );
    allocBody.addLocal(ValType.i32);
    allocBody.globalGet(this.heapPtr).localTee(1).localGet(0).emit(Op.i32_add).globalSet(this.heapPtr);
    allocBody.localGet(1);
    this._runtimeFuncs.alloc = allocIdx;
    const { index: lenIdx, body: lenBody } = this.builder.addFunction(
      [ValType.i32],
      [ValType.i32]
    );
    lenBody.localGet(0).i32Const(4).emit(Op.i32_add).i32Load();
    this._runtimeFuncs.len = lenIdx;
    const { index: arrGetIdx, body: arrGetBody } = this.builder.addFunction(
      [ValType.i32, ValType.i32],
      [ValType.i32]
    );
    arrGetBody.localGet(0).i32Const(8).emit(Op.i32_add).localGet(1).i32Const(4).emit(Op.i32_mul).emit(Op.i32_add).i32Load();
    this._runtimeFuncs.arrayGet = arrGetIdx;
    const { index: arrSetIdx, body: arrSetBody } = this.builder.addFunction(
      [ValType.i32, ValType.i32, ValType.i32],
      []
    );
    arrSetBody.localGet(0).i32Const(8).emit(Op.i32_add).localGet(1).i32Const(4).emit(Op.i32_mul).emit(Op.i32_add).localGet(2).i32Store();
    this._runtimeFuncs.arraySet = arrSetIdx;
    const { index: makeArrIdx, body: makeArrBody } = this.builder.addFunction(
      [ValType.i32],
      [ValType.i32]
    );
    makeArrBody.addLocal(ValType.i32);
    makeArrBody.localGet(0).i32Const(4).emit(Op.i32_mul).i32Const(8).emit(Op.i32_add).call(allocIdx).localTee(1).i32Const(TAG_ARRAY).i32Store().localGet(1).i32Const(4).emit(Op.i32_add).localGet(0).i32Store();
    makeArrBody.localGet(1);
    this._runtimeFuncs.makeArray = makeArrIdx;
    const { index: pushIdx, body: pushBody } = this.builder.addFunction(
      [ValType.i32, ValType.i32],
      [ValType.i32]
    );
    pushBody.addLocal(ValType.i32);
    pushBody.addLocal(ValType.i32);
    pushBody.addLocal(ValType.i32);
    pushBody.localGet(0).call(lenIdx).localSet(2).localGet(2).i32Const(1).emit(Op.i32_add).call(makeArrIdx).localSet(3).i32Const(0).localSet(4).block().loop().localGet(4).localGet(2).emit(Op.i32_ge_s).brIf(1).localGet(3).localGet(4).localGet(0).localGet(4).call(arrGetIdx).call(arrSetIdx).localGet(4).i32Const(1).emit(Op.i32_add).localSet(4).br(0).end().end().localGet(3).localGet(2).localGet(1).call(arrSetIdx);
    pushBody.localGet(3);
    this._runtimeFuncs.push = pushIdx;
    this.globalScope.define("__alloc", allocIdx, "func");
    this.globalScope.define("__len", lenIdx, "func");
    this.globalScope.define("__array_get", arrGetIdx, "func");
    this.globalScope.define("__array_set", arrSetIdx, "func");
    this.globalScope.define("__make_array", makeArrIdx, "func");
    this.globalScope.define("__push", pushIdx, "func");
  }
  _declareFunction(name, funcLit) {
    const params = funcLit.parameters.map(() => ValType.i32);
    const results = [ValType.i32];
    const { index, body } = this.builder.addFunction(params, results);
    this.builder.addExport(name, ExportKind.Func, index);
    this.functions.push({
      name,
      index,
      body,
      funcLit,
      params
    });
    this.globalScope.define(name, index, "func");
  }
  _compileFunctions() {
    for (const func of this.functions) {
      const prevBody = this.currentBody;
      const prevScope = this.currentScope;
      const prevFunc = this.currentFunc;
      const prevLocalIdx = this.nextLocalIndex;
      const prevParamIdx = this.nextParamIndex;
      this.currentBody = func.body;
      this.currentFunc = func;
      this.currentScope = new Scope(this.globalScope);
      this.nextParamIndex = 0;
      this.nextLocalIndex = func.params.length;
      for (const param of func.funcLit.parameters) {
        const name = param.value || param.token?.literal;
        this.currentScope.define(name, this.nextParamIndex, ValType.i32);
        this.nextParamIndex++;
      }
      const body = func.funcLit.body;
      this._compileBlockReturning(body);
      this.currentBody = prevBody;
      this.currentScope = prevScope;
      this.currentFunc = prevFunc;
      this.nextLocalIndex = prevLocalIdx;
      this.nextParamIndex = prevParamIdx;
    }
  }
  _compileBlockReturning(block) {
    const stmts = block.statements;
    if (stmts.length === 0) {
      this.currentBody.i32Const(0);
      return;
    }
    for (let i = 0; i < stmts.length; i++) {
      const stmt = stmts[i];
      const isLast = i === stmts.length - 1;
      if (stmt instanceof ReturnStatement) {
        this.compileNode(stmt.returnValue);
        this.currentBody.return_();
        if (!isLast) continue;
        return;
      }
      if (stmt instanceof ExpressionStatement) {
        this.compileNode(stmt.expression);
        if (!isLast) {
          this.currentBody.drop();
        }
      } else {
        this.compileStatement(stmt);
        if (isLast) {
          this.currentBody.i32Const(0);
        }
      }
    }
  }
  compileStatement(stmt) {
    if (stmt instanceof LetStatement) {
      this.compileLetStatement(stmt);
    } else if (stmt instanceof ReturnStatement) {
      this.compileNode(stmt.returnValue);
      this.currentBody.return_();
    } else if (stmt instanceof ExpressionStatement) {
      this.compileNode(stmt.expression);
      this.currentBody.drop();
    } else if (stmt instanceof BreakStatement) {
      if (this.loopStack.length > 0) {
        const loop = this.loopStack[this.loopStack.length - 1];
        this.currentBody.br(loop.breakLabel);
      }
    } else if (stmt instanceof ContinueStatement) {
      if (this.loopStack.length > 0) {
        const loop = this.loopStack[this.loopStack.length - 1];
        this.currentBody.br(loop.continueLabel);
      }
    }
  }
  compileLetStatement(stmt) {
    const name = stmt.name.value;
    const localIdx = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentScope.define(name, localIdx, ValType.i32);
    if (stmt.value) {
      this.compileNode(stmt.value);
      this.currentBody.localSet(localIdx);
    }
  }
  compileNode(node) {
    if (node instanceof IntegerLiteral) {
      this.currentBody.i32Const(node.value);
    } else if (node instanceof FloatLiteral) {
      this.currentBody.i32Const(Math.trunc(node.value));
    } else if (node instanceof BooleanLiteral) {
      this.currentBody.i32Const(node.value ? 1 : 0);
    } else if (node instanceof NullLiteral) {
      this.currentBody.i32Const(0);
    } else if (node instanceof Identifier) {
      this.compileIdentifier(node);
    } else if (node instanceof PrefixExpression) {
      this.compilePrefixExpression(node);
    } else if (node instanceof InfixExpression) {
      this.compileInfixExpression(node);
    } else if (node instanceof IfExpression) {
      this.compileIfExpression(node);
    } else if (node instanceof CallExpression) {
      this.compileCallExpression(node);
    } else if (node instanceof FunctionLiteral || node instanceof void 0) {
      this.compileFunctionLiteral(node);
    } else if (node instanceof WhileExpression) {
      this.compileWhileExpression(node);
    } else if (node instanceof ForExpression) {
      this.compileForExpression(node);
    } else if (node instanceof ForInExpression) {
      this.compileForInExpression(node);
    } else if (node instanceof RangeExpression) {
      this.compileRangeExpression(node);
    } else if (node instanceof DoWhileExpression) {
      this.compileDoWhileExpression(node);
    } else if (node instanceof void 0) {
      this.compileNode(node.left);
      const tmpLocal = this.nextLocalIndex++;
      this.currentBody.addLocal(ValType.i32);
      this.currentBody.localTee(tmpLocal);
      this.currentBody.if_(ValType.i32);
      this.currentBody.localGet(tmpLocal);
      this.currentBody.else_();
      this.compileNode(node.right);
      this.currentBody.end();
    } else if (node instanceof void 0) {
      const callNode = new CallExpression(
        node.token || {},
        node.right,
        [node.left]
      );
      this.compileCallExpression(callNode);
    } else if (node instanceof AssignExpression) {
      this.compileAssignExpression(node);
    } else if (node instanceof BlockStatement) {
      this._compileBlockReturning(node);
    } else if (node instanceof TernaryExpression) {
      this.compileNode(node.condition);
      this.currentBody.if_(ValType.i32);
      this.compileNode(node.consequence);
      this.currentBody.else_();
      this.compileNode(node.alternative);
      this.currentBody.end();
    } else if (node instanceof StringLiteral) {
      this.compileStringLiteral(node);
    } else if (node instanceof TemplateLiteral) {
      this.compileTemplateLiteral(node);
    } else if (node instanceof ArrayLiteral) {
      this.compileArrayLiteral(node);
    } else if (node instanceof IndexExpression) {
      this.compileIndexExpression(node);
    } else if (node instanceof SliceExpression) {
      this.compileNode(node.left);
      this.compileNode(node.start || { value: 0, constructor: IntegerLiteral });
      this.compileNode(node.end || { value: 0, constructor: IntegerLiteral });
      this.currentBody.call(this._runtimeFuncs.slice);
    } else if (node instanceof HashLiteral) {
      this.currentBody.i32Const(0);
    } else if (node instanceof IndexAssignExpression) {
      this.compileNode(node.left);
      this.compileNode(node.index);
      this.compileNode(node.value);
      const tmpLocal = this.nextLocalIndex++;
      this.currentBody.addLocal(ValType.i32);
      this.currentBody.localSet(tmpLocal);
      const tmpIdx = this.nextLocalIndex++;
      this.currentBody.addLocal(ValType.i32);
      this.currentBody.localSet(tmpIdx);
      const tmpArr = this.nextLocalIndex++;
      this.currentBody.addLocal(ValType.i32);
      this.currentBody.localSet(tmpArr);
      this.currentBody.localGet(tmpArr);
      this.currentBody.localGet(tmpIdx);
      this.currentBody.localGet(tmpLocal);
      this.currentBody.call(this._runtimeFuncs.arraySet);
      this.currentBody.localGet(tmpLocal);
    } else {
      this.currentBody.i32Const(0);
    }
  }
  compileIdentifier(node) {
    const name = node.value;
    const binding = this.currentScope.resolve(name);
    if (binding) {
      if (binding.type === "func") {
        this._wrapFunctionAsClosure(name, binding.index);
      } else {
        this.currentBody.localGet(binding.index);
      }
    } else {
      this.errors.push(`undefined variable: ${name}`);
      this.currentBody.i32Const(0);
    }
  }
  // Create a closure wrapper for a named WASM function so it can be used as a value
  _wrapFunctionAsClosure(name, funcIndex) {
    const funcEntry = this.functions.find((f) => f.name === name);
    if (!funcEntry) {
      this.currentBody.i32Const(0);
      return;
    }
    const origParams = funcEntry.funcLit.parameters;
    const wrapperParams = [ValType.i32, ...origParams.map(() => ValType.i32)];
    const { index: wrapperIdx, body: wrapperBody } = this.builder.addFunction(wrapperParams, [ValType.i32]);
    for (let i = 0; i < origParams.length; i++) {
      wrapperBody.localGet(i + 1);
    }
    wrapperBody.call(funcIndex);
    const tableSlot = this.nextTableSlot++;
    this.closureFuncs.push({
      funcLit: funcEntry.funcLit,
      captures: [],
      tableIndex: tableSlot,
      wasmFuncIndex: wrapperIdx
    });
    this.currentBody.i32Const(12);
    this.currentBody.call(this._runtimeFuncs.alloc);
    const closureLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(closureLocal);
    this.currentBody.localGet(closureLocal);
    this.currentBody.i32Const(TAG_CLOSURE);
    this.currentBody.i32Store();
    this.currentBody.localGet(closureLocal);
    this.currentBody.i32Const(4);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.i32Const(tableSlot);
    this.currentBody.i32Store();
    this.currentBody.localGet(closureLocal);
    this.currentBody.i32Const(8);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.i32Const(0);
    this.currentBody.i32Store();
    this.currentBody.localGet(closureLocal);
  }
  compilePrefixExpression(node) {
    this.compileNode(node.right);
    switch (node.operator) {
      case "-":
        this.currentBody.i32Const(0);
        break;
      case "!":
        this.currentBody.emit(Op.i32_eqz);
        break;
      default:
        break;
    }
  }
  compileInfixExpression(node) {
    const folded = this._tryConstantFold(node);
    if (folded !== null) {
      this.currentBody.i32Const(folded);
      this.stats.constantsFolded++;
      return;
    }
    if (node.operator === "&&") {
      this.compileNode(node.left);
      this.currentBody.if_(ValType.i32);
      this.compileNode(node.right);
      this.currentBody.else_();
      this.currentBody.i32Const(0);
      this.currentBody.end();
      return;
    }
    if (node.operator === "||") {
      this.compileNode(node.left);
      this.currentBody.localTee(this._getTempLocal());
      this.currentBody.if_(ValType.i32);
      this.currentBody.localGet(this._getTempLocal());
      this.currentBody.else_();
      this.compileNode(node.right);
      this.currentBody.end();
      return;
    }
    if (node.operator === "+" && this._isStringExpression(node.left, node.right)) {
      this.compileNode(node.left);
      this.compileNode(node.right);
      this.currentBody.call(this._runtimeFuncs.strConcat);
      return;
    }
    if ((node.operator === "==" || node.operator === "!=") && this._isStringExpression(node.left, node.right)) {
      this.compileNode(node.left);
      this.compileNode(node.right);
      this.currentBody.call(this._runtimeFuncs.strEq);
      if (node.operator === "!=") {
        this.currentBody.emit(Op.i32_eqz);
      }
      return;
    }
    this.compileNode(node.left);
    this.compileNode(node.right);
    switch (node.operator) {
      case "+":
        this.currentBody.emit(Op.i32_add);
        break;
      case "-":
        this.currentBody.emit(Op.i32_sub);
        break;
      case "*":
        this.currentBody.emit(Op.i32_mul);
        break;
      case "/":
        this.currentBody.emit(Op.i32_div_s);
        break;
      case "%":
        this.currentBody.emit(Op.i32_rem_s);
        break;
      case "==":
        this.currentBody.emit(Op.i32_eq);
        break;
      case "!=":
        this.currentBody.emit(Op.i32_ne);
        break;
      case "<":
        this.currentBody.emit(Op.i32_lt_s);
        break;
      case ">":
        this.currentBody.emit(Op.i32_gt_s);
        break;
      case "<=":
        this.currentBody.emit(Op.i32_le_s);
        break;
      case ">=":
        this.currentBody.emit(Op.i32_ge_s);
        break;
      case "&":
        this.currentBody.emit(Op.i32_and);
        break;
      case "|":
        this.currentBody.emit(Op.i32_or);
        break;
      case "^":
        this.currentBody.emit(Op.i32_xor);
        break;
      case "<<":
        this.currentBody.emit(Op.i32_shl);
        break;
      case ">>":
        this.currentBody.emit(Op.i32_shr_s);
        break;
      default:
        this.errors.push(`unsupported operator: ${node.operator}`);
        break;
    }
  }
  compileIfExpression(node) {
    this.compileNode(node.condition);
    if (node.alternative) {
      this.currentBody.if_(ValType.i32);
      this._compileBlockReturning(node.consequence);
      this.currentBody.else_();
      this._compileBlockReturning(node.alternative);
      this.currentBody.end();
    } else {
      this.currentBody.if_(ValType.i32);
      this._compileBlockReturning(node.consequence);
      this.currentBody.else_();
      this.currentBody.i32Const(0);
      this.currentBody.end();
    }
  }
  compileCallExpression(node) {
    if (node.function instanceof Identifier) {
      const name = node.function.value;
      if (name === "len" && node.arguments.length === 1) {
        this.compileNode(node.arguments[0]);
        this.currentBody.call(this._runtimeFuncs.len);
        return;
      }
      if (name === "push" && node.arguments.length === 2) {
        this.compileNode(node.arguments[0]);
        this.compileNode(node.arguments[1]);
        this.currentBody.call(this._runtimeFuncs.push);
        return;
      }
      if (name === "puts" && node.arguments.length >= 1) {
        for (const arg of node.arguments) {
          this.compileNode(arg);
          this.currentBody.call(this._runtimeFuncs.puts);
        }
        this.currentBody.i32Const(0);
        return;
      }
      if (name === "str" && node.arguments.length === 1) {
        this.compileNode(node.arguments[0]);
        this.currentBody.call(this._runtimeFuncs.str);
        return;
      }
      if (name === "first" && node.arguments.length === 1) {
        this.compileNode(node.arguments[0]);
        this.currentBody.i32Const(0);
        this.currentBody.call(this._runtimeFuncs.arrayGet);
        return;
      }
      if (name === "last" && node.arguments.length === 1) {
        this.compileNode(node.arguments[0]);
        const arrTmp = this.nextLocalIndex++;
        this.currentBody.addLocal(ValType.i32);
        this.currentBody.localTee(arrTmp);
        this.currentBody.call(this._runtimeFuncs.len);
        this.currentBody.i32Const(1);
        this.currentBody.emit(Op.i32_sub);
        const idxTmp = this.nextLocalIndex++;
        this.currentBody.addLocal(ValType.i32);
        this.currentBody.localSet(idxTmp);
        this.currentBody.localGet(arrTmp);
        this.currentBody.localGet(idxTmp);
        this.currentBody.call(this._runtimeFuncs.arrayGet);
        return;
      }
      if (name === "rest" && node.arguments.length === 1) {
        this.compileNode(node.arguments[0]);
        this.currentBody.call(this._runtimeFuncs.rest);
        return;
      }
    }
    if (node.function instanceof Identifier) {
      const name = node.function.value;
      const binding = this.currentScope.resolve(name);
      if (binding && binding.type === "func") {
        for (const arg of node.arguments) {
          this.compileNode(arg);
        }
        this.currentBody.call(binding.index);
      } else if (binding) {
        this._emitClosureCall(node, () => this.currentBody.localGet(binding.index));
      } else {
        this.errors.push(`unknown function: ${name}`);
        this.currentBody.i32Const(0);
      }
    } else {
      this._emitClosureCall(node, () => this.compileNode(node.function));
    }
  }
  // Emit a closure call via call_indirect
  _emitClosureCall(node, emitClosure) {
    emitClosure();
    const closurePtrLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(closurePtrLocal);
    this.currentBody.localGet(closurePtrLocal);
    this.currentBody.i32Const(8);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.i32Load();
    for (const arg of node.arguments) {
      this.compileNode(arg);
    }
    this.currentBody.localGet(closurePtrLocal);
    this.currentBody.i32Const(4);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.i32Load();
    const numParams = node.arguments.length + 1;
    const paramTypes = Array(numParams).fill(ValType.i32);
    const typeIdx = this.builder.addType(paramTypes, [ValType.i32]);
    this.currentBody.callIndirect(typeIdx);
  }
  compileWhileExpression(node) {
    this.currentBody.block();
    this.currentBody.loop();
    this.loopStack.push({ breakLabel: 1, continueLabel: 0 });
    this.compileNode(node.condition);
    this.currentBody.emit(Op.i32_eqz);
    this.currentBody.brIf(1);
    this._compileBlockStatements(node.body);
    this.currentBody.br(0);
    this.loopStack.pop();
    this.currentBody.end();
    this.currentBody.end();
    this.currentBody.i32Const(0);
  }
  compileForExpression(node) {
    if (node.init) {
      if (node.init instanceof LetStatement) {
        this.compileLetStatement(node.init);
      } else {
        this.compileNode(node.init);
        this.currentBody.drop();
      }
    }
    this.currentBody.block();
    this.currentBody.loop();
    this.loopStack.push({ breakLabel: 1, continueLabel: 0 });
    if (node.condition) {
      this.compileNode(node.condition);
      this.currentBody.emit(Op.i32_eqz);
      this.currentBody.brIf(1);
    }
    this._compileBlockStatements(node.body);
    if (node.update) {
      this.compileNode(node.update);
      this.currentBody.drop();
    }
    this.currentBody.br(0);
    this.loopStack.pop();
    this.currentBody.end();
    this.currentBody.end();
    this.currentBody.i32Const(0);
  }
  compileForInExpression(node) {
    this.compileNode(node.iterable);
    const arrLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(arrLocal);
    this.currentBody.localGet(arrLocal);
    this.currentBody.call(this._runtimeFuncs.len);
    const lenLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(lenLocal);
    const iLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.i32Const(0);
    this.currentBody.localSet(iLocal);
    const varLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentScope.define(node.variable, varLocal, ValType.i32);
    this.currentBody.block();
    this.currentBody.loop();
    this.loopStack.push({ breakLabel: 1, continueLabel: 0 });
    this.currentBody.localGet(iLocal);
    this.currentBody.localGet(lenLocal);
    this.currentBody.emit(Op.i32_ge_s);
    this.currentBody.brIf(1);
    this.currentBody.localGet(arrLocal);
    this.currentBody.localGet(iLocal);
    this.currentBody.call(this._runtimeFuncs.arrayGet);
    this.currentBody.localSet(varLocal);
    this._compileBlockStatements(node.body);
    this.currentBody.localGet(iLocal);
    this.currentBody.i32Const(1);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.localSet(iLocal);
    this.currentBody.br(0);
    this.loopStack.pop();
    this.currentBody.end();
    this.currentBody.end();
    this.currentBody.i32Const(0);
  }
  compileRangeExpression(node) {
    this.compileNode(node.start);
    const startLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(startLocal);
    this.compileNode(node.end);
    const endLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(endLocal);
    this.currentBody.localGet(endLocal);
    this.currentBody.localGet(startLocal);
    this.currentBody.emit(Op.i32_sub);
    const lenLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localTee(lenLocal);
    this.currentBody.call(this._runtimeFuncs.makeArray);
    const arrLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(arrLocal);
    const iLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.i32Const(0);
    this.currentBody.localSet(iLocal);
    this.currentBody.block().loop();
    this.currentBody.localGet(iLocal);
    this.currentBody.localGet(lenLocal);
    this.currentBody.emit(Op.i32_ge_s);
    this.currentBody.brIf(1);
    this.currentBody.localGet(arrLocal);
    this.currentBody.localGet(iLocal);
    this.currentBody.localGet(startLocal);
    this.currentBody.localGet(iLocal);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.call(this._runtimeFuncs.arraySet);
    this.currentBody.localGet(iLocal);
    this.currentBody.i32Const(1);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.localSet(iLocal);
    this.currentBody.br(0);
    this.currentBody.end().end();
    this.currentBody.localGet(arrLocal);
  }
  compileDoWhileExpression(node) {
    this.currentBody.block();
    this.currentBody.loop();
    this.loopStack.push({ breakLabel: 1, continueLabel: 0 });
    this._compileBlockStatements(node.body);
    this.compileNode(node.condition);
    this.currentBody.brIf(0);
    this.loopStack.pop();
    this.currentBody.end();
    this.currentBody.end();
    this.currentBody.i32Const(0);
  }
  compileAssignExpression(node) {
    const name = node.name.value || node.name;
    const binding = this.currentScope.resolve(name);
    if (binding) {
      this.compileNode(node.value);
      this.currentBody.localTee(binding.index);
    } else {
      this.errors.push(`undefined variable for assignment: ${name}`);
      this.currentBody.i32Const(0);
    }
  }
  _compileBlockStatements(block) {
    for (const stmt of block.statements) {
      if (stmt instanceof ExpressionStatement) {
        this.compileNode(stmt.expression);
        this.currentBody.drop();
      } else if (stmt instanceof ReturnStatement) {
        this.compileNode(stmt.returnValue);
        this.currentBody.return_();
      } else {
        this.compileStatement(stmt);
      }
    }
  }
  // String literal → data segment constant
  compileStringLiteral(node) {
    const str = node.value;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const offset = this.nextDataOffset;
    this.nextDataOffset += 8 + bytes.length;
    this.nextDataOffset = this.nextDataOffset + 3 & ~3;
    this.stringConstants.push({ offset, length: bytes.length, value: str });
    this.currentBody.i32Const(offset);
  }
  // Template literal → concatenation of parts
  compileTemplateLiteral(node) {
    if (node.parts.length === 0) {
      this.compileStringLiteral({ value: "" });
      return;
    }
    const firstPart = node.parts[0];
    if (firstPart instanceof StringLiteral) {
      this.compileStringLiteral(firstPart);
    } else {
      this.compileNode(firstPart);
      this.currentBody.call(this._runtimeFuncs.str);
    }
    for (let i = 1; i < node.parts.length; i++) {
      const part = node.parts[i];
      if (part instanceof StringLiteral) {
        this.compileStringLiteral(part);
      } else {
        this.compileNode(part);
        this.currentBody.call(this._runtimeFuncs.str);
      }
      this.currentBody.call(this._runtimeFuncs.strConcat);
    }
  }
  // Function literal → closure object on heap
  compileFunctionLiteral(node) {
    const captures = this._findCaptures(node);
    const params = [ValType.i32, ...node.parameters.map(() => ValType.i32)];
    const results = [ValType.i32];
    const { index: wasmFuncIdx, body: funcBody } = this.builder.addFunction(params, results);
    const tableSlot = this.nextTableSlot++;
    const prevBody = this.currentBody;
    const prevScope = this.currentScope;
    const prevFunc = this.currentFunc;
    const prevLocalIdx = this.nextLocalIndex;
    const prevParamIdx = this.nextParamIndex;
    const prevTempLocal = this._tempLocal;
    this.currentBody = funcBody;
    this.currentFunc = { name: `closure_${tableSlot}`, index: wasmFuncIdx };
    this.currentScope = new Scope(this.globalScope);
    this.nextParamIndex = 0;
    this.nextLocalIndex = params.length;
    this._tempLocal = null;
    const envPtrLocal = 0;
    for (let i = 0; i < node.parameters.length; i++) {
      const name = node.parameters[i].value || node.parameters[i].token?.literal;
      this.currentScope.define(name, i + 1, ValType.i32);
    }
    for (let i = 0; i < captures.length; i++) {
      const localIdx = this.nextLocalIndex++;
      funcBody.addLocal(ValType.i32);
      funcBody.localGet(envPtrLocal).i32Const(4 + i * 4).emit(Op.i32_add).i32Load().localSet(localIdx);
      this.currentScope.define(captures[i], localIdx, ValType.i32);
    }
    this._compileBlockReturning(node.body);
    this.currentBody = prevBody;
    this.currentScope = prevScope;
    this.currentFunc = prevFunc;
    this.nextLocalIndex = prevLocalIdx;
    this.nextParamIndex = prevParamIdx;
    this._tempLocal = prevTempLocal;
    this.closureFuncs.push({
      funcLit: node,
      captures,
      tableIndex: tableSlot,
      wasmFuncIndex: wasmFuncIdx
    });
    const envSize = 4 + captures.length * 4;
    this.currentBody.i32Const(envSize);
    this.currentBody.call(this._runtimeFuncs.alloc);
    const envLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(envLocal);
    this.currentBody.localGet(envLocal);
    this.currentBody.i32Const(captures.length);
    this.currentBody.i32Store();
    for (let i = 0; i < captures.length; i++) {
      const binding = this.currentScope.resolve(captures[i]);
      this.currentBody.localGet(envLocal);
      this.currentBody.i32Const(4 + i * 4);
      this.currentBody.emit(Op.i32_add);
      if (binding) {
        this.currentBody.localGet(binding.index);
      } else {
        this.currentBody.i32Const(0);
      }
      this.currentBody.i32Store();
    }
    this.currentBody.i32Const(12);
    this.currentBody.call(this._runtimeFuncs.alloc);
    const closureLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(closureLocal);
    this.currentBody.localGet(closureLocal);
    this.currentBody.i32Const(TAG_CLOSURE);
    this.currentBody.i32Store();
    this.currentBody.localGet(closureLocal);
    this.currentBody.i32Const(4);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.i32Const(tableSlot);
    this.currentBody.i32Store();
    this.currentBody.localGet(closureLocal);
    this.currentBody.i32Const(8);
    this.currentBody.emit(Op.i32_add);
    this.currentBody.localGet(envLocal);
    this.currentBody.i32Store();
    this.currentBody.localGet(closureLocal);
  }
  // Check if a function literal has free variables (references to non-param, non-global names)
  _hasFreeVariables(funcLit, params, topLevelFuncNames = /* @__PURE__ */ new Set()) {
    let hasFree = false;
    const walk = (node) => {
      if (!node || hasFree) return;
      if (node instanceof FunctionLiteral || node instanceof void 0) return;
      if (node instanceof Identifier) {
        const name = node.value;
        if (!params.has(name) && !topLevelFuncNames.has(name)) {
          const binding = this.globalScope.resolve(name);
          if (!binding) hasFree = true;
        }
      }
      if (node.left) walk(node.left);
      if (node.right) walk(node.right);
      if (node.condition) walk(node.condition);
      if (node.consequence) walk(node.consequence);
      if (node.alternative) walk(node.alternative);
      if (node.expression) walk(node.expression);
      if (node.value && !(node instanceof LetStatement)) walk(node.value);
      if (node instanceof LetStatement && node.value) walk(node.value);
      if (node.returnValue) walk(node.returnValue);
      if (node.index) walk(node.index);
      if (node.function) walk(node.function);
      if (node.body && node.body.statements) {
        for (const stmt of node.body.statements) walk(stmt);
      }
      if (node.statements) {
        for (const stmt of node.statements) walk(stmt);
      }
      if (node.arguments) {
        for (const arg of node.arguments) walk(arg);
      }
      if (node.elements) {
        for (const elem of node.elements) walk(elem);
      }
    };
    if (funcLit.body && funcLit.body.statements) {
      for (const stmt of funcLit.body.statements) walk(stmt);
    }
    return hasFree;
  }
  // Find free variables in a function literal
  _findCaptures(funcLit) {
    const params = new Set(funcLit.parameters.map((p) => p.value || p.token?.literal));
    const captures = /* @__PURE__ */ new Set();
    const walk = (node) => {
      if (!node) return;
      if (node instanceof Identifier) {
        const name = node.value;
        if (!params.has(name) && this.currentScope.resolve(name) && this.currentScope.resolve(name).type !== "func") {
          captures.add(name);
        }
      }
      if (node.left) walk(node.left);
      if (node.right) walk(node.right);
      if (node.condition) walk(node.condition);
      if (node.consequence) walk(node.consequence);
      if (node.alternative) walk(node.alternative);
      if (node.expression) walk(node.expression);
      if (node.value) walk(node.value);
      if (node.returnValue) walk(node.returnValue);
      if (node.index) walk(node.index);
      if (node.function) walk(node.function);
      if (node.body && node.body.statements) {
        for (const stmt of node.body.statements) walk(stmt);
      }
      if (node.statements) {
        for (const stmt of node.statements) walk(stmt);
      }
      if (node.arguments) {
        for (const arg of node.arguments) walk(arg);
      }
      if (node.elements) {
        for (const elem of node.elements) walk(elem);
      }
      if (node.parameters) {
      }
    };
    if (funcLit.body && funcLit.body.statements) {
      for (const stmt of funcLit.body.statements) walk(stmt);
    }
    return [...captures];
  }
  // Array literal → heap-allocated array
  compileArrayLiteral(node) {
    const elements = node.elements.filter((e) => !(e instanceof SpreadElement));
    const len = elements.length;
    this.currentBody.i32Const(len);
    this.currentBody.call(this._runtimeFuncs.makeArray);
    const arrLocal = this.nextLocalIndex++;
    this.currentBody.addLocal(ValType.i32);
    this.currentBody.localSet(arrLocal);
    for (let i = 0; i < len; i++) {
      this.currentBody.localGet(arrLocal);
      this.currentBody.i32Const(i);
      this.compileNode(elements[i]);
      this.currentBody.call(this._runtimeFuncs.arraySet);
    }
    this.currentBody.localGet(arrLocal);
  }
  // Index expression: arr[idx]
  compileIndexExpression(node) {
    this.compileNode(node.left);
    this.compileNode(node.index);
    this.currentBody.call(this._runtimeFuncs.arrayGet);
  }
  // Temp local for || operator
  _tempLocal = null;
  _getTempLocal() {
    if (this._tempLocal === null) {
      this._tempLocal = this.nextLocalIndex++;
      this.currentBody.addLocal(ValType.i32);
    }
    return this._tempLocal;
  }
  // Simple type inference: check if an expression produces a string
  _isStringExpression(...nodes) {
    return nodes.some((n) => this._nodeIsString(n));
  }
  _nodeIsString(node) {
    if (node instanceof StringLiteral) return true;
    if (node instanceof CallExpression && node.function instanceof Identifier && node.function.value === "str") return true;
    if (node instanceof InfixExpression && node.operator === "+" && this._isStringExpression(node.left, node.right)) return true;
    return false;
  }
  // Constant folding: try to evaluate an expression at compile time
  _tryConstantFold(node) {
    if (!(node instanceof InfixExpression)) return null;
    const left = this._getConstValue(node.left);
    const right = this._getConstValue(node.right);
    if (left === null || right === null) return null;
    switch (node.operator) {
      case "+":
        return left + right | 0;
      case "-":
        return left - right | 0;
      case "*":
        return Math.imul(left, right);
      case "/":
        return right !== 0 ? left / right | 0 : null;
      case "%":
        return right !== 0 ? left % right | 0 : null;
      case "==":
        return left === right ? 1 : 0;
      case "!=":
        return left !== right ? 1 : 0;
      case "<":
        return left < right ? 1 : 0;
      case ">":
        return left > right ? 1 : 0;
      case "<=":
        return left <= right ? 1 : 0;
      case ">=":
        return left >= right ? 1 : 0;
      case "&":
        return left & right;
      case "|":
        return left | right;
      case "^":
        return left ^ right;
      case "<<":
        return left << right;
      case ">>":
        return left >> right;
      default:
        return null;
    }
  }
  _getConstValue(node) {
    if (node instanceof IntegerLiteral) return node.value;
    if (node instanceof BooleanLiteral) return node.value ? 1 : 0;
    if (node instanceof InfixExpression) return this._tryConstantFold(node);
    if (node instanceof PrefixExpression && node.operator === "-") {
      const val = this._getConstValue(node.right);
      return val !== null ? -val : null;
    }
    if (node instanceof PrefixExpression && node.operator === "!") {
      const val = this._getConstValue(node.right);
      return val !== null ? val === 0 ? 1 : 0 : null;
    }
    return null;
  }
};
var origPrefix = WasmCompiler.prototype.compilePrefixExpression;
WasmCompiler.prototype.compilePrefixExpression = function(node) {
  if (node.operator === "-") {
    this.currentBody.i32Const(0);
    this.compileNode(node.right);
    this.currentBody.emit(Op.i32_sub);
    return;
  }
  if (node.operator === "!") {
    this.compileNode(node.right);
    this.currentBody.emit(Op.i32_eqz);
    return;
  }
  this.compileNode(node.right);
};
function createWasmImports(outputLines = [], memoryRef = { memory: null }) {
  function readString(ptr) {
    const mem = memoryRef.memory;
    if (!mem || ptr <= 0) return "";
    const view = new DataView(mem.buffer);
    const tag = view.getInt32(ptr, true);
    if (tag !== TAG_STRING) return String(ptr);
    const len = view.getInt32(ptr + 4, true);
    const bytes = new Uint8Array(mem.buffer, ptr + 8, len);
    return new TextDecoder().decode(bytes);
  }
  function writeString(str) {
    const mem = memoryRef.memory;
    if (!mem) return 0;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const view = new DataView(mem.buffer);
    if (!memoryRef.jsHeapPtr) memoryRef.jsHeapPtr = 6e4;
    const ptr = memoryRef.jsHeapPtr;
    memoryRef.jsHeapPtr += 8 + bytes.length;
    memoryRef.jsHeapPtr = memoryRef.jsHeapPtr + 3 & ~3;
    view.setInt32(ptr, TAG_STRING, true);
    view.setInt32(ptr + 4, bytes.length, true);
    new Uint8Array(mem.buffer).set(bytes, ptr + 8);
    return ptr;
  }
  return {
    env: {
      puts(value) {
        const mem = memoryRef.memory;
        if (mem) {
          const view = new DataView(mem.buffer);
          const formatted = formatWasmValue(value, view);
          outputLines.push(formatted);
        } else {
          outputLines.push(String(value));
        }
      },
      str(value) {
        const mem = memoryRef.memory;
        if (!mem) return value;
        const view = new DataView(mem.buffer);
        const formatted = formatWasmValue(value, view);
        return writeString(formatted);
      },
      __str_concat(ptr1, ptr2) {
        const s1 = readString(ptr1);
        const s2 = readString(ptr2);
        return writeString(s1 + s2);
      },
      __str_eq(ptr1, ptr2) {
        const s1 = readString(ptr1);
        const s2 = readString(ptr2);
        return s1 === s2 ? 1 : 0;
      },
      __rest(arrPtr) {
        const mem = memoryRef.memory;
        if (!mem || arrPtr <= 0) return 0;
        const view = new DataView(mem.buffer);
        const tag = view.getInt32(arrPtr, true);
        if (tag !== TAG_ARRAY) return 0;
        const len = view.getInt32(arrPtr + 4, true);
        if (len <= 0) return 0;
        const newLen = len - 1;
        if (!memoryRef.jsHeapPtr) memoryRef.jsHeapPtr = 6e4;
        const newPtr = memoryRef.jsHeapPtr;
        const newSize = 8 + newLen * 4;
        memoryRef.jsHeapPtr += newSize;
        memoryRef.jsHeapPtr = memoryRef.jsHeapPtr + 3 & ~3;
        view.setInt32(newPtr, TAG_ARRAY, true);
        view.setInt32(newPtr + 4, newLen, true);
        for (let i = 0; i < newLen; i++) {
          const elem = view.getInt32(arrPtr + 8 + (i + 1) * 4, true);
          view.setInt32(newPtr + 8 + i * 4, elem, true);
        }
        return newPtr;
      },
      __type(value) {
        const mem = memoryRef.memory;
        if (!mem) return writeString("unknown");
        const view = new DataView(mem.buffer);
        if (value > 0 && value + 8 <= view.byteLength) {
          try {
            const tag = view.getInt32(value, true);
            if (tag === TAG_STRING) return writeString("STRING");
            if (tag === TAG_ARRAY) return writeString("ARRAY");
            if (tag === TAG_CLOSURE) return writeString("FUNCTION");
          } catch (e) {
          }
        }
        return writeString("INTEGER");
      },
      __int(value) {
        const mem = memoryRef.memory;
        if (!mem) return value;
        const view = new DataView(mem.buffer);
        if (value > 0 && value + 8 <= view.byteLength) {
          try {
            const tag = view.getInt32(value, true);
            if (tag === TAG_STRING) {
              const str = readString(value);
              return parseInt(str, 10) || 0;
            }
          } catch (e) {
          }
        }
        return value;
      },
      __slice(arrPtr, start, end) {
        const mem = memoryRef.memory;
        if (!mem || arrPtr <= 0) return 0;
        const view = new DataView(mem.buffer);
        const tag = view.getInt32(arrPtr, true);
        if (tag !== TAG_ARRAY) return 0;
        const len = view.getInt32(arrPtr + 4, true);
        if (end <= 0) end = len;
        if (start < 0) start = 0;
        if (end > len) end = len;
        const newLen = Math.max(0, end - start);
        if (!memoryRef.jsHeapPtr) memoryRef.jsHeapPtr = 6e4;
        const newPtr = memoryRef.jsHeapPtr;
        memoryRef.jsHeapPtr += 8 + newLen * 4;
        memoryRef.jsHeapPtr = memoryRef.jsHeapPtr + 3 & ~3;
        view.setInt32(newPtr, TAG_ARRAY, true);
        view.setInt32(newPtr + 4, newLen, true);
        for (let i = 0; i < newLen; i++) {
          const elem = view.getInt32(arrPtr + 8 + (start + i) * 4, true);
          view.setInt32(newPtr + 8 + i * 4, elem, true);
        }
        return newPtr;
      }
    }
  };
}
function formatWasmValue(value, dataView) {
  if (value > 0 && dataView && value + 8 <= dataView.byteLength) {
    try {
      const tag = dataView.getInt32(value, true);
      if (tag === TAG_STRING) {
        const len = dataView.getInt32(value + 4, true);
        if (len >= 0 && len < 1e5 && value + 8 + len <= dataView.byteLength) {
          const bytes = new Uint8Array(dataView.buffer, value + 8, len);
          return new TextDecoder().decode(bytes);
        }
      }
      if (tag === TAG_ARRAY) {
        const len = dataView.getInt32(value + 4, true);
        if (len >= 0 && len < 1e5) {
          const elems = [];
          for (let i = 0; i < len; i++) {
            const elem = dataView.getInt32(value + 8 + i * 4, true);
            elems.push(formatWasmValue(elem, dataView));
          }
          return "[" + elems.join(", ") + "]";
        }
      }
    } catch (e) {
    }
  }
  return String(value);
}
async function compileAndRun(input, options = {}) {
  const timings = {};
  const t0 = performance.now();
  const compiler = new WasmCompiler();
  const builder = compiler.compile(input);
  timings.compile = performance.now() - t0;
  if (!builder || compiler.errors.length > 0) {
    throw new Error(`Compilation errors: ${compiler.errors.join(", ")}`);
  }
  const t1 = performance.now();
  const binary = builder.build();
  timings.encode = performance.now() - t1;
  const t2 = performance.now();
  const module = await WebAssembly.compile(binary);
  timings.wasmCompile = performance.now() - t2;
  const outputLines = options.outputLines || [];
  const memoryRef = { memory: null };
  const imports = createWasmImports(outputLines, memoryRef);
  const t3 = performance.now();
  const instance = await WebAssembly.instantiate(module, imports);
  memoryRef.memory = instance.exports.memory;
  timings.instantiate = performance.now() - t3;
  const t4 = performance.now();
  const result = instance.exports.main();
  timings.execute = performance.now() - t4;
  timings.total = performance.now() - t0;
  if (options.timings) Object.assign(options.timings, timings);
  return result;
}
async function compileToInstance(input, options = {}) {
  const compiler = new WasmCompiler();
  const builder = compiler.compile(input);
  if (!builder || compiler.errors.length > 0) {
    throw new Error(`Compilation errors: ${compiler.errors.join(", ")}`);
  }
  const binary = builder.build();
  const module = await WebAssembly.compile(binary);
  const outputLines = options.outputLines || [];
  const memoryRef = { memory: null };
  const imports = createWasmImports(outputLines, memoryRef);
  const instance = await WebAssembly.instantiate(module, imports);
  memoryRef.memory = instance.exports.memory;
  return instance;
}

// src/wasm-dis.js
var BinaryReader = class {
  constructor(buffer) {
    this.buffer = new Uint8Array(buffer);
    this.offset = 0;
  }
  get eof() {
    return this.offset >= this.buffer.length;
  }
  get remaining() {
    return this.buffer.length - this.offset;
  }
  readByte() {
    if (this.offset >= this.buffer.length) throw new Error("Unexpected end of binary");
    return this.buffer[this.offset++];
  }
  readBytes(n) {
    if (this.offset + n > this.buffer.length) throw new Error("Unexpected end of binary");
    const bytes = this.buffer.slice(this.offset, this.offset + n);
    this.offset += n;
    return bytes;
  }
  readULEB128() {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = this.readByte();
      result |= (byte & 127) << shift;
      shift += 7;
    } while (byte & 128);
    return result >>> 0;
  }
  readSLEB128() {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = this.readByte();
      result |= (byte & 127) << shift;
      shift += 7;
    } while (byte & 128);
    if (shift < 32 && byte & 64) {
      result |= ~0 << shift;
    }
    return result;
  }
  readF32() {
    const bytes = this.readBytes(4);
    return new Float32Array(bytes.buffer)[0];
  }
  readF64() {
    const bytes = this.readBytes(8);
    return new Float64Array(bytes.buffer)[0];
  }
  readString() {
    const len = this.readULEB128();
    const bytes = this.readBytes(len);
    return new TextDecoder().decode(bytes);
  }
};
var SectionId = {
  0: "custom",
  1: "type",
  2: "import",
  3: "function",
  4: "table",
  5: "memory",
  6: "global",
  7: "export",
  8: "start",
  9: "element",
  10: "code",
  11: "data",
  12: "datacount"
};
var ValTypeName = {
  127: "i32",
  126: "i64",
  125: "f32",
  124: "f64",
  112: "funcref",
  111: "externref"
};
var ExportKindName = {
  0: "func",
  1: "table",
  2: "memory",
  3: "global"
};
var OpNames = {
  0: "unreachable",
  1: "nop",
  2: "block",
  3: "loop",
  4: "if",
  5: "else",
  11: "end",
  12: "br",
  13: "br_if",
  14: "br_table",
  15: "return",
  16: "call",
  17: "call_indirect",
  26: "drop",
  27: "select",
  32: "local.get",
  33: "local.set",
  34: "local.tee",
  35: "global.get",
  36: "global.set",
  40: "i32.load",
  41: "i64.load",
  42: "f32.load",
  43: "f64.load",
  44: "i32.load8_s",
  45: "i32.load8_u",
  46: "i32.load16_s",
  47: "i32.load16_u",
  54: "i32.store",
  55: "i64.store",
  56: "f32.store",
  57: "f64.store",
  58: "i32.store8",
  59: "i32.store16",
  63: "memory.size",
  64: "memory.grow",
  65: "i32.const",
  66: "i64.const",
  67: "f32.const",
  68: "f64.const",
  69: "i32.eqz",
  70: "i32.eq",
  71: "i32.ne",
  72: "i32.lt_s",
  73: "i32.lt_u",
  74: "i32.gt_s",
  75: "i32.gt_u",
  76: "i32.le_s",
  77: "i32.le_u",
  78: "i32.ge_s",
  79: "i32.ge_u",
  80: "i64.eqz",
  81: "i64.eq",
  82: "i64.ne",
  97: "f64.eq",
  98: "f64.ne",
  99: "f64.lt",
  100: "f64.gt",
  101: "f64.le",
  102: "f64.ge",
  103: "i32.clz",
  104: "i32.ctz",
  105: "i32.popcnt",
  106: "i32.add",
  107: "i32.sub",
  108: "i32.mul",
  109: "i32.div_s",
  110: "i32.div_u",
  111: "i32.rem_s",
  112: "i32.rem_u",
  113: "i32.and",
  114: "i32.or",
  115: "i32.xor",
  116: "i32.shl",
  117: "i32.shr_s",
  118: "i32.shr_u",
  119: "i32.rotl",
  120: "i32.rotr",
  153: "f64.abs",
  154: "f64.neg",
  155: "f64.ceil",
  156: "f64.floor",
  157: "f64.trunc",
  159: "f64.sqrt",
  160: "f64.add",
  161: "f64.sub",
  162: "f64.mul",
  163: "f64.div",
  164: "f64.min",
  165: "f64.max",
  167: "i32.wrap_i64",
  170: "i32.trunc_f64_s",
  172: "i64.extend_i32_s",
  183: "f64.convert_i32_s"
};
var WasmDisassembler = class {
  constructor(buffer) {
    this.reader = new BinaryReader(buffer);
    this.module = {
      types: [],
      imports: [],
      functions: [],
      // type indices
      tables: [],
      memories: [],
      globals: [],
      exports: [],
      start: null,
      elements: [],
      codes: [],
      // function bodies
      datas: []
    };
  }
  disassemble() {
    this.readHeader();
    this.readSections();
    return this.module;
  }
  readHeader() {
    const magic = this.reader.readBytes(4);
    if (magic[0] !== 0 || magic[1] !== 97 || magic[2] !== 115 || magic[3] !== 109) {
      throw new Error("Not a valid WASM binary (bad magic)");
    }
    const version = this.reader.readBytes(4);
    this.module.version = version[0];
  }
  readSections() {
    while (!this.reader.eof) {
      const id = this.reader.readByte();
      const size = this.reader.readULEB128();
      const startOffset = this.reader.offset;
      const name = SectionId[id] || `unknown(${id})`;
      switch (id) {
        case 1:
          this.readTypeSection();
          break;
        case 2:
          this.readImportSection();
          break;
        case 3:
          this.readFunctionSection();
          break;
        case 4:
          this.readTableSection();
          break;
        case 5:
          this.readMemorySection();
          break;
        case 6:
          this.readGlobalSection();
          break;
        case 7:
          this.readExportSection();
          break;
        case 8:
          this.readStartSection();
          break;
        case 9:
          this.readElementSection();
          break;
        case 10:
          this.readCodeSection();
          break;
        case 11:
          this.readDataSection();
          break;
        default:
          this.reader.readBytes(size);
      }
      const consumed = this.reader.offset - startOffset;
      if (consumed < size) {
        this.reader.readBytes(size - consumed);
      }
    }
  }
  readTypeSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const form = this.reader.readByte();
      const paramCount = this.reader.readULEB128();
      const params = [];
      for (let j = 0; j < paramCount; j++) params.push(this.reader.readByte());
      const resultCount = this.reader.readULEB128();
      const results = [];
      for (let j = 0; j < resultCount; j++) results.push(this.reader.readByte());
      this.module.types.push({ params, results });
    }
  }
  readImportSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const module = this.reader.readString();
      const name = this.reader.readString();
      const kind = this.reader.readByte();
      let desc;
      if (kind === 0) {
        desc = { kind: "func", typeIndex: this.reader.readULEB128() };
      } else if (kind === 1) {
        const type = this.reader.readByte();
        const { min, max } = this.readLimits();
        desc = { kind: "table", type, min, max };
      } else if (kind === 2) {
        const { min, max } = this.readLimits();
        desc = { kind: "memory", min, max };
      } else if (kind === 3) {
        const type = this.reader.readByte();
        const mutable = this.reader.readByte();
        desc = { kind: "global", type, mutable: mutable === 1 };
      }
      this.module.imports.push({ module, name, ...desc });
    }
  }
  readFunctionSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      this.module.functions.push(this.reader.readULEB128());
    }
  }
  readTableSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const type = this.reader.readByte();
      const { min, max } = this.readLimits();
      this.module.tables.push({ type, min, max });
    }
  }
  readMemorySection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const { min, max } = this.readLimits();
      this.module.memories.push({ min, max });
    }
  }
  readGlobalSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const type = this.reader.readByte();
      const mutable = this.reader.readByte();
      const init = this.readInitExpr();
      this.module.globals.push({ type, mutable: mutable === 1, init });
    }
  }
  readExportSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const name = this.reader.readString();
      const kind = this.reader.readByte();
      const index = this.reader.readULEB128();
      this.module.exports.push({ name, kind, index });
    }
  }
  readStartSection() {
    this.module.start = this.reader.readULEB128();
  }
  readElementSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const flags = this.reader.readByte();
      const offset = this.readInitExpr();
      const funcCount = this.reader.readULEB128();
      const funcIndices = [];
      for (let j = 0; j < funcCount; j++) {
        funcIndices.push(this.reader.readULEB128());
      }
      this.module.elements.push({ flags, offset, funcIndices });
    }
  }
  readCodeSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const bodySize = this.reader.readULEB128();
      const bodyStart = this.reader.offset;
      const localDeclCount = this.reader.readULEB128();
      const locals = [];
      for (let j = 0; j < localDeclCount; j++) {
        const count2 = this.reader.readULEB128();
        const type = this.reader.readByte();
        locals.push({ count: count2, type });
      }
      const instructions = [];
      while (this.reader.offset < bodyStart + bodySize) {
        instructions.push(this.readInstruction());
      }
      this.module.codes.push({ locals, instructions });
    }
  }
  readDataSection() {
    const count = this.reader.readULEB128();
    for (let i = 0; i < count; i++) {
      const flags = this.reader.readByte();
      let offset = null;
      if (flags === 0) {
        offset = this.readInitExpr();
      }
      const size = this.reader.readULEB128();
      const data = this.reader.readBytes(size);
      this.module.datas.push({ flags, offset, data });
    }
  }
  readLimits() {
    const flags = this.reader.readByte();
    const min = this.reader.readULEB128();
    const max = flags & 1 ? this.reader.readULEB128() : void 0;
    return { min, max };
  }
  readInitExpr() {
    const instructions = [];
    while (true) {
      const inst = this.readInstruction();
      instructions.push(inst);
      if (inst.op === "end") break;
    }
    if (instructions.length === 2 && instructions[0].operands.length > 0) {
      return instructions[0];
    }
    return instructions;
  }
  readInstruction() {
    const opcode = this.reader.readByte();
    const name = OpNames[opcode] || `unknown(0x${opcode.toString(16)})`;
    const operands = [];
    switch (opcode) {
      // Block-type instructions
      case 2:
      case 3:
      case 4: {
        const bt = this.reader.readSLEB128();
        if (bt === -64) {
          operands.push("(result)");
        } else if (ValTypeName[bt & 255]) {
          operands.push(`(result ${ValTypeName[bt & 255]})`);
        }
        break;
      }
      // Branch
      case 12:
      case 13:
        operands.push(this.reader.readULEB128());
        break;
      // br_table
      case 14: {
        const count = this.reader.readULEB128();
        const targets = [];
        for (let i = 0; i <= count; i++) targets.push(this.reader.readULEB128());
        operands.push(targets);
        break;
      }
      // call
      case 16:
        operands.push(this.reader.readULEB128());
        break;
      // call_indirect
      case 17:
        operands.push(this.reader.readULEB128());
        operands.push(this.reader.readULEB128());
        break;
      // Variable instructions
      case 32:
      case 33:
      case 34:
      // local.get/set/tee
      case 35:
      case 36:
        operands.push(this.reader.readULEB128());
        break;
      // Memory instructions
      case 40:
      case 41:
      case 42:
      case 43:
      // load
      case 44:
      case 45:
      case 46:
      case 47:
      case 54:
      case 55:
      case 56:
      case 57:
      // store
      case 58:
      case 59:
        operands.push({ align: this.reader.readULEB128(), offset: this.reader.readULEB128() });
        break;
      // memory.size, memory.grow
      case 63:
      case 64:
        operands.push(this.reader.readByte());
        break;
      // Constants
      case 65:
        operands.push(this.reader.readSLEB128());
        break;
      case 66:
        operands.push(this.reader.readSLEB128());
        break;
      case 67:
        operands.push(this.reader.readF32());
        break;
      case 68:
        operands.push(this.reader.readF64());
        break;
    }
    return { op: name, opcode, operands };
  }
};
function formatWAT(module) {
  const lines = [];
  const indent = (depth) => "  ".repeat(depth);
  lines.push("(module");
  for (let i = 0; i < module.types.length; i++) {
    const t = module.types[i];
    const params = t.params.map((p) => ValTypeName[p] || `0x${p.toString(16)}`).join(" ");
    const results = t.results.map((r) => ValTypeName[r] || `0x${r.toString(16)}`).join(" ");
    lines.push(`${indent(1)}(type (;${i};) (func${params ? " (param " + params + ")" : ""}${results ? " (result " + results + ")" : ""}))`);
  }
  for (let i = 0; i < module.imports.length; i++) {
    const imp = module.imports[i];
    let desc = "";
    if (imp.kind === "func") desc = `(func (;${i};) (type ${imp.typeIndex}))`;
    else if (imp.kind === "memory") desc = `(memory (;${i};) ${imp.min}${imp.max !== void 0 ? " " + imp.max : ""})`;
    else if (imp.kind === "table") desc = `(table (;${i};) ${imp.min}${imp.max !== void 0 ? " " + imp.max : ""} ${ValTypeName[imp.type] || "funcref"})`;
    else if (imp.kind === "global") desc = `(global (;${i};) ${imp.mutable ? "(mut " : ""}${ValTypeName[imp.type] || "?"}${imp.mutable ? ")" : ""})`;
    lines.push(`${indent(1)}(import "${imp.module}" "${imp.name}" ${desc})`);
  }
  const importFuncCount = module.imports.filter((i) => i.kind === "func").length;
  for (let i = 0; i < module.tables.length; i++) {
    const t = module.tables[i];
    lines.push(`${indent(1)}(table (;${i};) ${t.min}${t.max !== void 0 ? " " + t.max : ""} ${ValTypeName[t.type] || "funcref"})`);
  }
  for (let i = 0; i < module.memories.length; i++) {
    const m = module.memories[i];
    lines.push(`${indent(1)}(memory (;${i};) ${m.min}${m.max !== void 0 ? " " + m.max : ""})`);
  }
  for (let i = 0; i < module.globals.length; i++) {
    const g = module.globals[i];
    const typeName = ValTypeName[g.type] || "?";
    const initStr = g.init?.op ? `(${g.init.op} ${g.init.operands[0]})` : "(i32.const 0)";
    lines.push(`${indent(1)}(global (;${i};) ${g.mutable ? "(mut " + typeName + ")" : typeName} ${initStr})`);
  }
  for (const exp of module.exports) {
    const kindName = ExportKindName[exp.kind] || "?";
    lines.push(`${indent(1)}(export "${exp.name}" (${kindName} ${exp.index}))`);
  }
  for (const elem of module.elements) {
    const offsetStr = elem.offset?.op ? `(${elem.offset.op} ${elem.offset.operands[0]})` : "(i32.const 0)";
    lines.push(`${indent(1)}(elem ${offsetStr} func ${elem.funcIndices.join(" ")})`);
  }
  const funcNames = {};
  for (const exp of module.exports) {
    if (exp.kind === 0) funcNames[exp.index] = exp.name;
  }
  for (let i = 0; i < module.codes.length; i++) {
    const funcIdx = importFuncCount + i;
    const typeIdx = module.functions[i];
    const code = module.codes[i];
    const type = module.types[typeIdx];
    const exportName = module.exports.find((e) => e.kind === 0 && e.index === funcIdx);
    const nameComment = exportName ? ` ;; ${exportName.name}` : "";
    lines.push(`${indent(1)}(func (;${funcIdx};) (type ${typeIdx})${nameComment}`);
    if (type.params.length > 0) {
      lines.push(`${indent(2)}(param ${type.params.map((p) => ValTypeName[p]).join(" ")})`);
    }
    if (type.results.length > 0) {
      lines.push(`${indent(2)}(result ${type.results.map((r) => ValTypeName[r]).join(" ")})`);
    }
    for (const local of code.locals) {
      const typeName = ValTypeName[local.type] || "?";
      for (let j = 0; j < local.count; j++) {
        lines.push(`${indent(2)}(local ${typeName})`);
      }
    }
    let depth = 2;
    for (const inst of code.instructions) {
      if (inst.op === "end" || inst.op === "else") depth--;
      const line = formatInstruction(inst, depth, funcNames);
      if (line) lines.push(line);
      if (inst.op === "block" || inst.op === "loop" || inst.op === "if" || inst.op === "else") depth++;
    }
    lines.push(`${indent(1)})`);
  }
  for (let i = 0; i < module.datas.length; i++) {
    const d = module.datas[i];
    const offsetStr = d.offset?.op ? `(${d.offset.op} ${d.offset.operands[0]})` : "";
    const hexBytes = Array.from(d.data).map((b) => "\\" + b.toString(16).padStart(2, "0")).join("");
    lines.push(`${indent(1)}(data ${offsetStr} "${hexBytes}")`);
  }
  lines.push(")");
  return lines.join("\n");
}
function formatInstruction(inst, depth, funcNames = {}) {
  const ind = "  ".repeat(depth);
  if (inst.op === "end") return `${ind}${inst.op}`;
  const ops = inst.operands;
  if (ops.length === 0) return `${ind}${inst.op}`;
  if (typeof ops[0] === "object" && ops[0] !== null && "align" in ops[0]) {
    const { align, offset } = ops[0];
    const parts = [];
    if (offset > 0) parts.push(`offset=${offset}`);
    if (align > 0) parts.push(`align=${1 << align}`);
    return `${ind}${inst.op}${parts.length ? " " + parts.join(" ") : ""}`;
  }
  if (inst.op === "block" || inst.op === "loop" || inst.op === "if") {
    return `${ind}${inst.op}${ops[0] !== "(result)" ? " " + ops[0] : ""}`;
  }
  if (inst.op === "call") {
    const funcIdx = ops[0];
    const name = funcNames[funcIdx];
    return `${ind}call ${funcIdx}${name ? " ;; " + name : ""}`;
  }
  if (inst.op === "call_indirect") {
    return `${ind}${inst.op} (type ${ops[0]})`;
  }
  return `${ind}${inst.op} ${ops.join(" ")}`;
}
function disassemble(buffer) {
  const dis = new WasmDisassembler(buffer);
  const module = dis.disassemble();
  return formatWAT(module);
}
export {
  Compiler,
  Environment,
  ExportKind,
  FuncBodyBuilder,
  IR,
  Lexer,
  NULL,
  Op,
  Parser,
  STDLIB_SOURCE,
  Transpiler,
  VM,
  ValType,
  WasmCompiler,
  WasmModuleBuilder,
  formatWasmValue,
  monkeyEval,
  compileAndRun as wasmCompileAndRun,
  compileToInstance as wasmCompileToInstance,
  disassemble as wasmDisassemble,
  withStdlib
};
