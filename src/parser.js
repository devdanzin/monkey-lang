// Monkey Language Parser — Pratt (Top-Down Operator Precedence)

import { TokenType } from './lexer.js';
import * as ast from './ast.js';

const Precedence = {
  LOWEST: 1,
  TERNARY: 2,      // ?:
  LOGICAL_OR: 3,   // ||
  LOGICAL_AND: 4,  // &&
  EQUALS: 4,       // ==
  LESSGREATER: 5,   // > or <
  SUM: 6,          // +
  PRODUCT: 7,      // *
  PREFIX: 8,       // -X or !X
  CALL: 9,         // myFunction(X)
  INDEX: 10,       // array[index]
};

const TOKEN_PRECEDENCE = {
  [TokenType.QUESTION]: Precedence.TERNARY,
  [TokenType.OR]: Precedence.LOGICAL_OR,
  [TokenType.AND]: Precedence.LOGICAL_AND,
  [TokenType.EQ]: Precedence.EQUALS,
  [TokenType.NOT_EQ]: Precedence.EQUALS,
  [TokenType.LT]: Precedence.LESSGREATER,
  [TokenType.GT]: Precedence.LESSGREATER,
  [TokenType.LTE]: Precedence.LESSGREATER,
  [TokenType.GTE]: Precedence.LESSGREATER,
  [TokenType.PLUS]: Precedence.SUM,
  [TokenType.MINUS]: Precedence.SUM,
  [TokenType.SLASH]: Precedence.PRODUCT,
  [TokenType.PERCENT]: Precedence.PRODUCT,
  [TokenType.ASTERISK]: Precedence.PRODUCT,
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
    this.registerPrefix(TokenType.STRING, () => this.parseStringLiteral());
    this.registerPrefix(TokenType.TRUE, () => this.parseBooleanLiteral());
    this.registerPrefix(TokenType.FALSE, () => this.parseBooleanLiteral());
    this.registerPrefix(TokenType.BANG, () => this.parsePrefixExpression());
    this.registerPrefix(TokenType.MINUS, () => this.parsePrefixExpression());
    this.registerPrefix(TokenType.LPAREN, () => this.parseGroupedExpression());
    this.registerPrefix(TokenType.IF, () => this.parseIfExpression());
    this.registerPrefix(TokenType.WHILE, () => this.parseWhileExpression());
    this.registerPrefix(TokenType.DO, () => this.parseDoWhileExpression());
    this.registerPrefix(TokenType.BREAK, () => new ast.BreakStatement(this.curToken));
    this.registerPrefix(TokenType.CONTINUE, () => new ast.ContinueStatement(this.curToken));
    this.registerPrefix(TokenType.SWITCH, () => this.parseSwitchExpression());
    this.registerPrefix(TokenType.FOR, () => this.parseForExpression());
    this.registerPrefix(TokenType.FUNCTION, () => this.parseFunctionLiteral());
    this.registerPrefix(TokenType.LBRACKET, () => this.parseArrayLiteral());
    this.registerPrefix(TokenType.LBRACE, () => this.parseHashLiteral());

    // Register infix parsers
    for (const op of [TokenType.PLUS, TokenType.MINUS, TokenType.SLASH, TokenType.PERCENT,
      TokenType.ASTERISK, TokenType.EQ, TokenType.NOT_EQ,
      TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE,
      TokenType.AND, TokenType.OR]) {
      this.registerInfix(op, (left) => this.parseInfixExpression(left));
    }
    
    // Ternary operator
    this.registerInfix(TokenType.QUESTION, (condition) => {
      const token = this.curToken;
      this.nextToken();
      const consequence = this.parseExpression(Precedence.TERNARY);
      if (!this.expectPeek(TokenType.COLON)) return null;
      this.nextToken();
      const alternative = this.parseExpression(Precedence.TERNARY);
      return new ast.TernaryExpression(token, condition, consequence, alternative);
    });
    this.registerInfix(TokenType.LPAREN, (left) => this.parseCallExpression(left));
    this.registerInfix(TokenType.LBRACKET, (left) => this.parseIndexExpression(left));

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
      case TokenType.SET: return this.parseSetStatement();
      case TokenType.RETURN: return this.parseReturnStatement();
      default: return this.parseExpressionStatement();
    }
  }

  parseLetStatement() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.IDENT)) return null;
    const name = new ast.Identifier(this.curToken, this.curToken.literal);
    if (!this.expectPeek(TokenType.ASSIGN)) return null;
    this.nextToken();
    const value = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ast.LetStatement(token, name, value);
  }

  parseSetStatement() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.IDENT)) return null;
    const name = new ast.Identifier(this.curToken, this.curToken.literal);
    if (!this.expectPeek(TokenType.ASSIGN)) return null;
    this.nextToken();
    const value = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ast.SetStatement(token, name, value);
  }

  parseReturnStatement() {
    const token = this.curToken;
    this.nextToken();
    const returnValue = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ast.ReturnStatement(token, returnValue);
  }

  parseExpressionStatement() {
    const token = this.curToken;
    const expression = this.parseExpression(Precedence.LOWEST);
    if (this.peekTokenIs(TokenType.SEMICOLON)) this.nextToken();
    return new ast.ExpressionStatement(token, expression);
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

  parseStringLiteral() {
    return new ast.StringLiteral(this.curToken, this.curToken.literal);
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

  parseGroupedExpression() {
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
      if (!this.expectPeek(TokenType.LBRACE)) return null;
      alternative = this.parseBlockStatement();
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

  parseSwitchExpression() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.LPAREN)) return null;
    this.nextToken();
    const value = this.parseExpression(Precedence.LOWEST);
    if (!this.expectPeek(TokenType.RPAREN)) return null;
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    
    const cases = [];
    let defaultCase = null;
    
    while (!this.peekTokenIs(TokenType.RBRACE)) {
      this.nextToken();
      if (this.curTokenIs(TokenType.CASE)) {
        this.nextToken();
        const caseValue = this.parseExpression(Precedence.LOWEST);
        if (!this.expectPeek(TokenType.COLON)) return null;
        if (!this.expectPeek(TokenType.LBRACE)) return null;
        const body = this.parseBlockStatement();
        cases.push({ value: caseValue, body });
      } else if (this.curTokenIs(TokenType.DEFAULT)) {
        if (!this.expectPeek(TokenType.COLON)) return null;
        if (!this.expectPeek(TokenType.LBRACE)) return null;
        defaultCase = this.parseBlockStatement();
      }
    }
    
    if (!this.expectPeek(TokenType.RBRACE)) return null;
    return new ast.SwitchExpression(token, value, cases, defaultCase);
  }

  parseForExpression() {
    const token = this.curToken;
    if (!this.expectPeek(TokenType.LPAREN)) return null;

    // Parse init: let x = 0 or set x = 0
    this.nextToken();
    let init;
    if (this.curTokenIs(TokenType.LET)) {
      init = this.parseLetStatement();
    } else if (this.curTokenIs(TokenType.SET)) {
      init = this.parseSetStatement();
    } else {
      this.errors.push(`expected LET or SET in for init, got ${this.curToken.type}`);
      return null;
    }

    // Parse condition
    this.nextToken();
    const condition = this.parseExpression(Precedence.LOWEST);

    // Expect semicolon after condition
    if (!this.expectPeek(TokenType.SEMICOLON)) return null;

    // Parse update: set x = x + 1
    this.nextToken();
    let update;
    if (this.curTokenIs(TokenType.SET)) {
      update = this.parseSetStatement();
    } else {
      this.errors.push(`expected SET in for update, got ${this.curToken.type}`);
      return null;
    }

    if (!this.expectPeek(TokenType.RPAREN)) return null;
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const body = this.parseBlockStatement();
    return new ast.ForExpression(token, init, condition, update, body);
  }

  parseFunctionLiteral() {    const token = this.curToken;
    if (!this.expectPeek(TokenType.LPAREN)) return null;
    const parameters = this.parseFunctionParameters();
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const body = this.parseBlockStatement();
    return new ast.FunctionLiteral(token, parameters, body);
  }

  parseFunctionParameters() {
    const params = [];
    if (this.peekTokenIs(TokenType.RPAREN)) {
      this.nextToken();
      return params;
    }
    this.nextToken();
    params.push(new ast.Identifier(this.curToken, this.curToken.literal));
    while (this.peekTokenIs(TokenType.COMMA)) {
      this.nextToken();
      this.nextToken();
      params.push(new ast.Identifier(this.curToken, this.curToken.literal));
    }
    if (!this.expectPeek(TokenType.RPAREN)) return null;
    return params;
  }

  parseCallExpression(fn) {
    const token = this.curToken;
    const args = this.parseExpressionList(TokenType.RPAREN);
    return new ast.CallExpression(token, fn, args);
  }

  parseArrayLiteral() {
    const token = this.curToken;
    const elements = this.parseExpressionList(TokenType.RBRACKET);
    return new ast.ArrayLiteral(token, elements);
  }

  parseIndexExpression(left) {
    const token = this.curToken;
    this.nextToken();
    
    // Check for slice: arr[:end], arr[start:end], arr[start:], arr[:]
    if (this.curTokenIs(TokenType.COLON)) {
      // arr[:end] or arr[:]
      this.nextToken();
      if (this.curTokenIs(TokenType.RBRACKET)) {
        // arr[:] — full slice
        return new ast.SliceExpression(token, left, null, null);
      }
      const end = this.parseExpression(Precedence.LOWEST);
      if (!this.expectPeek(TokenType.RBRACKET)) return null;
      return new ast.SliceExpression(token, left, null, end);
    }
    
    const index = this.parseExpression(Precedence.LOWEST);
    
    // Check for slice: arr[start:end] or arr[start:]
    if (this.peekTokenIs(TokenType.COLON)) {
      this.nextToken(); // consume :
      this.nextToken();
      if (this.curTokenIs(TokenType.RBRACKET)) {
        // arr[start:]
        return new ast.SliceExpression(token, left, index, null);
      }
      const end = this.parseExpression(Precedence.LOWEST);
      if (!this.expectPeek(TokenType.RBRACKET)) return null;
      return new ast.SliceExpression(token, left, index, end);
    }
    
    if (!this.expectPeek(TokenType.RBRACKET)) return null;
    return new ast.IndexExpression(token, left, index);
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
    list.push(this.parseExpression(Precedence.LOWEST));
    while (this.peekTokenIs(TokenType.COMMA)) {
      this.nextToken();
      this.nextToken();
      list.push(this.parseExpression(Precedence.LOWEST));
    }
    if (!this.expectPeek(end)) return null;
    return list;
  }
}
