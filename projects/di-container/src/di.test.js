import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Container, Lifetime } from './di.js';

// Test classes
class Logger { log(msg) { return msg; } }
class Database { constructor(logger) { this.logger = logger; } query(sql) { return `queried: ${sql}`; } }
class UserService {
  constructor(db, logger) { this.db = db; this.logger = logger; }
  getUser(id) { return this.db.query(`SELECT * FROM users WHERE id = ${id}`); }
}

describe('Basic Registration and Resolution', () => {
  let c;
  beforeEach(() => { c = new Container(); });

  it('registers and resolves class', () => {
    c.register('Logger', Logger);
    const logger = c.resolve('Logger');
    assert.ok(logger instanceof Logger);
  });

  it('resolves with dependencies', () => {
    c.register('Logger', Logger);
    c.register('Database', Database, Lifetime.TRANSIENT, { inject: ['Logger'] });
    const db = c.resolve('Database');
    assert.ok(db.logger instanceof Logger);
  });

  it('resolves deep dependency chain', () => {
    c.register('Logger', Logger);
    c.register('Database', Database, Lifetime.TRANSIENT, { inject: ['Logger'] });
    c.register('UserService', UserService, Lifetime.TRANSIENT, { inject: ['Database', 'Logger'] });
    const svc = c.resolve('UserService');
    assert.ok(svc.db instanceof Database);
    assert.ok(svc.logger instanceof Logger);
  });

  it('throws for unregistered token', () => {
    assert.throws(() => c.resolve('Unknown'));
  });
});

describe('Lifetimes', () => {
  it('transient creates new instance each time', () => {
    const c = new Container();
    c.register('Logger', Logger, Lifetime.TRANSIENT);
    const a = c.resolve('Logger');
    const b = c.resolve('Logger');
    assert.notEqual(a, b);
  });

  it('singleton returns same instance', () => {
    const c = new Container();
    c.register('Logger', Logger, Lifetime.SINGLETON);
    const a = c.resolve('Logger');
    const b = c.resolve('Logger');
    assert.equal(a, b);
  });

  it('scoped returns same instance within scope', () => {
    const c = new Container();
    c.register('Logger', Logger, Lifetime.SCOPED);
    const scope = c.createScope();
    const a = scope.resolve('Logger');
    const b = scope.resolve('Logger');
    assert.equal(a, b);
  });

  it('different scopes get different instances', () => {
    const c = new Container();
    c.register('Logger', Logger, Lifetime.SCOPED);
    const scope1 = c.createScope();
    const scope2 = c.createScope();
    assert.notEqual(scope1.resolve('Logger'), scope2.resolve('Logger'));
  });
});

describe('Factory Functions', () => {
  it('resolves via factory', () => {
    const c = new Container();
    c.registerFactory('Config', () => ({ host: 'localhost', port: 3000 }));
    const config = c.resolve('Config');
    assert.equal(config.host, 'localhost');
  });

  it('factory receives container', () => {
    const c = new Container();
    c.registerValue('port', 8080);
    c.registerFactory('Config', (container) => ({ port: container.resolve('port') }));
    assert.equal(c.resolve('Config').port, 8080);
  });

  it('singleton factory', () => {
    const c = new Container();
    let count = 0;
    c.registerFactory('Counter', () => ({ id: ++count }), Lifetime.SINGLETON);
    assert.equal(c.resolve('Counter').id, 1);
    assert.equal(c.resolve('Counter').id, 1); // same instance
  });
});

describe('Values', () => {
  it('registers and resolves value', () => {
    const c = new Container();
    c.registerValue('apiKey', 'secret123');
    assert.equal(c.resolve('apiKey'), 'secret123');
  });

  it('object value', () => {
    const c = new Container();
    c.registerValue('config', { debug: true });
    assert.equal(c.resolve('config').debug, true);
  });
});

describe('Property Injection', () => {
  it('injects properties', () => {
    const c = new Container();
    c.register('Logger', Logger);
    c.register('Service', class { }, Lifetime.TRANSIENT, { properties: { logger: 'Logger' } });
    const svc = c.resolve('Service');
    assert.ok(svc.logger instanceof Logger);
  });
});

describe('Circular Dependency Detection', () => {
  it('detects circular dependency', () => {
    const c = new Container();
    c.register('A', class { constructor(b) {} }, Lifetime.TRANSIENT, { inject: ['B'] });
    c.register('B', class { constructor(a) {} }, Lifetime.TRANSIENT, { inject: ['A'] });
    assert.throws(() => c.resolve('A'), /Circular/);
  });
});

describe('Tagged Bindings', () => {
  it('resolves by tag', () => {
    const c = new Container();
    class SqlDb { type = 'sql'; }
    class NoSqlDb { type = 'nosql'; }
    c.registerTagged('DB', 'sql', SqlDb);
    c.registerTagged('DB', 'nosql', NoSqlDb);
    assert.equal(c.resolveTagged('DB', 'sql').type, 'sql');
    assert.equal(c.resolveTagged('DB', 'nosql').type, 'nosql');
  });
});

describe('Child Containers', () => {
  it('inherits parent registrations', () => {
    const parent = new Container();
    parent.register('Logger', Logger);
    const child = parent.createScope();
    assert.ok(child.resolve('Logger') instanceof Logger);
  });

  it('child can override parent', () => {
    const parent = new Container();
    parent.registerValue('env', 'production');
    const child = parent.createScope();
    child.registerValue('env', 'test');
    assert.equal(child.resolve('env'), 'test');
    assert.equal(parent.resolve('env'), 'production');
  });
});

describe('Has', () => {
  it('checks registration', () => {
    const c = new Container();
    c.register('Logger', Logger);
    assert.ok(c.has('Logger'));
    assert.ok(!c.has('Unknown'));
  });
});

describe('Dispose', () => {
  it('calls dispose on singletons', () => {
    let disposed = false;
    class Disposable { dispose() { disposed = true; } }
    const c = new Container();
    c.register('D', Disposable, Lifetime.SINGLETON);
    c.resolve('D');
    c.dispose();
    assert.ok(disposed);
  });
});
