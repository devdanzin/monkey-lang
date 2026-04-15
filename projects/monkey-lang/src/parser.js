// Monkey Language Parser — Pratt (Top-Down Operator Precedence)

import { TokenType, Token, Lexer } from './lexer.js';
import * as ast from './ast.js';

const Precedence = {
  LOWEST: 1,
  ASSIGN: 2,      // =
  PIPE: 3,         // |>
  NULLISH: 4,     // ??
  OR: 5,           // ||
  AND: 6,          // &&
  EQUALS: 7,       // ==
  LESSGREATER: 8,  // > or <
  SUM: 9,          // +
  PRODUCT: 10,     // *
  PREFIX: 11,      // -X or !X
  CALL: 12,        // myFunction(X)
  INDEX: 13,       // array[index]
};

const TOKEN_PRECEDENCE = {
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
  [TokenType.PLUS_PLUS]: Precedence.CALL,   // postfix, high precedence
  [TokenType.MINUS_MINUS]: Precedence.CALL, // ternary has same precedence as OR
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
  [TokenType.LBRACKET]: Precedence.INDEX,
};

export class Parser {
  constructor(lexer) {
    this.lexer = lexer;
    this.errors = [];
    this.curToken = null;
    this.peekToken = null;

    this.prefixParseFns = {};
    this.infixParseFns = {};

    // Register prefix parsers
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
    this.registerPrefix(TokenType.GEN, () => this.parseGeneratorLiteral());
    this.registerPrefix(TokenType.YIELD, () => this.parseYieldExpression());
    this.registerPrefix(TokenType.SELF, () => new ast.SelfExpression(this.curToken));
    this.registerPrefix(TokenType.SUPER, () => new ast.SuperExpression(this.curToken));
    this.registerPrefix(TokenType.LBRACKET, () => this.parseArrayLiteral());
    this.registerPrefix(TokenType.LBRACE, () => this.parseHashLiteral());
    this.registerPrefix(TokenType.WHILE, () => this.parseWhileExpression());
    this.registerPrefix(TokenType.FOR, () => this.parseForExpression());
    this.registerPrefix(TokenType.BREAK, () => new ast.BreakStatement(this.curToken));
    this.registerPrefix(TokenType.CONTINUE, () => new ast.ContinueStatement(this.curToken));
    this.registerPrefix(TokenType.NULL_LIT, () => new ast.NullLiteral(this.curToken));
    this.registerPrefix(TokenType.MATCH, () => this.parseMatchExpression());
    this.registerPrefix(TokenType.DO, () => this.parseDoWhileExpression());
    this.registerPrefix(TokenType.TRY, () => this.parseTryExpression());

    // Register infix parsers
    for (const op of [TokenType.PLUS, TokenType.MINUS, TokenType.SLASH,
      TokenType.ASTERISK, TokenType.PERCENT, TokenType.EQ, TokenType.NOT_EQ,
      TokenType.LT, TokenType.GT, TokenType.LT_EQ, TokenType.GT_EQ,
      TokenType.AND, TokenType.OR, TokenType.NULLISH]) {
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
    this.registerInfix(TokenType.PLUS_PLUS, (left) => this.parsePostfixExpression(left, '+'));
    this.registerInfix(TokenType.MINUS_MINUS, (left) => this.parsePostfixExpression(left, '-'));
    for (const op of [TokenType.PLUS_ASSIGN, TokenType.MINUS_ASSIGN,
      TokenType.ASTERISK_ASSIGN, TokenType.SLASH_ASSIGN, TokenType.PERCENT_ASSIGN]) {
      this.registerInfix(op, (left) => this.parseCompoundAssignExpression(left));
    }

    // Prime the pump
    this.nextToken();
    this.nextToken();
  }

  registerPrefix(type, fn) { this.prefixParseFns[type] = fn; }
  registerInfix(type, fn) { this.infixParseFns[type] = fn; }

  nextToken() {
    this.curToken = this.peekToken;
    this.peekToken = this.lexer.nextToken();
  }

  curTokenIs(t) { return this.curToken.type === t; }
  peekTokenIs(t) { return this.peekToken.type === t; }

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

  peekPrecedence() { return TOKEN_PRECEDENCE[this.peekToken.type] || Precedence.LOWEST; }
  curPrecedence() { return TOKEN_PRECEDENCE[this.curToken.type] || Precedence.LOWEST; }

  // --- Entry point ---

  parseProgram() {
    const program = new ast.Program();
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
      case TokenType.LET: return this.parseLetStatement();
      case TokenType.CONST: return this.parseLetStatement();
      case TokenType.RETURN: return this.parseReturnStatement();
      case TokenType.IMPORT: return this.parseImportStatement();
      case TokenType.ENUM: return this.parseEnumStatement();
      case TokenType.CLASS: return this.parseClassStatement();
      case TokenType.THROW: return this.parseThrowStatement();
      default: return this.parseExpressionStatement();
    }
  }

  parseLetStatement() {
    const token = this.curToken;

    // Check for destructuring: let [a, b] = ... or let {x, y} = ...
    if (this.peekTokenIs(TokenType.LBRACKET)) {
      return this.parseDestructuringLet(token);
    }
    if (this.peekTokenIs(TokenType.LBRACE)) {
      return this.parseHashDestructuringLet(token);
    }

    if (!this.expectPeek(TokenType.IDENT)) return null;
    const name = new ast.Identifier(this.curToken, this.curToken.literal);
    if (!this.expectPeek(TokenType.ASSIGN)) return null;
    this.nextToken();
    const value = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ast.LetStatement(token, name, value);
  }

  parseDestructuringLet(token) {
    this.nextToken(); // consume [
    const names = [];
    if (!this.peekTokenIs(TokenType.RBRACKET)) {
      this.nextToken();
      names.push(new ast.Identifier(this.curToken, this.curToken.literal));
      while (this.peekTokenIs(TokenType.COMMA)) {
        this.nextToken();
        this.nextToken();
        if (this.curTokenIs(TokenType.IDENT) && this.curToken.literal === '_') {
          names.push(null); // skip this position
        } else {
          names.push(new ast.Identifier(this.curToken, this.curToken.literal));
        }
      }
    }
    if (!this.expectPeek(TokenType.RBRACKET)) return null;
    if (!this.expectPeek(TokenType.ASSIGN)) return null;
    this.nextToken();
    const value = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ast.DestructuringLet(token, names, value);
  }

  parseHashDestructuringLet(token) {
    this.nextToken(); // consume {
    const names = [];
    if (!this.peekTokenIs(TokenType.RBRACE)) {
      this.nextToken();
      names.push(new ast.Identifier(this.curToken, this.curToken.literal));
      while (this.peekTokenIs(TokenType.COMMA)) {
        this.nextToken();
        this.nextToken();
        names.push(new ast.Identifier(this.curToken, this.curToken.literal));
      }
    }
    if (!this.expectPeek(TokenType.RBRACE)) return null;
    if (!this.expectPeek(TokenType.ASSIGN)) return null;
    this.nextToken();
    const value = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ast.HashDestructuringLet(token, names, value);
  }

  parseReturnStatement() {
    const token = this.curToken;
    this.nextToken();
    const returnValue = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ast.ReturnStatement(token, returnValue);
  }

  parseImportStatement() {
    const token = this.curToken; // 'import'
    this.nextToken();
    if (this.curToken.type !== TokenType.STRING) {
      this.errors.push(`expected module name as string, got ${this.curToken.type}`);
      return null;
    }
    const moduleName = this.curToken.literal;
    
    // Check for selective import: import "math" for sqrt, PI
    let bindings = null;
    let alias = null;
    if (this.peekToken.type === TokenType.FOR) {
      this.nextToken(); // consume 'for'
      bindings = [];
      do {
        this.nextToken();
        if (this.curToken.type !== TokenType.IDENT) {
          this.errors.push(`expected identifier in import binding, got ${this.curToken.type}`);
          return null;
        }
        bindings.push(this.curToken.literal);
        if (!this.peekTokenIs(TokenType.COMMA)) break;
        this.nextToken(); // consume comma
      } while (true);
    } else if (this.peekToken.type === TokenType.IDENT && this.peekToken.literal === 'as') {
      this.nextToken(); // consume 'as'
      this.nextToken(); // consume alias
      if (this.curToken.type !== TokenType.IDENT) {
        this.errors.push(`expected identifier after 'as', got ${this.curToken.type}`);
        return null;
      }
      alias = this.curToken.literal;
    }
    
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ast.ImportStatement(token, moduleName, bindings, alias);
  }

  parseExpressionStatement() {
    const token = this.curToken;
    const expression = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ast.ExpressionStatement(token, expression);
  }

  parseEnumStatement() {
    const token = this.curToken; // 'enum'
    this.nextToken(); // expect name
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
    return new ast.EnumStatement(token, name, variants);
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
    return new ast.BlockStatement(token, statements);
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
    return new ast.Identifier(this.curToken, this.curToken.literal);
  }

  parseIntegerLiteral() {
    const value = parseInt(this.curToken.literal, 10);
    if (isNaN(value)) {
      this.errors.push(`could not parse ${this.curToken.literal} as integer`);
      return null;
    }
    return new ast.IntegerLiteral(this.curToken, value);
  }

  parseFloatLiteral() {
    const value = parseFloat(this.curToken.literal);
    if (isNaN(value)) {
      this.errors.push(`could not parse ${this.curToken.literal} as float`);
      return null;
    }
    return new ast.FloatLiteral(this.curToken, value);
  }

  parseStringLiteral() {
    return new ast.StringLiteral(this.curToken, this.curToken.literal);
  }

  parseTemplateLiteral() {
    const token = this.curToken;
    const raw = token.literal;
    const parts = [];
    let i = 0;

    while (i < raw.length) {
      // Look for ${
      const dollarIdx = raw.indexOf('${', i);
      if (dollarIdx === -1) {
        // Rest is plain string
        parts.push(new ast.StringLiteral(token, raw.slice(i)));
        break;
      }

      // Push the plain string before ${
      if (dollarIdx > i) {
        parts.push(new ast.StringLiteral(token, raw.slice(i, dollarIdx)));
      }

      // Find matching }
      let braceCount = 1;
      let j = dollarIdx + 2;
      while (j < raw.length && braceCount > 0) {
        if (raw[j] === '{') braceCount++;
        else if (raw[j] === '}') braceCount--;
        j++;
      }

      // Parse the expression inside ${}
      const exprStr = raw.slice(dollarIdx + 2, j - 1);
      const exprLexer = new Lexer(exprStr);
      const exprParser = new Parser(exprLexer);
      const expr = exprParser.parseExpression(Precedence.LOWEST);
      if (exprParser.errors.length > 0) {
        this.errors.push(...exprParser.errors);
      }
      parts.push(expr);
      i = j;
    }

    if (parts.length === 0) {
      return new ast.StringLiteral(token, '');
    }
    if (parts.length === 1 && parts[0] instanceof ast.StringLiteral) {
      return parts[0];
    }

    return new ast.TemplateLiteral(token, parts);
  }

  parseBooleanLiteral() {
    return new ast.BooleanLiteral(this.curToken, this.curTokenIs(TokenType.TRUE));
  }

  parsePrefixExpression() {
    const token = this.curToken;
    const operator = this.curToken.literal;
    this.nextToken();
    const right = this.parseExpression(Precedence.PREFIX);
    return new ast.PrefixExpression(token, operator, right);
  }

  parseInfixExpression(left) {
    const token = this.curToken;
    const operator = this.curToken.literal;
    const precedence = this.curPrecedence();
    this.nextToken();
    const right = this.parseExpression(precedence);
    return new ast.InfixExpression(token, left, operator, right);
  }

  parsePipeExpression(left) {
    const token = this.curToken;
    this.nextToken();
    const right = this.parseExpression(Precedence.PIPE);
    if (right instanceof ast.CallExpression) {
      right.arguments.unshift(left);
      return right;
    } else {
      return new ast.CallExpression(token, right, [left]);
    }
  }

  parseRangeExpression(left) {
    const token = this.curToken;
    this.nextToken();
    const end = this.parseExpression(Precedence.PIPE + 1);
    return new ast.RangeExpression(token, left, end);
  }

  parseOptionalChainExpression(left) {
    const token = this.curToken;
    // ?. can be followed by [ (index) or identifier (property)
    if (this.peekToken.type === TokenType.LBRACKET) {
      // x?.[key]
      this.nextToken(); // consume [
      this.nextToken(); // move past [
      const index = this.parseExpression(Precedence.LOWEST);
      if (!this.expectPeek(TokenType.RBRACKET)) return null;
      return new ast.OptionalChainExpression(token, left, index);
    } else if (this.peekToken.type === TokenType.IDENT) {
      // x?.name → x?.["name"]
      this.nextToken(); // move to ident
      const key = new ast.StringLiteral(this.curToken, this.curToken.literal);
      return new ast.OptionalChainExpression(token, left, key);
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
    this.nextToken(); // move to ident
    const key = new ast.StringLiteral(this.curToken, this.curToken.literal);
    return new ast.IndexExpression(token, left, key);
  }

  parseArrowExpression(left) {
    // x => expr — left must be an identifier
    if (!(left instanceof ast.Identifier)) {
      this.errors.push(`expected identifier before '=>', got ${left.constructor.name}`);
      return null;
    }
    const token = this.curToken;
    const params = [left];
    this.nextToken(); // move to body
    let body;
    if (this.curToken.type === TokenType.LBRACE) {
      body = this.parseBlockStatement();
    } else {
      const expr = this.parseExpression(Precedence.LOWEST);
      body = new ast.BlockStatement(this.curToken, [new ast.ExpressionStatement(this.curToken, expr)]);
    }
    return new ast.FunctionLiteral(token, params, body);
  }

  parseGroupedExpression() {
    // Check if this is an arrow function: () => expr or (x) => expr or (x, y) => expr
    // Save state for potential backtrack
    const savedPos = this.lexer.position;
    const savedReadPos = this.lexer.readPosition;
    const savedCh = this.lexer.ch;
    const savedCurToken = this.curToken;
    const savedPeekToken = this.peekToken;

    // Try to parse as arrow function params
    this.nextToken();
    const params = [];
    let isArrow = false;

    if (this.curToken.type === TokenType.RPAREN) {
      // () => expr
      if (this.peekToken.type === TokenType.ARROW) {
        isArrow = true;
      }
    } else if (this.curToken.type === TokenType.IDENT) {
      params.push(new ast.Identifier(this.curToken, this.curToken.literal));
      while (this.peekToken.type === TokenType.COMMA) {
        this.nextToken(); // consume comma
        this.nextToken(); // move to next ident
        if (this.curToken.type !== TokenType.IDENT) {
          // Not a param list — backtrack
          break;
        }
        params.push(new ast.Identifier(this.curToken, this.curToken.literal));
      }
      if (this.peekToken.type === TokenType.RPAREN) {
        this.nextToken(); // consume )
        if (this.peekToken.type === TokenType.ARROW) {
          isArrow = true;
        }
      }
    }

    if (isArrow) {
      this.nextToken(); // consume =>
      this.nextToken(); // move to body
      let body;
      if (this.curToken.type === TokenType.LBRACE) {
        body = this.parseBlockStatement();
      } else {
        const expr = this.parseExpression(Precedence.LOWEST);
        body = new ast.BlockStatement(this.curToken, [new ast.ExpressionStatement(this.curToken, expr)]);
      }
      return new ast.FunctionLiteral(savedCurToken, params, body);
    }

    // Not an arrow function — restore and parse as grouped expression
    // We can't easily backtrack the lexer, so re-lex from the saved position
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
        // else if — parse as a single-statement block containing an if
        this.nextToken(); // consume 'if'
        const elseIf = this.parseIfExpression();
        alternative = new ast.BlockStatement(this.curToken, [new ast.ExpressionStatement(this.curToken, elseIf)]);
      } else {
        if (!this.expectPeek(TokenType.LBRACE)) return null;
        alternative = this.parseBlockStatement();
      }
    }
    return new ast.IfExpression(token, condition, consequence, alternative);
  }

  parseWhileExpression() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.LPAREN)) return null;
    this.nextToken();
    const condition = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.RPAREN)) return null;
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const body = this.parseBlockStatement();
    return new ast.WhileExpression(token, condition, body);
  }

  parseForExpression() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.LPAREN)) return null;

    this.nextToken();

    // Check for `for (ident in expr)` pattern
    if (this.curTokenIs(TokenType.IDENT) && this.peekToken.type === TokenType.IDENT && this.peekToken.literal === 'in') {
      const varName = this.curToken.literal;
      this.nextToken(); // skip 'in'
      this.nextToken(); // move to iterable expression
      const iterable = this.parseExpression(Precedence.LOWEST);
      if (!this.expectPeek(TokenType.RPAREN)) return null;
      if (!this.expectPeek(TokenType.LBRACE)) return null;
      const body = this.parseBlockStatement();
      return new ast.ForInExpression(token, varName, iterable, body);
    }

    // Check for `for ([a, b] in expr)` destructuring for-in
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
      this.nextToken(); // should be 'in'
      if (!(this.curTokenIs(TokenType.IDENT) && this.curToken.literal === 'in')) {
        this.errors.push('expected "in" after destructuring pattern');
        return null;
      }
      this.nextToken();
      const iterable = this.parseExpression(Precedence.LOWEST);
      if (!this.expectPeek(TokenType.RPAREN)) return null;
      if (!this.expectPeek(TokenType.LBRACE)) return null;
      const body = this.parseBlockStatement();
      // Create a for-in with a temp variable, then destructure in body
      const tempVar = '__forin_dest_' + token.literal;
      const destBody = new ast.BlockStatement(token, [
        new ast.DestructuringLet(token, names.map(n => n === '_' ? null : new ast.Identifier(token, n)), new ast.Identifier(token, tempVar)),
        ...body.statements
      ]);
      return new ast.ForInExpression(token, tempVar, iterable, destBody);
    }

    // Standard for (init; condition; update) { body }
    let init;
    if (this.curTokenIs(TokenType.LET)) {
      init = this.parseLetStatement();
    } else {
      init = new ast.ExpressionStatement(this.curToken, this.parseExpression(Precedence.LOWEST));
      if (!this.expectPeek(TokenType.SEMICOLON)) return null;
    }

    // Condition
    this.nextToken();
    const condition = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.SEMICOLON)) return null;

    // Update
    this.nextToken();
    const update = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.RPAREN)) return null;

    // Body
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const body = this.parseBlockStatement();

    return new ast.ForExpression(token, init, condition, update, body);
  }

  parseFunctionLiteral() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.LPAREN)) return null;
    const { params: parameters, defaults, restParam, paramTypes } = this.parseFunctionParameters();
    // Check for return type annotation: -> int
    let returnType = null;
    if (this.peekTokenIs(TokenType.THIN_ARROW)) {
      this.nextToken(); // consume ->
      this.nextToken(); // move to type name
      returnType = this.curToken.literal;
    }
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const body = this.parseBlockStatement();
    const fn = new ast.FunctionLiteral(token, parameters, body);
    fn.defaults = defaults;
    fn.restParam = restParam;
    fn.paramTypes = paramTypes.some(t => t !== null) ? paramTypes : null;
    fn.returnType = returnType;
    return fn;
  }

  parseGeneratorLiteral() {
    const token = this.curToken; // GEN token
    if (!this.expectPeek(TokenType.LPAREN)) return null;
    const { params: parameters } = this.parseFunctionParameters();
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const body = this.parseBlockStatement();
    return new ast.GeneratorLiteral(token, parameters, body);
  }

  parseClassStatement() {
    const token = this.curToken; // CLASS token
    this.nextToken(); // move to class name
    const name = this.curToken.literal;
    
    // Optional: extends SuperClass
    let superClass = null;
    if (this.peekTokenIs(TokenType.EXTENDS)) {
      this.nextToken(); // consume extends
      this.nextToken(); // move to super class name
      superClass = this.curToken.literal;
    }
    
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    
    const methods = [];
    const fields = [];
    
    this.nextToken(); // advance past {
    
    while (!this.curTokenIs(TokenType.RBRACE) && !this.curTokenIs(TokenType.EOF)) {
      if (this.curTokenIs(TokenType.LET)) {
        // Field declaration: let name;
        this.nextToken();
        fields.push(this.curToken.literal);
        if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
        this.nextToken(); // advance past semicolon/field name
      } else if (this.curTokenIs(TokenType.FUNCTION) || (this.curToken.literal === 'static' && this.peekTokenIs(TokenType.FUNCTION))) {
        // Method: fn name(params) { body } or static fn name(params) { body }
        let isStatic = false;
        if (this.curToken.literal === 'static') {
          isStatic = true;
          this.nextToken(); // consume 'static', now at 'fn'
        }
        const fnToken = this.curToken;
        this.nextToken(); // move to method name
        const methodName = this.curToken.literal;
        if (!this.expectPeek(TokenType.LPAREN)) return null;
        const { params: parameters } = this.parseFunctionParameters();
        if (!this.expectPeek(TokenType.LBRACE)) return null;
        const body = this.parseBlockStatement();
        methods.push({ name: methodName, params: parameters, body, token: fnToken, isStatic });
        // After parseBlockStatement, curToken is }, advance past it
        if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
        this.nextToken();
      } else {
        this.nextToken(); // skip unknown tokens
      }
    }
    
    // Wrap in a LetStatement so it binds the class name in the environment
    const classNode = new ast.ClassStatement(token, name, superClass, methods, fields);
    const letToken = new Token(TokenType.LET, 'let', token.line);
    const identifier = new ast.Identifier(letToken, name);
    const letStmt = new ast.LetStatement(letToken, identifier, classNode);
    return letStmt;
  }

  parseYieldExpression() {
    const token = this.curToken; // YIELD token
    this.nextToken();
    const value = this.parseExpression(Precedence.LOWEST);
    return new ast.YieldExpression(token, value);
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
      this.nextToken(); // move to ident
      restParam = new ast.Identifier(this.curToken, this.curToken.literal);
      if (!this.expectPeek(TokenType.RPAREN)) return null;
      return { params, defaults, restParam, paramTypes };
    }
    params.push(new ast.Identifier(this.curToken, this.curToken.literal));
    // Check for type annotation: x: int
    if (this.peekTokenIs(TokenType.COLON)) {
      this.nextToken(); // consume :
      this.nextToken(); // move to type name
      paramTypes.push(this.curToken.literal);
    } else {
      paramTypes.push(null);
    }
    if (this.peekTokenIs(TokenType.ASSIGN)) {
      this.nextToken(); // consume =
      this.nextToken(); // move to default value
      defaults.push(this.parseExpression(Precedence.LOWEST));
    } else {
      defaults.push(null);
    }
    while (this.peekTokenIs(TokenType.COMMA)) {
      this.nextToken();
      this.nextToken();
      if (this.curToken.type === TokenType.SPREAD) {
        this.nextToken(); // move to ident
        restParam = new ast.Identifier(this.curToken, this.curToken.literal);
        break; // rest must be last
      }
      params.push(new ast.Identifier(this.curToken, this.curToken.literal));
      // Check for type annotation
      if (this.peekTokenIs(TokenType.COLON)) {
        this.nextToken(); // consume :
        this.nextToken(); // move to type name
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
    return new ast.CallExpression(token, fn, args);
  }

  parseArrayLiteral() {
    const token = this.curToken;
    
    // Empty array
    if (this.peekTokenIs(TokenType.RBRACKET)) {
      this.nextToken();
      return new ast.ArrayLiteral(token, []);
    }
    
    // Parse first element (could be spread)
    this.nextToken();
    const first = this._parseExprOrSpread();
    
    // Check for comprehension: [expr for ident in iterable]
    // (comprehension can't start with spread)
    if (!(first instanceof ast.SpreadElement) && this.peekToken.type === TokenType.FOR) {
      this.nextToken(); // consume 'for'
      this.nextToken(); // expect ident
      if (this.curToken.type !== TokenType.IDENT) {
        this.errors.push(`expected identifier after 'for' in comprehension, got ${this.curToken.type}`);
        return null;
      }
      const variable = this.curToken.literal;
      
      // expect 'in'
      if (!this.peekToken || this.peekToken.literal !== 'in') {
        this.errors.push(`expected 'in' in comprehension`);
        return null;
      }
      this.nextToken(); // consume 'in'
      this.nextToken(); // start of iterable
      const iterable = this.parseExpression(Precedence.LOWEST);
      
      // Optional 'if' condition
      let condition = null;
      if (this.peekToken.type === TokenType.IF) {
        this.nextToken(); // consume 'if'
        this.nextToken();
        condition = this.parseExpression(Precedence.LOWEST);
      }
      
      if (!this.expectPeek(TokenType.RBRACKET)) return null;
      return new ast.ArrayComprehension(token, first, variable, iterable, condition);
    }
    
    // Normal array — continue parsing elements
    const elements = [first];
    while (this.peekTokenIs(TokenType.COMMA)) {
      this.nextToken(); // comma
      this.nextToken(); // next expr
      elements.push(this._parseExprOrSpread());
    }
    if (!this.expectPeek(TokenType.RBRACKET)) return null;
    return new ast.ArrayLiteral(token, elements);
  }

  parseIndexExpression(left) {
    const token = this.curToken;
    this.nextToken();

    // Check for [:end] pattern
    if (this.curTokenIs(TokenType.COLON)) {
      let end = null;
      if (!this.peekTokenIs(TokenType.RBRACKET)) {
        this.nextToken();
        end = this.parseExpression(Precedence.LOWEST);
      }
      if (!this.expectPeek(TokenType.RBRACKET)) return null;
      return new ast.SliceExpression(token, left, null, end);
    }

    const index = this.parseExpression(Precedence.LOWEST);

    // Check for [start:end] pattern
    if (this.peekTokenIs(TokenType.COLON)) {
      this.nextToken(); // consume :
      let end = null;
      if (!this.peekTokenIs(TokenType.RBRACKET)) {
        this.nextToken();
        end = this.parseExpression(Precedence.LOWEST);
      }
      if (!this.expectPeek(TokenType.RBRACKET)) return null;
      return new ast.SliceExpression(token, left, index, end);
    }

    if (!this.expectPeek(TokenType.RBRACKET)) return null;
    return new ast.IndexExpression(token, left, index);
  }

  parseMatchExpression() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.LPAREN)) return null;
    this.nextToken();
    const subject = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.RPAREN)) return null;
    if (!this.expectPeek(TokenType.LBRACE)) return null;

    const arms = [];
    const TYPE_NAMES = new Set(['int', 'string', 'bool', 'array', 'hash', 'fn', 'null', 'Ok', 'Err']);
    while (!this.peekTokenIs(TokenType.RBRACE) && !this.peekTokenIs(TokenType.EOF)) {
      this.nextToken();
      let pattern = null;
      if (this.curTokenIs(TokenType.IDENT) && this.curToken.literal === '_') {
        pattern = null; // wildcard
      } else if ((this.curTokenIs(TokenType.IDENT) || this.curTokenIs(TokenType.FUNCTION)) && 
                  TYPE_NAMES.has(this.curToken.literal) && this.peekTokenIs(TokenType.LPAREN)) {
        // Type pattern: int(n), string(s), etc.
        const typeName = this.curToken.literal;
        this.nextToken(); // consume (
        this.nextToken(); // move to binding ident
        const binding = new ast.Identifier(this.curToken, this.curToken.literal);
        if (!this.expectPeek(TokenType.RPAREN)) return null;
        pattern = new ast.TypePattern(typeName, binding);
      } else {
        pattern = this.parseExpression(Precedence.LOWEST);
      }
      // Check for or-pattern: pattern1 | pattern2 | pattern3
      if (pattern && this.peekTokenIs(TokenType.BAR)) {
        const patterns = [pattern];
        while (this.peekTokenIs(TokenType.BAR)) {
          this.nextToken(); // consume |
          this.nextToken(); // start of next pattern
          patterns.push(this.parseExpression(Precedence.LOWEST));
        }
        pattern = new ast.OrPattern(patterns);
      }
      // Check for guard: pattern when condition => value
      let guard = null;
      if (this.peekToken.type === TokenType.IDENT && this.peekToken.literal === 'when') {
        this.nextToken(); // consume 'when'
        this.nextToken(); // start of guard expression
        guard = this.parseExpression(Precedence.LOWEST);
      }
      if (!this.expectPeek(TokenType.ARROW)) return null;
      this.nextToken();
      const value = this.parseExpression(Precedence.LOWEST);
      arms.push({ pattern, value, guard });
      if (this.peekTokenIs(TokenType.COMMA)) this.nextToken();
    }
    if (!this.expectPeek(TokenType.RBRACE)) return null;
    return new ast.MatchExpression(token, subject, arms);
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
    return new ast.DoWhileExpression(token, body, condition);
  }

  parseTryExpression() {
    const token = this.curToken; // 'try'
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const tryBlock = this.parseBlockStatement();

    let catchParam = null;
    let catchBlock = null;
    let finallyBlock = null;

    if (this.peekTokenIs(TokenType.CATCH)) {
      this.nextToken(); // consume 'catch'
      if (this.peekTokenIs(TokenType.LPAREN)) {
        this.nextToken(); // consume '('
        if (!this.expectPeek(TokenType.IDENT)) return null;
        catchParam = new ast.Identifier(this.curToken, this.curToken.literal);
        if (!this.expectPeek(TokenType.RPAREN)) return null;
      }
      if (!this.expectPeek(TokenType.LBRACE)) return null;
      catchBlock = this.parseBlockStatement();
    }

    if (this.peekTokenIs(TokenType.FINALLY)) {
      this.nextToken(); // consume 'finally'
      if (!this.expectPeek(TokenType.LBRACE)) return null;
      finallyBlock = this.parseBlockStatement();
    }

    if (!catchBlock && !finallyBlock) {
      this.errors.push('try must have either catch or finally');
      return null;
    }

    return new ast.TryExpression(token, tryBlock, catchParam, catchBlock, finallyBlock);
  }

  parseThrowStatement() {
    const token = this.curToken; // 'throw'
    this.nextToken();
    const value = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ast.ExpressionStatement(token, new ast.ThrowExpression(token, value));
  }

  parsePostfixExpression(left, op) {
    // i++ desugars to i = i + 1, i-- desugars to i = i - 1
    if (!(left instanceof ast.Identifier)) {
      this.errors.push(`cannot use ${op}${op} on ${left.constructor.name}`);
      return null;
    }
    const token = this.curToken;
    const opType = op === '+' ? TokenType.PLUS : TokenType.MINUS;
    const one = new ast.IntegerLiteral(token, 1);
    const binExpr = new ast.InfixExpression(new Token(opType, op), left, op, one);
    return new ast.AssignExpression(token, left, binExpr);
  }

  parseTernaryExpression(condition) {
    const token = this.curToken;
    this.nextToken(); // skip ?
    const consequence = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.COLON)) return null;
    this.nextToken(); // skip :
    const alternative = this.parseExpression(Precedence.LOWEST);
    return new ast.TernaryExpression(token, condition, consequence, alternative);
  }

  parseAssignExpression(left) {
    if (left instanceof ast.IndexExpression) {
      const token = this.curToken;
      this.nextToken();
      const value = this.parseExpression(Precedence.LOWEST);
      return new ast.IndexAssignExpression(token, left.left, left.index, value);
    }
    if (!(left instanceof ast.Identifier)) {
      this.errors.push(`cannot assign to ${left.constructor.name}`);
      return null;
    }
    const token = this.curToken;
    this.nextToken();
    const value = this.parseExpression(Precedence.LOWEST);
    return new ast.AssignExpression(token, left, value);
  }

  parseCompoundAssignExpression(left) {
    const token = this.curToken;
    const opMap = {
      [TokenType.PLUS_ASSIGN]: TokenType.PLUS,
      [TokenType.MINUS_ASSIGN]: TokenType.MINUS,
      [TokenType.ASTERISK_ASSIGN]: TokenType.ASTERISK,
      [TokenType.SLASH_ASSIGN]: TokenType.SLASH,
      [TokenType.PERCENT_ASSIGN]: TokenType.PERCENT,
    };
    const opToken = new Token(opMap[token.type], token.literal[0]);
    this.nextToken();
    const right = this.parseExpression(Precedence.LOWEST);

    if (left instanceof ast.Identifier) {
      const binExpr = new ast.InfixExpression(opToken, left, opToken.literal, right);
      return new ast.AssignExpression(token, left, binExpr);
    }
    if (left instanceof ast.IndexExpression) {
      // arr[i] += val → arr[i] = arr[i] + val
      const readExpr = new ast.IndexExpression(left.token, left.left, left.index);
      const binExpr = new ast.InfixExpression(opToken, readExpr, opToken.literal, right);
      return new ast.IndexAssignExpression(token, left.left, left.index, binExpr);
    }
    this.errors.push(`cannot compound-assign to ${left.constructor.name}`);
    return null;
  }

  parseHashLiteral() {
    const token = this.curToken;
    const pairs = new Map();
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
    return new ast.HashLiteral(token, pairs);
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
      return new ast.SpreadElement(token, this.parseExpression(Precedence.PREFIX));
    }
    return this.parseExpression(Precedence.LOWEST);
  }
}
