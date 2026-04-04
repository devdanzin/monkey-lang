import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventStore, AggregateRoot, Projection, CommandHandler, EventBus, BankAccount } from './eventsource.js';

describe('EventStore', () => {
  let store;
  beforeEach(() => { store = new EventStore(); });

  it('appends events', () => {
    store.append('stream1', [{ type: 'Created' }]);
    assert.equal(store.eventCount, 1);
  });

  it('retrieves stream', () => {
    store.append('s1', [{ type: 'A' }, { type: 'B' }]);
    const events = store.getStream('s1');
    assert.equal(events.length, 2);
    assert.equal(events[0].version, 0);
    assert.equal(events[1].version, 1);
  });

  it('assigns global positions', () => {
    store.append('s1', [{ type: 'A' }]);
    store.append('s2', [{ type: 'B' }]);
    assert.equal(store.events[0].globalPosition, 0);
    assert.equal(store.events[1].globalPosition, 1);
  });

  it('optimistic concurrency check passes', () => {
    store.append('s1', [{ type: 'A' }]);
    store.append('s1', [{ type: 'B' }], 1); // expects version 1
    assert.equal(store.getStream('s1').length, 2);
  });

  it('optimistic concurrency check fails', () => {
    store.append('s1', [{ type: 'A' }]);
    assert.throws(() => store.append('s1', [{ type: 'B' }], 0));
  });

  it('subscribes to events', () => {
    const received = [];
    store.subscribe(e => received.push(e));
    store.append('s1', [{ type: 'Test' }]);
    assert.equal(received.length, 1);
    assert.equal(received[0].type, 'Test');
  });

  it('unsubscribes', () => {
    const received = [];
    const unsub = store.subscribe(e => received.push(e));
    unsub();
    store.append('s1', [{ type: 'Test' }]);
    assert.equal(received.length, 0);
  });

  it('snapshots', () => {
    store.saveSnapshot('s1', { balance: 100 }, 5);
    const snap = store.getSnapshot('s1');
    assert.equal(snap.state.balance, 100);
    assert.equal(snap.version, 5);
  });

  it('tracks stream count', () => {
    store.append('s1', [{ type: 'A' }]);
    store.append('s2', [{ type: 'B' }]);
    assert.equal(store.streamCount, 2);
  });

  it('getStream with fromVersion', () => {
    store.append('s1', [{ type: 'A' }, { type: 'B' }, { type: 'C' }]);
    const events = store.getStream('s1', 1);
    assert.equal(events.length, 2);
    assert.equal(events[0].type, 'B');
  });
});

describe('BankAccount Aggregate', () => {
  it('opens account', () => {
    const account = new BankAccount('acc1');
    account.open('Alice', 100);
    assert.ok(account.isOpen);
    assert.equal(account.balance, 100);
    assert.equal(account.owner, 'Alice');
  });

  it('deposits money', () => {
    const account = new BankAccount('acc1');
    account.open('Alice');
    account.deposit(50);
    assert.equal(account.balance, 50);
  });

  it('withdraws money', () => {
    const account = new BankAccount('acc1');
    account.open('Alice', 100);
    account.withdraw(30);
    assert.equal(account.balance, 70);
  });

  it('rejects overdraft', () => {
    const account = new BankAccount('acc1');
    account.open('Alice', 50);
    assert.throws(() => account.withdraw(100));
  });

  it('tracks transactions', () => {
    const account = new BankAccount('acc1');
    account.open('Alice', 100);
    account.deposit(50);
    account.withdraw(30);
    assert.equal(account.transactions.length, 3);
  });

  it('closes account', () => {
    const account = new BankAccount('acc1');
    account.open('Alice');
    account.close();
    assert.ok(!account.isOpen);
  });

  it('rejects close with balance', () => {
    const account = new BankAccount('acc1');
    account.open('Alice', 100);
    assert.throws(() => account.close());
  });

  it('loads from history', () => {
    const account = new BankAccount('acc1');
    account.loadFromHistory([
      { type: 'AccountOpened', owner: 'Bob' },
      { type: 'MoneyDeposited', amount: 200 },
      { type: 'MoneyWithdrawn', amount: 50 },
    ]);
    assert.equal(account.balance, 150);
    assert.equal(account.owner, 'Bob');
    assert.equal(account.version, 3);
  });

  it('uncommitted events', () => {
    const account = new BankAccount('acc1');
    account.open('Alice', 100);
    const events = account.getUncommittedEvents();
    assert.ok(events.length >= 2); // AccountOpened + MoneyDeposited
    assert.equal(account.getUncommittedEvents().length, 0); // cleared
  });
});

describe('Projection', () => {
  it('materializes view from events', () => {
    const store = new EventStore();
    const proj = new Projection('balances');
    proj.when('AccountOpened', (state, e) => ({ ...state, [e.streamId]: 0 }));
    proj.when('MoneyDeposited', (state, e) => ({ ...state, [e.streamId]: (state[e.streamId] || 0) + e.amount }));

    store.append('acc1', [{ type: 'AccountOpened', owner: 'Alice' }]);
    store.append('acc1', [{ type: 'MoneyDeposited', amount: 100 }]);
    store.append('acc2', [{ type: 'AccountOpened', owner: 'Bob' }]);
    store.append('acc2', [{ type: 'MoneyDeposited', amount: 50 }]);

    proj.rebuild(store);
    assert.equal(proj.state.acc1, 100);
    assert.equal(proj.state.acc2, 50);
  });

  it('catches up incrementally', () => {
    const store = new EventStore();
    const proj = new Projection('count');
    proj.when('Created', (state) => ({ count: (state.count || 0) + 1 }));

    store.append('s1', [{ type: 'Created' }]);
    proj.rebuild(store);
    assert.equal(proj.state.count, 1);

    store.append('s2', [{ type: 'Created' }]);
    proj.catchUp(store);
    assert.equal(proj.state.count, 2);
  });
});

describe('CommandHandler', () => {
  it('processes commands', () => {
    const store = new EventStore();
    const handler = new CommandHandler(store);
    handler.register('OpenAccount', (cmd, store) => {
      const account = new BankAccount(cmd.accountId);
      account.open(cmd.owner, cmd.initialDeposit);
      store.append(cmd.accountId, account.getUncommittedEvents());
      return { success: true };
    });

    const result = handler.execute({ type: 'OpenAccount', accountId: 'acc1', owner: 'Alice', initialDeposit: 100 });
    assert.ok(result.success);
    assert.ok(store.getStream('acc1').length >= 2);
  });

  it('rejects unknown command', () => {
    const handler = new CommandHandler(new EventStore());
    assert.throws(() => handler.execute({ type: 'Unknown' }));
  });
});

describe('EventBus', () => {
  it('emits events to handlers', () => {
    const bus = new EventBus();
    const received = [];
    bus.on('UserCreated', (e) => received.push(e));
    bus.emit({ type: 'UserCreated', name: 'Alice' });
    assert.equal(received.length, 1);
  });

  it('wildcard handler receives all', () => {
    const bus = new EventBus();
    const all = [];
    bus.on('*', (e) => all.push(e));
    bus.emit({ type: 'A' });
    bus.emit({ type: 'B' });
    assert.equal(all.length, 2);
  });

  it('off removes handler', () => {
    const bus = new EventBus();
    const handler = () => { throw new Error('should not run'); };
    bus.on('Test', handler);
    bus.off('Test', handler);
    bus.emit({ type: 'Test' }); // should not throw
  });
});
