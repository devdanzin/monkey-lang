// eventsource.js — Event Sourcing + CQRS

// ===== Event Store =====
export class EventStore {
  constructor() {
    this.events = [];           // global event log
    this.streams = new Map();   // streamId → [events]
    this.subscribers = [];       // event bus subscribers
    this.snapshots = new Map(); // streamId → { version, state }
  }

  append(streamId, events, expectedVersion = -1) {
    const stream = this.streams.get(streamId) || [];
    
    // Optimistic concurrency check
    if (expectedVersion >= 0 && stream.length !== expectedVersion) {
      throw new Error(`Concurrency conflict: expected version ${expectedVersion}, got ${stream.length}`);
    }

    const stamped = events.map((e, i) => ({
      ...e,
      streamId,
      version: stream.length + i,
      timestamp: Date.now(),
      globalPosition: this.events.length + i,
    }));

    this.events.push(...stamped);
    this.streams.set(streamId, [...stream, ...stamped]);

    // Publish to subscribers
    for (const event of stamped) {
      for (const sub of this.subscribers) sub(event);
    }

    return stamped;
  }

  getStream(streamId, fromVersion = 0) {
    const stream = this.streams.get(streamId) || [];
    return stream.filter(e => e.version >= fromVersion);
  }

  getAllEvents(fromPosition = 0) {
    return this.events.filter(e => e.globalPosition >= fromPosition);
  }

  getStreamVersion(streamId) {
    return (this.streams.get(streamId) || []).length;
  }

  // Snapshot support
  saveSnapshot(streamId, state, version) {
    this.snapshots.set(streamId, { state: structuredClone(state), version });
  }

  getSnapshot(streamId) {
    return this.snapshots.get(streamId) || null;
  }

  subscribe(handler) {
    this.subscribers.push(handler);
    return () => { this.subscribers = this.subscribers.filter(s => s !== handler); };
  }

  get eventCount() { return this.events.length; }
  get streamCount() { return this.streams.size; }
}

// ===== Aggregate Root =====
export class AggregateRoot {
  constructor(id) {
    this.id = id;
    this.version = 0;
    this.uncommittedEvents = [];
  }

  apply(event) {
    this.when(event);
    this.uncommittedEvents.push(event);
  }

  // Override in subclass
  when(event) { throw new Error('Subclass must implement when()'); }

  loadFromHistory(events) {
    for (const event of events) {
      this.when(event);
      this.version++;
    }
  }

  loadFromSnapshot(snapshot, events) {
    Object.assign(this, snapshot.state);
    this.version = snapshot.version;
    this.loadFromHistory(events);
  }

  getUncommittedEvents() {
    const events = [...this.uncommittedEvents];
    this.uncommittedEvents = [];
    return events;
  }
}

// ===== Projection =====
export class Projection {
  constructor(name) {
    this.name = name;
    this.state = {};
    this.lastPosition = -1;
    this.handlers = new Map();
  }

  when(eventType, handler) {
    this.handlers.set(eventType, handler);
    return this;
  }

  handle(event) {
    const handler = this.handlers.get(event.type);
    if (handler) {
      this.state = handler(this.state, event);
    }
    this.lastPosition = event.globalPosition;
  }

  rebuild(eventStore) {
    this.state = {};
    this.lastPosition = -1;
    for (const event of eventStore.getAllEvents()) {
      this.handle(event);
    }
  }

  catchUp(eventStore) {
    for (const event of eventStore.getAllEvents(this.lastPosition + 1)) {
      this.handle(event);
    }
  }
}

// ===== Command Handler =====
export class CommandHandler {
  constructor(eventStore) {
    this.store = eventStore;
    this.handlers = new Map();
  }

  register(commandType, handler) {
    this.handlers.set(commandType, handler);
  }

  execute(command) {
    const handler = this.handlers.get(command.type);
    if (!handler) throw new Error(`No handler for command: ${command.type}`);
    return handler(command, this.store);
  }
}

// ===== Event Bus =====
export class EventBus {
  constructor() {
    this.handlers = new Map(); // eventType → [handlers]
  }

  on(eventType, handler) {
    if (!this.handlers.has(eventType)) this.handlers.set(eventType, []);
    this.handlers.get(eventType).push(handler);
  }

  emit(event) {
    const handlers = this.handlers.get(event.type) || [];
    for (const handler of handlers) handler(event);
    // Also emit to wildcard handlers
    const wildcardHandlers = this.handlers.get('*') || [];
    for (const handler of wildcardHandlers) handler(event);
  }

  off(eventType, handler) {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }
}

// ===== Example: Bank Account Aggregate =====
export class BankAccount extends AggregateRoot {
  constructor(id) {
    super(id);
    this.balance = 0;
    this.isOpen = false;
    this.owner = null;
    this.transactions = [];
  }

  open(owner, initialDeposit = 0) {
    if (this.isOpen) throw new Error('Account already open');
    this.apply({ type: 'AccountOpened', owner, initialDeposit });
    if (initialDeposit > 0) {
      this.apply({ type: 'MoneyDeposited', amount: initialDeposit });
    }
  }

  deposit(amount) {
    if (!this.isOpen) throw new Error('Account not open');
    if (amount <= 0) throw new Error('Amount must be positive');
    this.apply({ type: 'MoneyDeposited', amount });
  }

  withdraw(amount) {
    if (!this.isOpen) throw new Error('Account not open');
    if (amount <= 0) throw new Error('Amount must be positive');
    if (amount > this.balance) throw new Error('Insufficient funds');
    this.apply({ type: 'MoneyWithdrawn', amount });
  }

  close() {
    if (!this.isOpen) throw new Error('Account not open');
    if (this.balance !== 0) throw new Error('Balance must be zero');
    this.apply({ type: 'AccountClosed' });
  }

  when(event) {
    switch (event.type) {
      case 'AccountOpened':
        this.isOpen = true;
        this.owner = event.owner;
        break;
      case 'MoneyDeposited':
        this.balance += event.amount;
        this.transactions.push({ type: 'deposit', amount: event.amount });
        break;
      case 'MoneyWithdrawn':
        this.balance -= event.amount;
        this.transactions.push({ type: 'withdrawal', amount: event.amount });
        break;
      case 'AccountClosed':
        this.isOpen = false;
        break;
    }
  }
}
