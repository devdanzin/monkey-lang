import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { camelCase, pascalCase, snakeCase, kebabCase, constantCase, titleCase, sentenceCase, dotCase } from '../src/index.js';

describe('case', () => {
  it('camelCase', () => assert.equal(camelCase('hello world'), 'helloWorld'));
  it('camelCase from kebab', () => assert.equal(camelCase('foo-bar-baz'), 'fooBarBaz'));
  it('pascalCase', () => assert.equal(pascalCase('hello world'), 'HelloWorld'));
  it('snakeCase', () => assert.equal(snakeCase('helloWorld'), 'hello_world'));
  it('kebabCase', () => assert.equal(kebabCase('HelloWorld'), 'hello-world'));
  it('constantCase', () => assert.equal(constantCase('hello world'), 'HELLO_WORLD'));
  it('titleCase', () => assert.equal(titleCase('hello_world'), 'Hello World'));
  it('sentenceCase', () => assert.equal(sentenceCase('hello_world'), 'Hello world'));
  it('dotCase', () => assert.equal(dotCase('hello world'), 'hello.world'));
});
