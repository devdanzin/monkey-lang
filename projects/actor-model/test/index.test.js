import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ActorSystem, ActorRef, stateful, stateless, counter, router } from '../src/index.js';

describe('Actor System — basic', () => {
  it('creates an actor system', () => {
    const system = new ActorSystem('test');
    assert.equal(system.name, 'test');
  });

  it('spawns an actor', () => {
    const system = new ActorSystem();
    const ref = system.spawn(stateless(() => {}), 'greeter');
    assert.ok(ref instanceof ActorRef);
    assert.ok(ref.isAlive());
  });

  it('stops an actor', () => {
    const system = new ActorSystem();
    const ref = system.spawn(stateless(() => {}), 'temp');
    assert.ok(ref.isAlive());
    system.stop(ref);
    assert.ok(!ref.isAlive());
  });
});

describe('Actor — stateful', () => {
  it('initializes state', () => {
    const system = new ActorSystem();
    const ref = system.spawn(stateful(42, (s) => s), 'num');
    assert.equal(ref.getState(), 42);
  });

  it('updates state on message', async () => {
    const system = new ActorSystem();
    const ref = system.spawn(counter(0), 'counter');
    
    ref.tell({ type: 'increment' });
    ref.tell({ type: 'increment' });
    ref.tell({ type: 'increment' });
    
    await system.drain();
    assert.equal(ref.getState(), 3);
  });

  it('decrements counter', async () => {
    const system = new ActorSystem();
    const ref = system.spawn(counter(10), 'counter');
    
    ref.tell({ type: 'decrement', amount: 3 });
    await system.drain();
    
    assert.equal(ref.getState(), 7);
  });

  it('resets counter', async () => {
    const system = new ActorSystem();
    const ref = system.spawn(counter(0), 'counter');
    
    ref.tell({ type: 'increment' });
    ref.tell({ type: 'increment' });
    ref.tell({ type: 'reset' });
    
    await system.drain();
    assert.equal(ref.getState(), 0);
  });
});

describe('Actor — message passing', () => {
  it('actors can send messages to each other', async () => {
    const system = new ActorSystem();
    const results = [];
    
    const receiver = system.spawn(stateless((msg) => {
      results.push(msg);
    }), 'receiver');
    
    const sender = system.spawn(stateless((msg, ctx) => {
      receiver.tell({ from: 'sender', data: msg.data });
    }), 'sender');
    
    sender.tell({ data: 'hello' });
    await system.drain();
    
    assert.equal(results.length, 1);
    assert.equal(results[0].data, 'hello');
  });

  it('reply pattern: sender gets response', async () => {
    const system = new ActorSystem();
    const responses = [];
    
    const echo = system.spawn(stateless((msg, ctx, sender) => {
      if (sender) sender.tell({ echo: msg.text });
    }), 'echo');
    
    const client = system.spawn(stateless((msg) => {
      if (msg.echo) responses.push(msg.echo);
      else echo.tell({ text: msg.text }, system.actors.get(client.id).context.self);
    }), 'client');
    
    client.tell({ text: 'hello' });
    await system.drain();
    
    assert.equal(responses.length, 1);
    assert.equal(responses[0], 'hello');
  });
});

describe('Actor — supervision', () => {
  it('parent spawns child actors', async () => {
    const system = new ActorSystem();
    const childMessages = [];
    
    const parent = system.spawn(stateful(
      (ctx) => {
        const child = ctx.spawn(stateless((msg) => {
          childMessages.push(msg);
        }), 'child');
        return { child };
      },
      (state, message) => {
        state.child.tell(message);
        return state;
      },
    ), 'parent');
    
    parent.tell('hello');
    await system.drain();
    
    assert.equal(childMessages.length, 1);
    assert.equal(childMessages[0], 'hello');
  });

  it('stopping parent stops children', () => {
    const system = new ActorSystem();
    let childRef;
    
    const parent = system.spawn(stateful(
      (ctx) => {
        childRef = ctx.spawn(stateless(() => {}), 'child');
        return {};
      },
      (s) => s,
    ), 'parent');
    
    assert.ok(childRef.isAlive());
    system.stop(parent);
    assert.ok(!childRef.isAlive());
  });

  it('actor restarts on error', async () => {
    const system = new ActorSystem();
    let callCount = 0;
    
    const fragile = system.spawn(stateful(
      () => ({ count: 0 }),
      (state, msg) => {
        callCount++;
        if (msg === 'crash') throw new Error('boom');
        return { count: state.count + 1 };
      },
    ), 'fragile');
    
    fragile.tell('crash');
    fragile.tell('ok');
    await system.drain();
    
    // After crash, state should be re-initialized
    assert.equal(fragile.getState().count, 1);
    assert.equal(callCount, 2);
  });
});

describe('Actor — patterns', () => {
  it('accumulator pattern', async () => {
    const system = new ActorSystem();
    
    const accum = system.spawn(stateful(
      [],
      (items, msg, ctx, sender) => {
        if (msg.type === 'add') return [...items, msg.value];
        if (msg.type === 'get' && sender) {
          sender.tell(items);
          return items;
        }
        return items;
      },
    ), 'accum');
    
    accum.tell({ type: 'add', value: 'a' });
    accum.tell({ type: 'add', value: 'b' });
    accum.tell({ type: 'add', value: 'c' });
    
    await system.drain();
    assert.deepEqual(accum.getState(), ['a', 'b', 'c']);
  });

  it('ping-pong between actors', async () => {
    const system = new ActorSystem();
    let pongs = 0;
    
    const pong = system.spawn(stateless((msg, ctx, sender) => {
      if (msg === 'ping' && sender) sender.tell('pong');
    }), 'pong');
    
    const ping = system.spawn(stateful(
      0,
      (count, msg, ctx) => {
        if (msg === 'start') {
          pong.tell('ping', ctx.self);
          return count;
        }
        if (msg === 'pong') {
          pongs++;
          return count + 1;
        }
        return count;
      },
    ), 'ping');
    
    ping.tell('start');
    await system.drain();
    
    assert.equal(pongs, 1);
    assert.equal(ping.getState(), 1);
  });

  it('stateless echo actor', async () => {
    const system = new ActorSystem();
    const received = [];
    
    const echo = system.spawn(stateless((msg, ctx, sender) => {
      received.push(msg);
      if (sender) sender.tell(`echo: ${msg}`);
    }), 'echo');
    
    echo.tell('hello');
    echo.tell('world');
    await system.drain();
    
    assert.equal(received.length, 2);
    assert.equal(received[0], 'hello');
    assert.equal(received[1], 'world');
  });
});

describe('Actor — dead letters', () => {
  it('messages to dead actors go to dead letter queue', async () => {
    const system = new ActorSystem();
    const ref = system.spawn(stateless(() => {}), 'temp');
    system.stop(ref);
    
    ref.tell('hello');
    await system.drain();
    
    assert.equal(system.deadLetters.length, 1);
    assert.equal(system.deadLetters[0].message, 'hello');
  });
});

describe('Actor — ask pattern', () => {
  it('ask returns a promise with reply', async () => {
    const system = new ActorSystem();
    
    const responder = system.spawn(stateless((msg, ctx, sender) => {
      if (sender) sender.tell(msg * 2);
    }), 'responder');
    
    const result = await responder.ask(21);
    assert.equal(result, 42);
  });
});
