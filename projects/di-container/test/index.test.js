import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Container, Lifecycle, createContainer } from '../src/index.js';

describe('DI — basic registration', () => {
  it('register and resolve factory', () => {
    const c = createContainer();
    c.register('greeting', () => 'hello');
    assert.equal(c.resolve('greeting'), 'hello');
  });

  it('register value', () => {
    const c = createContainer();
    c.registerValue('config', { port: 3000 });
    assert.deepEqual(c.resolve('config'), { port: 3000 });
  });

  it('has() checks registration', () => {
    const c = createContainer();
    c.register('x', () => 1);
    assert.equal(c.has('x'), true);
    assert.equal(c.has('y'), false);
  });

  it('throws on missing', () => {
    const c = createContainer();
    assert.throws(() => c.resolve('missing'), { message: /No registration found/ });
  });

  it('chaining', () => {
    const c = createContainer()
      .register('a', () => 1)
      .register('b', () => 2);
    assert.equal(c.resolve('a'), 1);
    assert.equal(c.resolve('b'), 2);
  });
});

describe('DI — lifecycle: transient', () => {
  it('creates new instance each time', () => {
    const c = createContainer();
    c.register('obj', () => ({ id: Math.random() }));
    const a = c.resolve('obj');
    const b = c.resolve('obj');
    assert.notEqual(a, b);
  });
});

describe('DI — lifecycle: singleton', () => {
  it('returns same instance', () => {
    const c = createContainer();
    c.register('obj', () => ({ id: Math.random() }), { lifecycle: Lifecycle.SINGLETON });
    const a = c.resolve('obj');
    const b = c.resolve('obj');
    assert.equal(a, b);
  });
});

describe('DI — dependency injection', () => {
  it('resolves dependencies', () => {
    const c = createContainer();
    c.registerValue('db', { host: 'localhost' });
    c.register('repo', (db) => ({ db, find: () => 'data' }), { deps: ['db'] });
    
    const repo = c.resolve('repo');
    assert.equal(repo.db.host, 'localhost');
  });

  it('chains dependencies', () => {
    const c = createContainer();
    c.registerValue('config', { dbUrl: 'pg://localhost' });
    c.register('db', (config) => ({ url: config.dbUrl }), { deps: ['config'] });
    c.register('userService', (db) => ({ db, getUser: () => 'user' }), { deps: ['db'] });
    
    const svc = c.resolve('userService');
    assert.equal(svc.db.url, 'pg://localhost');
  });
});

describe('DI — registerClass', () => {
  it('instantiates class with deps', () => {
    class Logger { log(msg) { return msg; } }
    class Service { constructor(logger) { this.logger = logger; } }
    
    const c = createContainer();
    c.registerClass('logger', Logger, { lifecycle: Lifecycle.SINGLETON });
    c.registerClass('service', Service, { deps: ['logger'] });
    
    const svc = c.resolve('service');
    assert.ok(svc instanceof Service);
    assert.ok(svc.logger instanceof Logger);
  });
});

describe('DI — circular dependency detection', () => {
  it('detects direct circular', () => {
    const c = createContainer();
    c.register('a', (b) => ({ b }), { deps: ['b'] });
    c.register('b', (a) => ({ a }), { deps: ['a'] });
    
    assert.throws(() => c.resolve('a'), { message: /Circular dependency/ });
  });

  it('detects indirect circular', () => {
    const c = createContainer();
    c.register('a', (b) => b, { deps: ['b'] });
    c.register('b', (c_) => c_, { deps: ['c'] });
    c.register('c', (a) => a, { deps: ['a'] });
    
    assert.throws(() => c.resolve('a'), { message: /Circular dependency/ });
  });
});

describe('DI — scoped', () => {
  it('scoped returns same instance within scope', () => {
    const c = createContainer();
    c.register('req', () => ({ id: Math.random() }), { lifecycle: Lifecycle.SCOPED });
    
    const scope1 = c.createScope();
    const a = scope1.resolve('req');
    const b = scope1.resolve('req');
    assert.equal(a, b);
  });

  it('different scopes get different instances', () => {
    const c = createContainer();
    c.register('req', () => ({ id: Math.random() }), { lifecycle: Lifecycle.SCOPED });
    
    const scope1 = c.createScope();
    const scope2 = c.createScope();
    const a = scope1.resolve('req');
    const b = scope2.resolve('req');
    assert.notEqual(a, b);
  });
});

describe('DI — resolveAll', () => {
  it('resolves everything', () => {
    const c = createContainer();
    c.registerValue('a', 1);
    c.registerValue('b', 2);
    const all = c.resolveAll();
    assert.equal(all.a, 1);
    assert.equal(all.b, 2);
  });
});
