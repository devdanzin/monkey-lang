import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { World, defineComponent } from '../src/index.js';

// Define test components
const Position = defineComponent('Position', { x: 0, y: 0 });
const Velocity = defineComponent('Velocity', { vx: 0, vy: 0 });
const Health = defineComponent('Health', { hp: 100, max: 100 });
const Tag = defineComponent('Tag', { name: '' });
const Renderable = defineComponent('Renderable', { sprite: '', visible: true });

describe('Entity lifecycle', () => {
  let world;
  beforeEach(() => world = new World());

  it('spawn returns incrementing IDs', () => {
    assert.equal(world.spawn(), 0);
    assert.equal(world.spawn(), 1);
    assert.equal(world.spawn(), 2);
  });

  it('spawn with components', () => {
    const e = world.spawn(new Position({ x: 10, y: 20 }), new Velocity({ vx: 1, vy: 0 }));
    assert.equal(world.hasComponent(e, Position), true);
    assert.equal(world.hasComponent(e, Velocity), true);
    assert.equal(world.getComponent(e, Position).x, 10);
  });

  it('despawn removes entity', () => {
    const e = world.spawn(new Position());
    assert.equal(world.isAlive(e), true);
    world.despawn(e);
    assert.equal(world.isAlive(e), false);
  });

  it('entityCount tracks live entities', () => {
    world.spawn(); world.spawn();
    assert.equal(world.entityCount(), 2);
    world.despawn(0);
    assert.equal(world.entityCount(), 1);
  });
});

describe('Components', () => {
  let world;
  beforeEach(() => world = new World());

  it('add and get component', () => {
    const e = world.spawn();
    world.addComponent(e, new Health({ hp: 50 }));
    const h = world.getComponent(e, Health);
    assert.equal(h.hp, 50);
    assert.equal(h.max, 100);
  });

  it('remove component', () => {
    const e = world.spawn(new Position());
    world.removeComponent(e, Position);
    assert.equal(world.hasComponent(e, Position), false);
  });

  it('inspect returns all components', () => {
    const e = world.spawn(new Position({ x: 5 }), new Health());
    const info = world.inspect(e);
    assert.ok('Position' in info);
    assert.ok('Health' in info);
    assert.equal(info.Position.x, 5);
  });
});

describe('Queries', () => {
  let world;
  beforeEach(() => world = new World());

  it('query single component', () => {
    world.spawn(new Position({ x: 1 }));
    world.spawn(new Position({ x: 2 }));
    world.spawn(new Velocity());
    const results = world.query(Position);
    assert.equal(results.length, 2);
  });

  it('query multiple components (AND)', () => {
    world.spawn(new Position(), new Velocity()); // matches
    world.spawn(new Position());                  // doesn't match
    world.spawn(new Velocity());                  // doesn't match
    const results = world.query(Position, Velocity);
    assert.equal(results.length, 1);
  });

  it('query returns [entity, ...components]', () => {
    const e = world.spawn(new Position({ x: 42 }), new Velocity({ vx: 5 }));
    const [[id, pos, vel]] = world.query(Position, Velocity);
    assert.equal(id, e);
    assert.equal(pos.x, 42);
    assert.equal(vel.vx, 5);
  });

  it('queryWithout excludes entities', () => {
    world.spawn(new Position(), new Tag({ name: 'player' }));
    world.spawn(new Position());
    const results = world.queryWithout([Position], [Tag]);
    assert.equal(results.length, 1);
  });

  it('query handles despawned entities', () => {
    const e = world.spawn(new Position());
    world.spawn(new Position());
    world.despawn(e);
    assert.equal(world.query(Position).length, 1);
  });
});

describe('Systems', () => {
  let world;
  beforeEach(() => world = new World());

  it('system runs on tick', () => {
    let ran = false;
    world.addSystem(() => { ran = true; });
    world.tick();
    assert.equal(ran, true);
  });

  it('movement system', () => {
    const e = world.spawn(new Position({ x: 0, y: 0 }), new Velocity({ vx: 10, vy: 5 }));

    function movementSystem(world, dt) {
      for (const [entity, pos, vel] of world.query(Position, Velocity)) {
        pos.x += vel.vx * dt;
        pos.y += vel.vy * dt;
      }
    }

    world.addSystem(movementSystem);
    world.tick(1); // 1 second

    const pos = world.getComponent(e, Position);
    assert.equal(pos.x, 10);
    assert.equal(pos.y, 5);
  });

  it('damage system', () => {
    const Damage = defineComponent('Damage', { amount: 0 });

    const e = world.spawn(new Health({ hp: 100 }), new Damage({ amount: 30 }));

    function damageSystem(world) {
      for (const [entity, health, damage] of world.query(Health, Damage)) {
        health.hp -= damage.amount;
        world.removeComponent(entity, Damage);
      }
    }

    world.addSystem(damageSystem);
    world.tick();

    assert.equal(world.getComponent(e, Health).hp, 70);
    assert.equal(world.hasComponent(e, Damage), false);
  });

  it('multiple systems run in order', () => {
    const order = [];
    world.addSystem(() => order.push('A'));
    world.addSystem(() => order.push('B'));
    world.addSystem(() => order.push('C'));
    world.tick();
    assert.deepEqual(order, ['A', 'B', 'C']);
  });
});

describe('Resources', () => {
  it('set and get', () => {
    const world = new World();
    world.setResource('time', { elapsed: 0, delta: 0 });
    assert.equal(world.getResource('time').elapsed, 0);
  });
});

describe('defineComponent', () => {
  it('creates component with defaults', () => {
    const c = new Position();
    assert.equal(c.x, 0);
    assert.equal(c.y, 0);
  });

  it('overrides defaults', () => {
    const c = new Position({ x: 5, y: 10 });
    assert.equal(c.x, 5);
    assert.equal(c.y, 10);
  });
});

describe('Performance', () => {
  it('handles 10000 entities', () => {
    const world = new World();
    for (let i = 0; i < 10000; i++) {
      world.spawn(new Position({ x: i, y: i }), new Velocity({ vx: 1, vy: 0 }));
    }
    assert.equal(world.entityCount(), 10000);
    assert.equal(world.query(Position, Velocity).length, 10000);

    // Run movement system
    let moved = 0;
    function moveSystem(world, dt) {
      for (const [, pos, vel] of world.query(Position, Velocity)) {
        pos.x += vel.vx * dt;
        moved++;
      }
    }
    world.addSystem(moveSystem);
    world.tick(1/60);
    assert.equal(moved, 10000);
  });
});
