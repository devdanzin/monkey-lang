// ===== Actor Model =====
//
// Erlang-inspired actor system:
//   - Actors are isolated units with private state
//   - Communication only via asynchronous messages
//   - Each actor has a mailbox (message queue)
//   - Supervision: parent actors monitor children
//   - Ask pattern: send message and wait for reply

import { EventEmitter } from 'node:events';

let _actorIdCounter = 0;

// ===== Actor System =====
export class ActorSystem {
  constructor(name = 'system') {
    this.name = name;
    this.actors = new Map();  // id → Actor
    this.deadLetters = [];    // messages to dead/unknown actors
    this.running = true;
  }

  // Spawn a new actor
  spawn(behavior, name) {
    const id = `${name || 'actor'}-${_actorIdCounter++}`;
    const actor = new Actor(id, behavior, this);
    this.actors.set(id, actor);
    
    // Initialize
    if (behavior.init) {
      actor.state = behavior.init(actor.context);
    }
    
    return new ActorRef(id, this);
  }

  // Send message to actor by ref
  _send(id, message, sender) {
    const actor = this.actors.get(id);
    if (!actor) {
      this.deadLetters.push({ to: id, message, sender });
      return;
    }
    actor.mailbox.push({ message, sender });
    this._scheduleProcess(actor);
  }

  // Schedule actor to process next message
  _scheduleProcess(actor) {
    if (!actor.processing && actor.mailbox.length > 0) {
      actor.processing = true;
      // Use microtask for async processing
      queueMicrotask(() => this._processNext(actor));
    }
  }

  _processNext(actor) {
    if (actor.mailbox.length === 0) {
      actor.processing = false;
      return;
    }

    const { message, sender } = actor.mailbox.shift();
    
    try {
      const newState = actor.behavior.receive(
        actor.state,
        message,
        actor.context,
        sender ? new ActorRef(sender, this) : null,
      );
      
      if (newState !== undefined) {
        actor.state = newState;
      }
    } catch (error) {
      actor.errors.push(error);
      
      // Notify supervisor
      if (actor.supervisor) {
        this._send(actor.supervisor, {
          type: '__child_error',
          child: actor.id,
          error: error.message,
        });
      }
      
      // Restart strategy
      if (actor.behavior.init) {
        actor.state = actor.behavior.init(actor.context);
      }
    }

    // Continue processing if more messages
    if (actor.mailbox.length > 0) {
      queueMicrotask(() => this._processNext(actor));
    } else {
      actor.processing = false;
    }
  }

  // Stop an actor
  stop(ref) {
    const actor = this.actors.get(ref.id);
    if (actor) {
      if (actor.behavior.stop) {
        actor.behavior.stop(actor.state, actor.context);
      }
      // Stop children
      for (const childId of actor.children) {
        this.stop(new ActorRef(childId, this));
      }
      this.actors.delete(ref.id);
    }
  }

  // Synchronous processing (for testing) — process all pending messages
  async drain() {
    // Process until all mailboxes are empty
    let rounds = 0;
    while (rounds++ < 1000) {
      let hasWork = false;
      for (const actor of this.actors.values()) {
        while (actor.mailbox.length > 0) {
          hasWork = true;
          const { message, sender } = actor.mailbox.shift();
          try {
            const newState = actor.behavior.receive(
              actor.state,
              message,
              actor.context,
              sender ? new ActorRef(sender, this) : null,
            );
            if (newState !== undefined) actor.state = newState;
          } catch (error) {
            actor.errors.push(error);
            if (actor.behavior.init) actor.state = actor.behavior.init(actor.context);
          }
        }
      }
      if (!hasWork) break;
    }
  }
}

// ===== Actor =====
class Actor {
  constructor(id, behavior, system) {
    this.id = id;
    this.behavior = behavior;
    this.system = system;
    this.state = null;
    this.mailbox = [];
    this.processing = false;
    this.children = new Set();
    this.supervisor = null;
    this.errors = [];
    
    // Context provides actor API
    this.context = {
      self: new ActorRef(id, system),
      spawn: (behavior, name) => {
        const ref = system.spawn(behavior, name);
        this.children.add(ref.id);
        system.actors.get(ref.id).supervisor = id;
        return ref;
      },
      stop: (ref) => system.stop(ref),
      system,
    };
  }
}

// ===== Actor Reference =====
export class ActorRef {
  constructor(id, system) {
    this.id = id;
    this.system = system;
  }

  // Fire-and-forget message
  tell(message, sender) {
    this.system._send(this.id, message, sender?.id || null);
  }

  // Request-reply pattern (returns a promise)
  ask(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const replyTo = `__ask-${_actorIdCounter++}`;
      const timer = setTimeout(() => {
        this.system.actors.delete(replyTo);
        reject(new Error(`Ask timeout: ${timeout}ms`));
      }, timeout);

      // Create temporary actor to receive reply
      const tempActor = new Actor(replyTo, {
        receive: (state, msg) => {
          clearTimeout(timer);
          this.system.actors.delete(replyTo);
          resolve(msg);
        },
      }, this.system);
      this.system.actors.set(replyTo, tempActor);

      this.system._send(this.id, message, replyTo);
    });
  }

  // Get actor state (for testing)
  getState() {
    const actor = this.system.actors.get(this.id);
    return actor ? actor.state : null;
  }

  // Check if actor is alive
  isAlive() {
    return this.system.actors.has(this.id);
  }

  toString() { return `ActorRef(${this.id})`; }
}

// ===== Behavior Helpers =====

// Create a stateful behavior
export function stateful(init, receive, options = {}) {
  return {
    init: (ctx) => (typeof init === 'function' ? init(ctx) : init),
    receive: (state, message, ctx, sender) => receive(state, message, ctx, sender),
    stop: options.stop,
  };
}

// Create a stateless behavior (just handles messages)
export function stateless(receive) {
  return {
    receive: (state, message, ctx, sender) => { receive(message, ctx, sender); },
  };
}

// Counter actor behavior
export function counter(initial = 0) {
  return stateful(initial, (count, message, ctx, sender) => {
    switch (message.type) {
      case 'increment': return count + (message.amount || 1);
      case 'decrement': return count - (message.amount || 1);
      case 'get':
        if (sender) sender.tell(count);
        return count;
      case 'reset': return initial;
      default: return count;
    }
  });
}

// Router: distributes messages round-robin to children
export function router(workerBehavior, numWorkers) {
  return stateful(
    (ctx) => {
      const workers = [];
      for (let i = 0; i < numWorkers; i++) {
        workers.push(ctx.spawn(workerBehavior, `worker-${i}`));
      }
      return { workers, index: 0 };
    },
    (state, message, ctx, sender) => {
      const { workers } = state;
      const worker = workers[state.index % workers.length];
      worker.tell({ ...message, replyTo: sender?.id }, ctx.self);
      return { ...state, index: state.index + 1 };
    },
  );
}
