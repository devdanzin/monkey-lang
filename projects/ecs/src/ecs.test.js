import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './ecs.js';

describe('Entities', () => {
  let world;
  beforeEach(() => { world = new World(); });

  it('creates entity', () => { const e = world.createEntity(); assert.equal(world.entityCount, 1); });
  it('unique ids', () => { const a = world.createEntity(); const b = world.createEntity(); assert.notEqual(a, b); });
  it('destroys entity', () => { const e = world.createEntity(); world.destroyEntity(e); assert.equal(world.entityCount, 0); });
});

describe('Components', () => {
  let world;
  beforeEach(() => { world = new World(); });

  it('add component', () => { const e = world.createEntity(); world.addComponent(e, 'Position', { x: 0, y: 0 }); assert.ok(world.hasComponent(e, 'Position')); });
  it('get component', () => { const e = world.createEntity(); world.addComponent(e, 'Position', { x: 10, y: 20 }); assert.equal(world.getComponent(e, 'Position').x, 10); });
  it('remove component', () => { const e = world.createEntity(); world.addComponent(e, 'Position', {}); world.removeComponent(e, 'Position'); assert.ok(!world.hasComponent(e, 'Position')); });
  it('multiple components', () => {
    const e = world.createEntity();
    world.addComponent(e, 'Position', { x: 0 }).addComponent(e, 'Velocity', { vx: 1 });
    assert.ok(world.hasComponent(e, 'Position'));
    assert.ok(world.hasComponent(e, 'Velocity'));
  });
  it('destroy removes components', () => {
    const e = world.createEntity();
    world.addComponent(e, 'Position', {});
    world.destroyEntity(e);
    assert.ok(!world.hasComponent(e, 'Position'));
  });
});

describe('Queries', () => {
  let world;
  beforeEach(() => { world = new World(); });

  it('query single component', () => {
    const e1 = world.createEntity(); world.addComponent(e1, 'Position', {});
    const e2 = world.createEntity();
    assert.deepStrictEqual(world.query('Position'), [e1]);
  });
  it('query multiple components', () => {
    const e1 = world.createEntity(); world.addComponent(e1, 'Position', {}).addComponent(e1, 'Velocity', {});
    const e2 = world.createEntity(); world.addComponent(e2, 'Position', {});
    assert.deepStrictEqual(world.query('Position', 'Velocity'), [e1]);
  });
  it('queryWith returns data', () => {
    const e = world.createEntity(); world.addComponent(e, 'Position', { x: 5 });
    const r = world.queryWith('Position');
    assert.equal(r[0].Position.x, 5);
  });
});

describe('Systems', () => {
  it('runs system on matching entities', () => {
    const world = new World();
    const e = world.createEntity();
    world.addComponent(e, 'Position', { x: 0, y: 0 });
    world.addComponent(e, 'Velocity', { vx: 1, vy: 2 });

    world.addSystem('movement', ['Position', 'Velocity'], (entity, data, dt) => {
      data.Position.x += data.Velocity.vx * dt;
      data.Position.y += data.Velocity.vy * dt;
    });

    world.update(1);
    assert.equal(world.getComponent(e, 'Position').x, 1);
    assert.equal(world.getComponent(e, 'Position').y, 2);
  });

  it('skips non-matching entities', () => {
    const world = new World();
    const e1 = world.createEntity(); world.addComponent(e1, 'Position', { x: 0 });
    const e2 = world.createEntity(); world.addComponent(e2, 'Position', { x: 0 }).addComponent(e2, 'Velocity', { vx: 5 });

    let processed = 0;
    world.addSystem('move', ['Position', 'Velocity'], () => { processed++; });
    world.update(1);
    assert.equal(processed, 1);
  });

  it('priority ordering', () => {
    const world = new World();
    const e = world.createEntity(); world.addComponent(e, 'A', {});
    const order = [];
    world.addSystem('second', ['A'], () => order.push('second'), 2);
    world.addSystem('first', ['A'], () => order.push('first'), 1);
    world.update(0);
    assert.deepStrictEqual(order, ['first', 'second']);
  });
});

describe('Events', () => {
  it('emits on entity create', () => {
    const world = new World();
    let received;
    world.on('entityCreated', (data) => { received = data; });
    const e = world.createEntity();
    assert.equal(received.entity, e);
  });
  it('emits on component add', () => {
    const world = new World();
    let received;
    world.on('componentAdded', (data) => { received = data; });
    const e = world.createEntity();
    world.addComponent(e, 'Position', {});
    assert.equal(received.component, 'Position');
  });
});
