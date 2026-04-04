import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventStore, Aggregate, CommandBus, Projection, Repository } from '../src/index.js';

// ===== Test aggregate: BankAccount =====
class BankAccount extends Aggregate {
  constructor(id) {
    super(id);
    this.balance = 0;
    this.owner = null;
  }

  open(owner, initialBalance = 0) {
    this.raise({ type: 'AccountOpened', owner, initialBalance });
  }

  deposit(amount) {
    if (amount <= 0) throw new Error('Amount must be positive');
    this.raise({ type: 'MoneyDeposited', amount });
  }

  withdraw(amount) {
    if (amount > this.balance) throw new Error('Insufficient funds');
    this.raise({ type: 'MoneyWithdrawn', amount });
  }

  onAccountOpened(event) {
    this.owner = event.owner;
    this.balance = event.initialBalance;
  }

  onMoneyDeposited(event) {
    this.balance += event.amount;
  }

  onMoneyWithdrawn(event) {
    this.balance -= event.amount;
  }
}

describe('EventStore', () => {
  it('appends and retrieves events', () => {
    const store = new EventStore();
    store.append('acc-1', [{ type: 'Opened' }, { type: 'Deposited' }]);
    assert.equal(store.getStream('acc-1').length, 2);
  });

  it('tracks global ordering', () => {
    const store = new EventStore();
    store.append('a', [{ type: 'X' }]);
    store.append('b', [{ type: 'Y' }]);
    const all = store.getAllEvents();
    assert.equal(all.length, 2);
    assert.ok(all[0].globalVersion < all[1].globalVersion);
  });

  it('getEventsSince', () => {
    const store = new EventStore();
    store.append('a', [{ type: 'X' }]);
    store.append('a', [{ type: 'Y' }]);
    const since = store.getEventsSince(0);
    assert.equal(since.length, 1);
  });
});

describe('Aggregate', () => {
  it('applies events', () => {
    const acc = new BankAccount('acc-1');
    acc.open('Alice', 100);
    assert.equal(acc.owner, 'Alice');
    assert.equal(acc.balance, 100);
  });

  it('tracks uncommitted events', () => {
    const acc = new BankAccount('acc-1');
    acc.open('Bob');
    acc.deposit(50);
    const events = acc.getUncommittedEvents();
    assert.equal(events.length, 2);
    assert.equal(events[0].type, 'AccountOpened');
    assert.equal(events[1].type, 'MoneyDeposited');
  });

  it('enforces business rules', () => {
    const acc = new BankAccount('acc-1');
    acc.open('Carol', 100);
    assert.throws(() => acc.withdraw(200), { message: 'Insufficient funds' });
  });
});

describe('Aggregate — rehydration', () => {
  it('rebuilds from events', () => {
    const events = [
      { type: 'AccountOpened', owner: 'Dave', initialBalance: 0, aggregateId: 'acc-1' },
      { type: 'MoneyDeposited', amount: 100, aggregateId: 'acc-1' },
      { type: 'MoneyWithdrawn', amount: 30, aggregateId: 'acc-1' },
    ];
    const acc = Aggregate.rehydrate(BankAccount, events);
    assert.equal(acc.balance, 70);
    assert.equal(acc.owner, 'Dave');
    assert.equal(acc.version, 2);
  });
});

describe('Repository', () => {
  it('saves and loads aggregate', () => {
    const store = new EventStore();
    const repo = new Repository(BankAccount, store);
    
    const acc = new BankAccount('acc-1');
    acc.open('Eve', 100);
    acc.deposit(50);
    repo.save(acc);
    
    const loaded = repo.load('acc-1');
    assert.equal(loaded.balance, 150);
    assert.equal(loaded.owner, 'Eve');
  });

  it('returns null for missing', () => {
    const store = new EventStore();
    const repo = new Repository(BankAccount, store);
    assert.equal(repo.load('nonexistent'), null);
  });
});

describe('CommandBus', () => {
  it('dispatches commands', async () => {
    const store = new EventStore();
    const repo = new Repository(BankAccount, store);
    const bus = new CommandBus();
    
    bus.register('OpenAccount', (cmd) => {
      const acc = new BankAccount(cmd.id);
      acc.open(cmd.owner, cmd.balance);
      repo.save(acc);
    });
    
    bus.register('Deposit', (cmd) => {
      const acc = repo.load(cmd.accountId);
      acc.deposit(cmd.amount);
      repo.save(acc);
    });
    
    await bus.dispatch({ type: 'OpenAccount', id: 'acc-1', owner: 'Frank', balance: 100 });
    await bus.dispatch({ type: 'Deposit', accountId: 'acc-1', amount: 50 });
    
    const acc = repo.load('acc-1');
    assert.equal(acc.balance, 150);
  });

  it('throws on unknown command', async () => {
    const bus = new CommandBus();
    await assert.rejects(() => bus.dispatch({ type: 'Unknown' }));
  });
});

describe('Projection', () => {
  it('builds read model from events', () => {
    const store = new EventStore();
    store.append('acc-1', [
      { type: 'AccountOpened', owner: 'Grace', initialBalance: 0 },
      { type: 'MoneyDeposited', amount: 100 },
    ]);
    store.append('acc-2', [
      { type: 'AccountOpened', owner: 'Hank', initialBalance: 50 },
    ]);
    
    const balances = new Projection('balances');
    balances.state.accounts = {};
    balances
      .on('AccountOpened', (state, event) => {
        state.accounts[event.aggregateId] = { owner: event.owner, balance: event.initialBalance };
      })
      .on('MoneyDeposited', (state, event) => {
        state.accounts[event.aggregateId].balance += event.amount;
      });
    
    balances.catchUp(store);
    
    assert.equal(balances.state.accounts['acc-1'].balance, 100);
    assert.equal(balances.state.accounts['acc-2'].balance, 50);
  });

  it('catches up incrementally', () => {
    const store = new EventStore();
    store.append('a', [{ type: 'X', value: 1 }]);
    
    const proj = new Projection('test');
    proj.state.sum = 0;
    proj.on('X', (state, e) => { state.sum += e.value; });
    
    proj.catchUp(store);
    assert.equal(proj.state.sum, 1);
    
    store.append('a', [{ type: 'X', value: 2 }]);
    proj.catchUp(store);
    assert.equal(proj.state.sum, 3);
  });
});
