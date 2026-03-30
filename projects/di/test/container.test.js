import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Container, inject } from '../src/index.js';

describe('Basic registration', () => {
  it('register and resolve factory', () => {
    const c = new Container();
    c.register('greeting', () => 'hello');
    assert.equal(c.resolve('greeting'), 'hello');
  });

  it('register constant value', () => {
    const c = new Container();
    c.value('port', 3000);
    assert.equal(c.resolve('port'), 3000);
  });

  it('throws for missing binding', () => {
    const c = new Container();
    assert.throws(() => c.resolve('nope'));
  });

  it('has()', () => {
    const c = new Container();
    c.value('x', 1);
    assert.equal(c.has('x'), true);
    assert.equal(c.has('y'), false);
  });
});

describe('Singletons', () => {
  it('singleton returns same instance', () => {
    const c = new Container();
    c.register('obj', () => ({ id: Math.random() }), { singleton: true });
    const a = c.resolve('obj');
    const b = c.resolve('obj');
    assert.equal(a, b);
  });

  it('non-singleton returns new instances', () => {
    const c = new Container();
    c.register('obj', () => ({ id: Math.random() }));
    const a = c.resolve('obj');
    const b = c.resolve('obj');
    assert.notEqual(a, b);
  });
});

describe('Class registration', () => {
  it('auto-resolves class', () => {
    class UserService { constructor() { this.name = 'UserService'; } }
    const c = new Container();
    c.class('userService', UserService);
    const svc = c.resolve('userService');
    assert.equal(svc.name, 'UserService');
    assert.ok(svc instanceof UserService);
  });

  it('auto-injects dependencies', () => {
    class DB { constructor() { this.type = 'db'; } }
    class UserService {
      static _inject = ['db'];
      constructor(db) { this.db = db; }
    }

    const c = new Container();
    c.class('db', DB, { singleton: true });
    c.class('userService', UserService);
    const svc = c.resolve('userService');
    assert.equal(svc.db.type, 'db');
  });
});

describe('Child containers', () => {
  it('child inherits parent bindings', () => {
    const parent = new Container();
    parent.value('x', 42);
    const child = parent.createChild();
    assert.equal(child.resolve('x'), 42);
  });

  it('child can override', () => {
    const parent = new Container();
    parent.value('x', 42);
    const child = parent.createChild();
    child.value('x', 99);
    assert.equal(child.resolve('x'), 99);
    assert.equal(parent.resolve('x'), 42);
  });
});

describe('Tags', () => {
  it('resolveTagged', () => {
    const c = new Container();
    c.register('a', () => 'a', { tags: ['plugin'] });
    c.register('b', () => 'b', { tags: ['plugin'] });
    c.register('c', () => 'c', { tags: ['other'] });
    const plugins = c.resolveTagged('plugin');
    assert.deepEqual(plugins.sort(), ['a', 'b']);
  });
});

describe('Decorators', () => {
  it('wraps resolved instance', () => {
    const c = new Container();
    c.register('logger', () => ({ log: msg => msg }));
    c.decorate('logger', (logger) => ({
      ...logger,
      log: msg => `[PREFIX] ${logger.log(msg)}`
    }));
    assert.equal(c.resolve('logger').log('hello'), '[PREFIX] hello');
  });
});

describe('Scopes', () => {
  it('scope gets fresh singletons', () => {
    const c = new Container();
    c.register('session', () => ({ id: Math.random() }), { singleton: true });
    const s1 = c.resolve('session');
    const scope = c.createScope();
    const s2 = scope.resolve('session');
    assert.notEqual(s1.id, s2.id);
  });
});

describe('Utility', () => {
  it('names()', () => {
    const c = new Container();
    c.value('a', 1);
    c.value('b', 2);
    assert.deepEqual(c.names().sort(), ['a', 'b']);
  });

  it('remove()', () => {
    const c = new Container();
    c.value('x', 1);
    c.remove('x');
    assert.equal(c.has('x'), false);
  });

  it('clear()', () => {
    const c = new Container();
    c.value('a', 1).value('b', 2);
    c.clear();
    assert.deepEqual(c.names(), []);
  });
});
