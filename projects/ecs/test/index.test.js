import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/index.js';

describe('ECS — entities', () => {
  it('creates entity', () => {
    const w = new World();
    const e = w.createEntity();
    assert.ok(e > 0);
    assert.equal(w.hasEntity(e), true);
  });

  it('destroys entity', () => {
    const w = new World();
    const e = w.createEntity();
    w.destroyEntity(e);
    assert.equal(w.hasEntity(e), false);
  });

  it('tracks entity count', () => {
    const w = new World();
    w.createEntity(); w.createEntity();
    assert.equal(w.entityCount, 2);
  });
});

describe('ECS — components', () => {
  it('adds component', () => {
    const w = new World();
    const e = w.createEntity();
    w.addComponent(e, 'Position', { x: 10, y: 20 });
    assert.equal(w.hasComponent(e, 'Position'), true);
    assert.deepEqual(w.getComponent(e, 'Position'), { x: 10, y: 20 });
  });

  it('removes component', () => {
    const w = new World();
    const e = w.createEntity();
    w.addComponent(e, 'Health', { hp: 100 });
    w.removeComponent(e, 'Health');
    assert.equal(w.hasComponent(e, 'Health'), false);
  });

  it('multiple components on entity', () => {
    const w = new World();
    const e = w.createEntity();
    w.addComponent(e, 'Position', { x: 0, y: 0 });
    w.addComponent(e, 'Velocity', { vx: 1, vy: 2 });
    assert.deepEqual(w.getEntityComponents(e).sort(), ['Position', 'Velocity']);
  });

  it('destroying entity removes components', () => {
    const w = new World();
    const e = w.createEntity();
    w.addComponent(e, 'Tag');
    w.destroyEntity(e);
    assert.equal(w.hasComponent(e, 'Tag'), false);
  });

  it('throws on adding to nonexistent entity', () => {
    const w = new World();
    assert.throws(() => w.addComponent(999, 'Pos'));
  });
});

describe('ECS — queries', () => {
  it('finds entities with components', () => {
    const w = new World();
    const e1 = w.createEntity();
    const e2 = w.createEntity();
    const e3 = w.createEntity();
    
    w.addComponent(e1, 'Pos', { x: 0 }).addComponent(e1, 'Vel', { vx: 1 });
    w.addComponent(e2, 'Pos', { x: 5 });
    w.addComponent(e3, 'Pos', { x: 10 }).addComponent(e3, 'Vel', { vx: 2 });
    
    const movable = w.query('Pos', 'Vel');
    assert.equal(movable.length, 2);
    assert.ok(movable.includes(e1));
    assert.ok(movable.includes(e3));
  });

  it('queryWith returns data', () => {
    const w = new World();
    const e = w.createEntity();
    w.addComponent(e, 'Pos', { x: 5, y: 10 });
    
    const results = w.queryWith('Pos');
    assert.equal(results.length, 1);
    assert.equal(results[0].Pos.x, 5);
  });

  it('empty query', () => {
    const w = new World();
    assert.deepEqual(w.query('NonExistent'), []);
  });
});

describe('ECS — systems', () => {
  it('adds and runs system', () => {
    const w = new World();
    const e = w.createEntity();
    w.addComponent(e, 'Pos', { x: 0, y: 0 });
    w.addComponent(e, 'Vel', { vx: 1, vy: 2 });
    
    w.addSystem({
      update(world, dt) {
        for (const id of world.query('Pos', 'Vel')) {
          const pos = world.getComponent(id, 'Pos');
          const vel = world.getComponent(id, 'Vel');
          pos.x += vel.vx * dt;
          pos.y += vel.vy * dt;
        }
      },
    });
    
    w.update(1);
    assert.deepEqual(w.getComponent(e, 'Pos'), { x: 1, y: 2 });
    
    w.update(2);
    assert.deepEqual(w.getComponent(e, 'Pos'), { x: 3, y: 6 });
  });

  it('multiple systems run in order', () => {
    const w = new World();
    const log = [];
    w.addSystem({ update() { log.push('A'); } });
    w.addSystem({ update() { log.push('B'); } });
    w.update();
    assert.deepEqual(log, ['A', 'B']);
  });

  it('deferred destroy', () => {
    const w = new World();
    const e = w.createEntity();
    w.addComponent(e, 'Health', { hp: 0 });
    
    w.addSystem({
      update(world) {
        for (const id of world.query('Health')) {
          if (world.getComponent(id, 'Health').hp <= 0) {
            world.markForDestroy(id);
          }
        }
      },
    });
    
    w.update();
    assert.equal(w.hasEntity(e), false);
  });
});

describe('ECS — game example', () => {
  it('simple game loop', () => {
    const w = new World();
    
    // Create player
    const player = w.createEntity();
    w.addComponent(player, 'Pos', { x: 0, y: 0 });
    w.addComponent(player, 'Vel', { vx: 5, vy: 0 });
    w.addComponent(player, 'Player', {});
    
    // Create enemies
    const enemy1 = w.createEntity();
    w.addComponent(enemy1, 'Pos', { x: 100, y: 0 });
    w.addComponent(enemy1, 'Enemy', {});
    
    // Movement system
    w.addSystem({
      update(world, dt) {
        for (const id of world.query('Pos', 'Vel')) {
          const pos = world.getComponent(id, 'Pos');
          const vel = world.getComponent(id, 'Vel');
          pos.x += vel.vx * dt;
          pos.y += vel.vy * dt;
        }
      },
    });
    
    // Run 10 frames
    for (let i = 0; i < 10; i++) w.update(1);
    
    assert.equal(w.getComponent(player, 'Pos').x, 50);
    assert.equal(w.query('Player').length, 1);
    assert.equal(w.query('Enemy').length, 1);
  });
});
