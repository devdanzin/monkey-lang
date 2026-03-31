import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { isEmail, isURL, isIPv4, isUUID, isHex, isAlpha, isNumeric, isEmpty, isJSON, isCreditCard, isSlug } from '../src/index.js';
describe('validators', () => {
  it('email valid', () => assert.ok(isEmail('test@example.com')));
  it('email invalid', () => assert.ok(!isEmail('not-email')));
  it('URL valid', () => assert.ok(isURL('https://example.com/path')));
  it('URL invalid', () => assert.ok(!isURL('not a url')));
  it('IPv4 valid', () => assert.ok(isIPv4('192.168.1.1')));
  it('IPv4 invalid', () => assert.ok(!isIPv4('999.999.999.999')));
  it('UUID', () => assert.ok(isUUID('550e8400-e29b-41d4-a716-446655440000')));
  it('hex', () => assert.ok(isHex('0xFF'))); it('hex no', () => assert.ok(!isHex('xyz')));
  it('alpha', () => assert.ok(isAlpha('abc'))); it('alpha no', () => assert.ok(!isAlpha('123')));
  it('numeric', () => assert.ok(isNumeric('3.14'))); it('numeric no', () => assert.ok(!isNumeric('abc')));
  it('empty', () => assert.ok(isEmpty('  '))); it('not empty', () => assert.ok(!isEmpty('hi')));
  it('JSON valid', () => assert.ok(isJSON('{"a":1}'))); it('JSON invalid', () => assert.ok(!isJSON('{bad')));
  it('credit card (Luhn)', () => assert.ok(isCreditCard('4111111111111111')));
  it('credit card invalid', () => assert.ok(!isCreditCard('1234567890')));
  it('slug', () => assert.ok(isSlug('hello-world'))); it('slug invalid', () => assert.ok(!isSlug('Hello World')));
});
