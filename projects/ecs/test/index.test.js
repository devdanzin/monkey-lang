const { test } = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../src/index.js');

test('create entities', () => {
  const w = new World();
  const e1 = w.createEntity();
  const e2 = w.createEntity();
  assert.equal(e1, 1);
  assert.equal(e2, 2);
  assert.equal(w.entityCount(), 2);
});

test('add/get/remove components', () => {
  const w = new World();
  const e = w.createEntity();
  w.addComponent(e, 'Position', { x: 10, y: 20 });
  assert.deepEqual(w.getComponent(e, 'Position'), { x: 10, y: 20 });
  assert.ok(w.hasComponent(e, 'Position'));
  w.removeComponent(e, 'Position');
  assert.ok(!w.hasComponent(e, 'Position'));
});

test('destroy entity removes components', () => {
  const w = new World();
  const e = w.createEntity();
  w.addComponent(e, 'Health', { hp: 100 });
  w.destroyEntity(e);
  assert.equal(w.entityCount(), 0);
  assert.equal(w.getComponent(e, 'Health'), undefined);
});

test('query entities by components', () => {
  const w = new World();
  const e1 = w.createEntity();
  const e2 = w.createEntity();
  const e3 = w.createEntity();
  w.addComponent(e1, 'Position', { x: 0, y: 0 });
  w.addComponent(e1, 'Velocity', { vx: 1, vy: 0 });
  w.addComponent(e2, 'Position', { x: 5, y: 5 });
  w.addComponent(e3, 'Health', { hp: 100 });
  
  const movable = w.query('Position', 'Velocity');
  assert.equal(movable.length, 1);
  assert.equal(movable[0].entity, e1);
});

test('systems update', () => {
  const w = new World();
  const e = w.createEntity();
  w.addComponent(e, 'Position', { x: 0, y: 0 });
  w.addComponent(e, 'Velocity', { vx: 10, vy: 5 });
  
  w.addSystem('movement', ['Position', 'Velocity'], (entities, dt) => {
    for (const { Position, Velocity } of entities) {
      Position.x += Velocity.vx * dt;
      Position.y += Velocity.vy * dt;
    }
  });
  
  w.update(1);
  assert.deepEqual(w.getComponent(e, 'Position'), { x: 10, y: 5 });
});

test('system priority', () => {
  const w = new World();
  const order = [];
  w.addSystem('B', [], () => order.push('B'), 2);
  w.addSystem('A', [], () => order.push('A'), 1);
  w.update(0);
  assert.deepEqual(order, ['A', 'B']);
});

test('events', () => {
  const w = new World();
  const log = [];
  w.on('collision', (data) => log.push(data));
  w.emit('collision', { a: 1, b: 2 });
  assert.deepEqual(log, [{ a: 1, b: 2 }]);
});

test('serialize/deserialize', () => {
  const w = new World();
  const e = w.createEntity();
  w.addComponent(e, 'Position', { x: 42, y: 99 });
  
  const data = w.serialize();
  const w2 = World.deserialize(data);
  assert.deepEqual(w2.getComponent(e, 'Position'), { x: 42, y: 99 });
});
