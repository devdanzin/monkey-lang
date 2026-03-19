import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer, TokenType } from './lexer.js';

describe('Lexer', () => {
  it('tokenizes basic operators and delimiters', () => {
    const input = '=+(){},;';
    const lexer = new Lexer(input);
    const expected = [
      [TokenType.ASSIGN, '='],
      [TokenType.PLUS, '+'],
      [TokenType.LPAREN, '('],
      [TokenType.RPAREN, ')'],
      [TokenType.LBRACE, '{'],
      [TokenType.RBRACE, '}'],
      [TokenType.COMMA, ','],
      [TokenType.SEMICOLON, ';'],
      [TokenType.EOF, ''],
    ];
    for (const [type, literal] of expected) {
      const tok = lexer.nextToken();
      assert.equal(tok.type, type);
      assert.equal(tok.literal, literal);
    }
  });

  it('tokenizes a complete program', () => {
    const input = `let five = 5;
let ten = 10;

let add = fn(x, y) {
  x + y;
};

let result = add(five, ten);`;

    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();
    
    // Check first line: let five = 5;
    assert.equal(tokens[0].type, TokenType.LET);
    assert.equal(tokens[1].type, TokenType.IDENT);
    assert.equal(tokens[1].literal, 'five');
    assert.equal(tokens[2].type, TokenType.ASSIGN);
    assert.equal(tokens[3].type, TokenType.INT);
    assert.equal(tokens[3].literal, '5');
    assert.equal(tokens[4].type, TokenType.SEMICOLON);
  });

  it('tokenizes two-character operators', () => {
    const input = '10 == 10; 9 != 10;';
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();
    
    assert.equal(tokens[1].type, TokenType.EQ);
    assert.equal(tokens[1].literal, '==');
    assert.equal(tokens[5].type, TokenType.NOT_EQ);
    assert.equal(tokens[5].literal, '!=');
  });

  it('tokenizes strings', () => {
    const input = '"hello world"';
    const lexer = new Lexer(input);
    const tok = lexer.nextToken();
    assert.equal(tok.type, TokenType.STRING);
    assert.equal(tok.literal, 'hello world');
  });

  it('tokenizes all keywords', () => {
    const input = 'fn let true false if else return';
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();
    assert.equal(tokens[0].type, TokenType.FUNCTION);
    assert.equal(tokens[1].type, TokenType.LET);
    assert.equal(tokens[2].type, TokenType.TRUE);
    assert.equal(tokens[3].type, TokenType.FALSE);
    assert.equal(tokens[4].type, TokenType.IF);
    assert.equal(tokens[5].type, TokenType.ELSE);
    assert.equal(tokens[6].type, TokenType.RETURN);
  });
});
