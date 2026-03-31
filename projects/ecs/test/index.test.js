const { test } = require('node:test');
const assert = require('node:assert/strict');
const { World } = require('../src/index.js');

test('create and destroy entities', () => {
  const world = new World();
  const e1 = world.createEntity();
  const e2 = world.createEntity();
  assert.equal(world.entityCount(), 2);
  world.destroyEntity(e1);
  assert.equal(world.entityCount(), 1);
});

test('add and get components', () => {
  const world = new World();
  const e = world.createEntity();
  world.addComponent(e, 'Position', { x: 10, y: 20 });
  world.addComponent(e, 'Velocity', { vx: 1, vy: -1 });

  const pos = world.getComponent(e, 'Position');
  assert.deepEqual(pos, { x: 10, y: 20 });
  assert.ok(world.hasComponent(e, 'Position'));
  assert.ok(!world.hasComponent(e, 'Health'));
});

test('remove component', () => {
  const world = new World();
  const e = world.createEntity();
  world.addComponent(e, 'Tag', {});
  assert.ok(world.hasComponent(e, 'Tag'));
  world.removeComponent(e, 'Tag');
  assert.ok(!world.hasComponent(e, 'Tag'));
});

test('query entities by components', () => {
  const world = new World();
  const e1 = world.createEntity();
  const e2 = world.createEntity();
  const e3 = world.createEntity();

  world.addComponent(e1, 'Position', { x: 0, y: 0 });
  world.addComponent(e1, 'Velocity', { vx: 1, vy: 0 });
  world.addComponent(e2, 'Position', { x: 5, y: 5 });
  world.addComponent(e3, 'Health', { hp: 100 });

  const movable = world.query('Position', 'Velocity');
  assert.equal(movable.length, 1);
  assert.equal(movable[0].entity, e1);

  const positioned = world.query('Position');
  assert.equal(positioned.length, 2);
});

test('systems process entities', () => {
  const world = new World();
  const e = world.createEntity();
  world.addComponent(e, 'Position', { x: 0, y: 0 });
  world.addComponent(e, 'Velocity', { vx: 10, vy: 5 });

  world.addSystem('movement', ['Position', 'Velocity'], (entities, dt) => {
    for (const { Position, Velocity } of entities) {
      Position.x += Velocity.vx * dt;
      Position.y += Velocity.vy * dt;
    }
  });

  world.update(1);
  const pos = world.getComponent(e, 'Position');
  assert.equal(pos.x, 10);
  assert.equal(pos.y, 5);

  world.update(0.5);
  assert.equal(pos.x, 15);
  assert.equal(pos.y, 7.5);
});

test('system priority ordering', () => {
  const world = new World();
  const order = [];

  world.addSystem('second', [], () => order.push('second'), 2);
  world.addSystem('first', [], () => order.push('first'), 1);
  world.addSystem('third', [], () => order.push('third'), 3);

  world.update(0);
  assert.deepEqual(order, ['first', 'second', 'third']);
});

test('events — emit and handle', () => {
  const world = new World();
  const received = [];

  world.on('damage', (data) => received.push(data));
  world.emit('damage', { target: 1, amount: 25 });
  world.emit('damage', { target: 2, amount: 50 });

  assert.equal(received.length, 2);
  assert.equal(received[0].amount, 25);
  assert.equal(received[1].amount, 50);
});

test('destroy entity removes all components', () => {
  const world = new World();
  const e = world.createEntity();
  world.addComponent(e, 'Position', { x: 0, y: 0 });
  world.addComponent(e, 'Health', { hp: 100 });

  world.destroyEntity(e);
  assert.ok(!world.hasComponent(e, 'Position'));
  assert.ok(!world.hasComponent(e, 'Health'));
});

test('serialize and deserialize', () => {
  const world = new World();
  const e1 = world.createEntity();
  const e2 = world.createEntity();
  world.addComponent(e1, 'Position', { x: 10, y: 20 });
  world.addComponent(e1, 'Name', { value: 'Player' });
  world.addComponent(e2, 'Position', { x: 5, y: 5 });

  const data = world.serialize();
  const restored = World.deserialize(data);

  assert.equal(restored.entityCount(), 2);
  assert.deepEqual(restored.getComponent(e1, 'Position'), { x: 10, y: 20 });
  assert.deepEqual(restored.getComponent(e1, 'Name'), { value: 'Player' });
  assert.deepEqual(restored.getComponent(e2, 'Position'), { x: 5, y: 5 });
});

test('game loop simulation', () => {
  const world = new World();

  // Create entities
  for (let i = 0; i < 10; i++) {
    const e = world.createEntity();
    world.addComponent(e, 'Position', { x: i * 10, y: 0 });
    world.addComponent(e, 'Velocity', { vx: 1, vy: 0.5 });
    world.addComponent(e, 'Health', { hp: 100 });
  }

  // Movement system
  world.addSystem('movement', ['Position', 'Velocity'], (entities, dt) => {
    for (const { Position, Velocity } of entities) {
      Position.x += Velocity.vx * dt;
      Position.y += Velocity.vy * dt;
    }
  });

  // Damage system (damages entities below y=0 — none here, just testing system runs)
  let damageChecks = 0;
  world.addSystem('damage', ['Health'], (entities) => {
    damageChecks += entities.length;
  });

  // Run 10 frames
  for (let f = 0; f < 10; f++) world.update(1/60);

  assert.equal(damageChecks, 100); // 10 entities * 10 frames
  const pos = world.getComponent(1, 'Position');
  assert.ok(pos.x > 0); // moved
});

test('multiple event handlers', () => {
  const world = new World();
  let count = 0;
  world.on('tick', () => count++);
  world.on('tick', () => count++);
  world.emit('tick', {});
  assert.equal(count, 2);
});
