// ===== CQRS / Event Sourcing =====

// ===== Event Store =====

export class EventStore {
  constructor() {
    this.streams = new Map();    // aggregateId → [events]
    this.allEvents = [];         // global ordered log
    this._version = 0;
  }

  append(aggregateId, events) {
    if (!this.streams.has(aggregateId)) this.streams.set(aggregateId, []);
    const stream = this.streams.get(aggregateId);
    
    for (const event of events) {
      const stored = {
        ...event,
        aggregateId,
        version: stream.length,
        globalVersion: this._version++,
        timestamp: Date.now(),
      };
      stream.push(stored);
      this.allEvents.push(stored);
    }
  }

  getStream(aggregateId) { return this.streams.get(aggregateId) || []; }
  
  getAllEvents() { return this.allEvents; }
  
  getEventsSince(globalVersion) {
    return this.allEvents.filter(e => e.globalVersion > globalVersion);
  }
}

// ===== Aggregate =====

export class Aggregate {
  constructor(id) {
    this.id = id;
    this.version = -1;
    this._uncommitted = [];
  }

  // Apply an event to update state
  apply(event) {
    const handler = this['on' + event.type];
    if (handler) handler.call(this, event);
    this.version++;
  }

  // Raise a new event
  raise(event) {
    this.apply(event);
    this._uncommitted.push(event);
  }

  // Get and clear uncommitted events
  getUncommittedEvents() {
    const events = this._uncommitted;
    this._uncommitted = [];
    return events;
  }

  // Rebuild from event stream
  static rehydrate(Class, events) {
    const aggregate = new Class(events[0]?.aggregateId);
    for (const event of events) {
      aggregate.apply(event);
    }
    return aggregate;
  }
}

// ===== Command Bus =====

export class CommandBus {
  constructor() {
    this._handlers = new Map();
  }

  register(commandType, handler) {
    this._handlers.set(commandType, handler);
  }

  async dispatch(command) {
    const handler = this._handlers.get(command.type);
    if (!handler) throw new Error(`No handler for command: ${command.type}`);
    return await handler(command);
  }
}

// ===== Projection =====

export class Projection {
  constructor(name) {
    this.name = name;
    this.state = {};
    this._handlers = {};
    this._lastVersion = -1;
  }

  on(eventType, handler) {
    this._handlers[eventType] = handler;
    return this;
  }

  apply(event) {
    const handler = this._handlers[event.type];
    if (handler) handler(this.state, event);
    this._lastVersion = event.globalVersion;
  }

  // Catch up from event store
  catchUp(eventStore) {
    const events = eventStore.getEventsSince(this._lastVersion);
    for (const event of events) this.apply(event);
  }
}

// ===== Repository =====

export class Repository {
  constructor(AggregateClass, eventStore) {
    this.AggregateClass = AggregateClass;
    this.eventStore = eventStore;
  }

  load(id) {
    const events = this.eventStore.getStream(id);
    if (events.length === 0) return null;
    return Aggregate.rehydrate(this.AggregateClass, events);
  }

  save(aggregate) {
    const events = aggregate.getUncommittedEvents();
    if (events.length > 0) {
      this.eventStore.append(aggregate.id, events);
    }
  }
}
