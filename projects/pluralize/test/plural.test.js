import { describe, it } from 'node:test'; import assert from 'node:assert/strict';
import { pluralize, singularize } from '../src/index.js';
describe('pluralize', () => {
  it('regular', () => assert.equal(pluralize('cat'), 'cats'));
  it('es', () => assert.equal(pluralize('box'), 'boxes'));
  it('y→ies', () => assert.equal(pluralize('city'), 'cities'));
  it('irregular', () => assert.equal(pluralize('child'), 'children'));
  it('count 1', () => assert.equal(pluralize('cat', 1), 'cat'));
  it('uncountable', () => assert.equal(pluralize('sheep'), 'sheep'));
});
describe('singularize', () => {
  it('cats→cat', () => assert.equal(singularize('cats'), 'cat'));
  it('cities→city', () => assert.equal(singularize('cities'), 'city'));
  it('children→child', () => assert.equal(singularize('children'), 'child'));
});
