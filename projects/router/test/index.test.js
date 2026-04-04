import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Router, NestedRouter } from '../src/index.js';

describe('Router — basic', () => {
  it('matches static path', () => {
    const r = new Router();
    r.get('/hello', () => 'hi');
    assert.equal(r.resolve('GET', '/hello'), 'hi');
  });

  it('no match returns null', () => {
    const r = new Router();
    r.get('/a', () => {});
    assert.equal(r.match('GET', '/b'), null);
  });

  it('path params', () => {
    const r = new Router();
    r.get('/users/:id', (p) => p.id);
    assert.equal(r.resolve('GET', '/users/42'), '42');
  });

  it('multiple params', () => {
    const r = new Router();
    r.get('/users/:uid/posts/:pid', (p) => `${p.uid}:${p.pid}`);
    assert.equal(r.resolve('GET', '/users/1/posts/2'), '1:2');
  });

  it('wildcard', () => {
    const r = new Router();
    r.get('/files/*', () => 'found');
    assert.equal(r.resolve('GET', '/files/a/b/c'), 'found');
  });

  it('method matching', () => {
    const r = new Router();
    r.get('/x', () => 'get');
    r.post('/x', () => 'post');
    assert.equal(r.resolve('GET', '/x'), 'get');
    assert.equal(r.resolve('POST', '/x'), 'post');
  });

  it('routes list', () => {
    const r = new Router();
    r.get('/a', () => {}); r.post('/b', () => {});
    assert.equal(r.routes.length, 2);
  });
});

describe('NestedRouter', () => {
  it('mounts sub-router', () => {
    const main = new NestedRouter();
    const api = new Router();
    api.get('/users', () => 'users');
    main.mount('/api', api);
    assert.equal(main.resolve('GET', '/api/users'), 'users');
  });

  it('own routes take priority', () => {
    const main = new NestedRouter();
    main.get('/api/special', () => 'special');
    const api = new Router();
    api.get('/special', () => 'from child');
    main.mount('/api', api);
    assert.equal(main.resolve('GET', '/api/special'), 'special');
  });
});
