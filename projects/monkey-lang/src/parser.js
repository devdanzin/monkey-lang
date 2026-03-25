// Monkey Language Parser — Pratt (Top-Down Operator Precedence)

import { TokenType, Token, Lexer } from './lexer.js';
import * as ast from './ast.js';

const Precedence = {
  LOWEST: 1,
  ASSIGN: 2,      // =
  OR: 3,           // ||
  AND: 4,          // &&
  EQUALS: 5,       // ==
  LESSGREATER: 6,  // > or <
  SUM: 7,          // +
  PRODUCT: 8,      // *
  PREFIX: 9,       // -X or !X
  CALL: 10,        // myFunction(X)
  INDEX: 11,       // array[index]
};

const TOKEN_PRECEDENCE = {
  [TokenType.ASSIGN]: Precedence.ASSIGN,
  [TokenType.PLUS_ASSIGN]: Precedence.ASSIGN,
  [TokenType.MINUS_ASSIGN]: Precedence.ASSIGN,
  [TokenType.ASTERISK_ASSIGN]: Precedence.ASSIGN,
  [TokenType.SLASH_ASSIGN]: Precedence.ASSIGN,
  [TokenType.PERCENT_ASSIGN]: Precedence.ASSIGN,
  [TokenType.QUESTION]: Precedence.OR,
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
    this.registerPrefix(TokenType.BREAK, () => new ast.BreakStatement(this.curToken));
    this.registerPrefix(TokenType.CONTINUE, () => new ast.ContinueStatement(this.curToken));
    this.registerPrefix(TokenType.NULL_LIT, () => new ast.NullLiteral(this.curToken));
    this.registerPrefix(TokenType.MATCH, () => this.parseMatchExpression());
    this.registerPrefix(TokenType.DO, () => this.parseDoWhileExpression());

    // Register infix parsers
    for (const op of [TokenType.PLUS, TokenType.MINUS, TokenType.SLASH,
      TokenType.ASTERISK, TokenType.PERCENT, TokenType.EQ, TokenType.NOT_EQ,
      TokenType.LT, TokenType.GT, TokenType.LT_EQ, TokenType.GT_EQ,
      TokenType.AND, TokenType.OR]) {
      this.registerInfix(op, (left) => this.parseInfixExpression(left));
    }
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
      case TokenType.RETURN: return this.parseReturnStatement();
      default: return this.parseExpressionStatement();
    }
  }

  parseLetStatement() {
    const token = this.curToken;

    // Check for destructuring: let [a, b] = ...
    if (this.peekTokenIs(TokenType.LBRACKET)) {
      return this.parseDestructuringLet(token);
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
    const { params: parameters, defaults } = this.parseFunctionParameters();
    if (!this.expectPeek(TokenType.LBRACE)) return null;
    const body = this.parseBlockStatement();
    const fn = new ast.FunctionLiteral(token, parameters, body);
    fn.defaults = defaults;
    return fn;
  }

  parseFunctionParameters() {
    const params = [];
    const defaults = [];
    if (this.peekTokenIs(TokenType.RPAREN)) {
      this.nextToken();
      return { params, defaults };
    }
    this.nextToken();
    params.push(new ast.Identifier(this.curToken, this.curToken.literal));
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
      params.push(new ast.Identifier(this.curToken, this.curToken.literal));
      if (this.peekTokenIs(TokenType.ASSIGN)) {
        this.nextToken();
        this.nextToken();
        defaults.push(this.parseExpression(Precedence.LOWEST));
      } else {
        defaults.push(null);
      }
    }
    if (!this.expectPeek(TokenType.RPAREN)) return null;
    return { params, defaults };
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
    while (!this.peekTokenIs(TokenType.RBRACE) && !this.peekTokenIs(TokenType.EOF)) {
      this.nextToken();
      let pattern = null;
      if (this.curTokenIs(TokenType.IDENT) && this.curToken.literal === '_') {
        pattern = null; // wildcard
      } else {
        pattern = this.parseExpression(Precedence.LOWEST);
      }
      if (!this.expectPeek(TokenType.ARROW)) return null;
      this.nextToken();
      const value = this.parseExpression(Precedence.LOWEST);
      arms.push({ pattern, value });
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
