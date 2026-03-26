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

  it('allows digits in identifiers after first character', () => {
    const input = 'let x1 = a5 + var2b;';
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();
    assert.equal(tokens[1].type, TokenType.IDENT);
    assert.equal(tokens[1].literal, 'x1');
    assert.equal(tokens[3].type, TokenType.IDENT);
    assert.equal(tokens[3].literal, 'a5');
    assert.equal(tokens[5].type, TokenType.IDENT);
    assert.equal(tokens[5].literal, 'var2b');
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

describe('New Tokens', () => {
  it('lexes +=', () => {
    const l = new Lexer('x += 1');
    assert.equal(l.nextToken().type, 'IDENT');
    assert.equal(l.nextToken().type, '+=');
    assert.equal(l.nextToken().type, 'INT');
  });
  it('lexes -=', () => {
    const l = new Lexer('x -= 1');
    l.nextToken();
    assert.equal(l.nextToken().type, '-=');
  });
  it('lexes *=', () => {
    const l = new Lexer('x *= 1');
    l.nextToken();
    assert.equal(l.nextToken().type, '*=');
  });
  it('lexes /=', () => {
    const l = new Lexer('x /= 1');
    l.nextToken();
    assert.equal(l.nextToken().type, '/=');
  });
  it('lexes %=', () => {
    const l = new Lexer('x %= 1');
    l.nextToken();
    assert.equal(l.nextToken().type, '%=');
  });
  it('lexes ++', () => {
    const l = new Lexer('i++');
    l.nextToken();
    assert.equal(l.nextToken().type, '++');
  });
  it('lexes --', () => {
    const l = new Lexer('i--');
    l.nextToken();
    assert.equal(l.nextToken().type, '--');
  });
  it('lexes <=', () => {
    const l = new Lexer('a <= b');
    l.nextToken();
    assert.equal(l.nextToken().type, '<=');
  });
  it('lexes >=', () => {
    const l = new Lexer('a >= b');
    l.nextToken();
    assert.equal(l.nextToken().type, '>=');
  });
  it('lexes &&', () => {
    const l = new Lexer('a && b');
    l.nextToken();
    assert.equal(l.nextToken().type, '&&');
  });
  it('lexes ||', () => {
    const l = new Lexer('a || b');
    l.nextToken();
    assert.equal(l.nextToken().type, '||');
  });
  it('lexes =>', () => {
    const l = new Lexer('x => y');
    l.nextToken();
    assert.equal(l.nextToken().type, '=>');
  });
  it('lexes ?', () => {
    const l = new Lexer('a ? b : c');
    l.nextToken();
    assert.equal(l.nextToken().type, '?');
  });
  it('lexes for keyword', () => {
    const l = new Lexer('for');
    assert.equal(l.nextToken().type, 'FOR');
  });
  it('lexes break keyword', () => {
    const l = new Lexer('break');
    assert.equal(l.nextToken().type, 'BREAK');
  });
  it('lexes continue keyword', () => {
    const l = new Lexer('continue');
    assert.equal(l.nextToken().type, 'CONTINUE');
  });
  it('lexes null keyword', () => {
    const l = new Lexer('null');
    assert.equal(l.nextToken().type, 'NULL_LIT');
  });
  it('lexes match keyword', () => {
    const l = new Lexer('match');
    assert.equal(l.nextToken().type, 'MATCH');
  });
  it('lexes do keyword', () => {
    const l = new Lexer('do');
    assert.equal(l.nextToken().type, 'DO');
  });
  it('lexes template string', () => {
    const l = new Lexer('`hello ${x}`');
    const tok = l.nextToken();
    assert.equal(tok.type, 'TEMPLATE_STRING');
  });
  it('lexes escape sequences in strings', () => {
    const l = new Lexer('"hello\\nworld"');
    const tok = l.nextToken();
    assert.equal(tok.literal, 'hello\nworld');
  });
  it('skips multi-line comments', () => {
    const l = new Lexer('/* comment */ 42');
    const tok = l.nextToken();
    assert.equal(tok.type, 'INT');
    assert.equal(tok.literal, '42');
  });
});

describe('Lexer Edge Cases', () => {
  it('handles empty input', () => {
    const l = new Lexer('');
    assert.equal(l.nextToken().type, 'EOF');
  });
  it('handles whitespace only', () => {
    const l = new Lexer('   \n\t  ');
    assert.equal(l.nextToken().type, 'EOF');
  });
  it('handles consecutive operators', () => {
    const l = new Lexer('+-*/');
    assert.equal(l.nextToken().type, '+');
    assert.equal(l.nextToken().type, '-');
    assert.equal(l.nextToken().type, '*');
    assert.equal(l.nextToken().type, '/');
  });
  it('handles string with escaped quote', () => {
    const l = new Lexer('"say \\"hello\\""');
    const tok = l.nextToken();
    assert.equal(tok.literal, 'say "hello"');
  });
  it('handles colon for hash', () => {
    const l = new Lexer('{"a": 1}');
    l.nextToken(); // {
    l.nextToken(); // "a"
    assert.equal(l.nextToken().type, ':');
  });
  it('handles mixed comments', () => {
    const l = new Lexer('1 /* block */ + // line\n 2');
    assert.equal(l.nextToken().type, 'INT');
    assert.equal(l.nextToken().type, '+');
    assert.equal(l.nextToken().type, 'INT');
  });
});
