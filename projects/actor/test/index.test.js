const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ActorSystem } = require('../src/index.js');

test('spawn and send', async () => {
  const system = new ActorSystem();
  const log = [];
  const id = system.spawn((msg) => { log.push(msg); });
  system.send(id, 'hello');
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(log, ['hello']);
});

test('multiple messages', async () => {
  const system = new ActorSystem();
  const log = [];
  const id = system.spawn((msg) => { log.push(msg); });
  system.send(id, 1);
  system.send(id, 2);
  system.send(id, 3);
  await new Promise(r => setTimeout(r, 50));
  assert.deepEqual(log, [1, 2, 3]);
});

test('actor state', async () => {
  const system = new ActorSystem();
  const results = [];
  const id = system.spawn((msg, ctx) => {
    ctx.state.count = (ctx.state.count || 0) + 1;
    results.push(ctx.state.count);
  });
  system.send(id, 'inc');
  system.send(id, 'inc');
  system.send(id, 'inc');
  await new Promise(r => setTimeout(r, 50));
  assert.deepEqual(results, [1, 2, 3]);
});

test('ask pattern', async () => {
  const system = new ActorSystem();
  const id = system.spawn((msg, ctx) => {
    if (msg.replyTo) {
      ctx.send(msg.replyTo, msg.value * 2);
    }
  });
  const result = await system.ask(id, { value: 21 });
  assert.equal(result, 42);
});

test('dead letters', () => {
  const system = new ActorSystem();
  system.send('nonexistent', 'hello');
  assert.equal(system.deadLetters.length, 1);
});

test('stop actor', async () => {
  const system = new ActorSystem();
  const id = system.spawn(() => {});
  assert.ok(system.actors.has(id));
  system.stop(id);
  assert.ok(!system.actors.has(id));
});

test('spawn child', async () => {
  const system = new ActorSystem();
  const log = [];
  system.spawn((msg, ctx) => {
    const child = ctx.spawn((cmsg) => { log.push(cmsg); });
    ctx.send(child, 'from-parent');
  });
  system.send('actor-1', 'go');
  await new Promise(r => setTimeout(r, 50));
  assert.ok(log.includes('from-parent'));
});

test('become (behavior change)', async () => {
  const system = new ActorSystem();
  const log = [];
  const id = system.spawn((msg, ctx) => {
    log.push('initial:' + msg);
    ctx.become((msg2) => { log.push('changed:' + msg2); });
  });
  system.send(id, 'a');
  await new Promise(r => setTimeout(r, 20));
  system.send(id, 'b');
  await new Promise(r => setTimeout(r, 20));
  assert.equal(log[0], 'initial:a');
  assert.equal(log[1], 'changed:b');
});
