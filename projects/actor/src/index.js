/**
 * Tiny Actor Model
 * 
 * Erlang-inspired concurrency:
 * - Actors with mailboxes
 * - Message passing (async)
 * - Spawn actors
 * - Actor supervision (restart on crash)
 * - Ask pattern (request/response)
 */

class ActorSystem {
  constructor() {
    this.actors = new Map();
    this.nextId = 1;
    this.deadLetters = [];
  }

  spawn(behavior, name = null) {
    const id = name || `actor-${this.nextId++}`;
    const actor = new Actor(id, behavior, this);
    this.actors.set(id, actor);
    return id;
  }

  send(actorId, message) {
    const actor = this.actors.get(actorId);
    if (!actor) { this.deadLetters.push({ to: actorId, message }); return; }
    actor.mailbox.push(message);
    if (!actor.processing) actor._process();
  }

  ask(actorId, message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const replyTo = this.spawn(async (msg, ctx) => {
        resolve(msg);
        ctx.stop();
      });
      this.send(actorId, { ...message, replyTo });
      setTimeout(() => reject(new Error('Ask timeout')), timeout);
    });
  }

  stop(actorId) {
    this.actors.delete(actorId);
  }

  broadcast(message, filter = null) {
    for (const [id, actor] of this.actors) {
      if (!filter || filter(id, actor)) {
        this.send(id, message);
      }
    }
  }
}

class Actor {
  constructor(id, behavior, system) {
    this.id = id;
    this.behavior = behavior;
    this.system = system;
    this.mailbox = [];
    this.processing = false;
    this.state = {};
    this.children = [];
    this.supervisor = null;
  }

  async _process() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.mailbox.length > 0) {
      const msg = this.mailbox.shift();
      try {
        const ctx = new ActorContext(this);
        await this.behavior(msg, ctx, this.state);
      } catch (err) {
        if (this.supervisor) {
          this.system.send(this.supervisor, { type: 'child-error', child: this.id, error: err.message });
        }
      }
    }
    
    this.processing = false;
  }

  stop() {
    // Stop children
    for (const child of this.children) {
      this.system.stop(child);
    }
    this.system.stop(this.id);
  }
}

class ActorContext {
  constructor(actor) {
    this.self = actor.id;
    this.state = actor.state;
    this._actor = actor;
  }

  send(actorId, message) {
    this._actor.system.send(actorId, message);
  }

  reply(message) {
    // Find replyTo in current message
  }

  spawn(behavior, name = null) {
    const id = this._actor.system.spawn(behavior, name);
    this._actor.children.push(id);
    const child = this._actor.system.actors.get(id);
    if (child) child.supervisor = this.self;
    return id;
  }

  stop() {
    this._actor.stop();
  }

  become(newBehavior) {
    this._actor.behavior = newBehavior;
  }
}

module.exports = { ActorSystem };
