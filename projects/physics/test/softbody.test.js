const { test, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Vec2, Body, World, SpringConstraint, SoftBody, ClothGrid } = require('../src/index.js');

describe('SoftBody', () => {
  it('should create particles and springs', () => {
    const world = new World();
    const positions = [
      new Vec2(0, 0), new Vec2(10, 0), new Vec2(10, 10), new Vec2(0, 10),
    ];
    const soft = new SoftBody(world, positions, {
      connections: [[0, 1], [1, 2], [2, 3], [3, 0]],
    });
    assert.equal(soft.particles.length, 4);
    assert.equal(soft.springs.length, 4);
  });

  it('should auto-connect as ring when no connections given', () => {
    const world = new World();
    const positions = [new Vec2(0, 0), new Vec2(10, 0), new Vec2(5, 10)];
    const soft = new SoftBody(world, positions);
    assert.equal(soft.springs.length, 3); // triangle
  });

  it('should compute centroid', () => {
    const world = new World();
    const positions = [
      new Vec2(0, 0), new Vec2(10, 0), new Vec2(10, 10), new Vec2(0, 10),
    ];
    const soft = new SoftBody(world, positions);
    const c = soft.centroid;
    assert.ok(Math.abs(c.x - 5) < 0.01);
    assert.ok(Math.abs(c.y - 5) < 0.01);
  });

  it('should compute area', () => {
    const world = new World();
    const positions = [
      new Vec2(0, 0), new Vec2(10, 0), new Vec2(10, 10), new Vec2(0, 10),
    ];
    const soft = new SoftBody(world, positions);
    assert.ok(Math.abs(soft.area - 100) < 0.01);
  });

  it('circle should create ring of particles', () => {
    const world = new World();
    const soft = SoftBody.circle(world, new Vec2(0, 0), 20, 8);
    assert.equal(soft.particles.length, 8);
    assert.ok(soft.springs.length >= 8); // ring + bracing
  });

  it('should apply pressure forces', () => {
    const world = new World({ gravity: new Vec2(0, 0) });
    const soft = SoftBody.circle(world, new Vec2(0, 0), 20, 8, { pressure: 50 });

    // Record positions before
    const posBefore = soft.particles.map(p => p.position.x + p.position.y);

    soft.applyPressure();
    world.step(1/60);

    // Positions should change (pressure pushes outward)
    let changed = false;
    for (let i = 0; i < soft.particles.length; i++) {
      const posAfter = soft.particles[i].position.x + soft.particles[i].position.y;
      if (Math.abs(posAfter - posBefore[i]) > 0.001) changed = true;
    }
    assert.ok(changed, 'Pressure should move particles');
  });
});

describe('ClothGrid', () => {
  it('should create grid of particles', () => {
    const world = new World();
    const cloth = new ClothGrid(world, new Vec2(0, 0), 5, 4, 10);
    assert.equal(cloth.cols, 5);
    assert.equal(cloth.rows, 4);
    assert.equal(cloth.allParticles.length, 20);
  });

  it('should create structural springs', () => {
    const world = new World();
    const cloth = new ClothGrid(world, new Vec2(0, 0), 3, 3, 10, {
      shear: false, bend: false,
    });
    // 3×3 grid: horizontal = 2*3 = 6, vertical = 3*2 = 6 → 12
    assert.equal(cloth.springCount, 12);
  });

  it('should add shear springs', () => {
    const world = new World();
    const clothNoShear = new ClothGrid(world, new Vec2(0, 0), 3, 3, 10, {
      shear: false, bend: false,
    });
    const world2 = new World();
    const clothShear = new ClothGrid(world2, new Vec2(0, 0), 3, 3, 10, {
      shear: true, bend: false,
    });
    assert.ok(clothShear.springCount > clothNoShear.springCount);
  });

  it('should add bend springs', () => {
    const world = new World();
    const clothNoBend = new ClothGrid(world, new Vec2(0, 0), 4, 4, 10, {
      shear: false, bend: false,
    });
    const world2 = new World();
    const clothBend = new ClothGrid(world2, new Vec2(0, 0), 4, 4, 10, {
      shear: false, bend: true,
    });
    assert.ok(clothBend.springCount > clothNoBend.springCount);
  });

  it('should pin top row', () => {
    const world = new World();
    const cloth = new ClothGrid(world, new Vec2(0, 0), 4, 3, 10);
    cloth.pinTop();
    for (let c = 0; c < 4; c++) {
      assert.ok(cloth.at(0, c).isStatic, `Top row col ${c} should be static`);
    }
    // Other rows should not be static
    assert.ok(!cloth.at(1, 0).isStatic);
  });

  it('should pin corners', () => {
    const world = new World();
    const cloth = new ClothGrid(world, new Vec2(0, 0), 5, 4, 10);
    cloth.pinCorners();
    assert.ok(cloth.at(0, 0).isStatic);
    assert.ok(cloth.at(0, 4).isStatic);
    assert.ok(!cloth.at(0, 2).isStatic);
  });

  it('should simulate draping under gravity', () => {
    const world = new World({ gravity: new Vec2(0, 10) });
    const cloth = new ClothGrid(world, new Vec2(0, 0), 4, 4, 10, {
      mass: 1, stiffness: 100, damping: 5,
    });
    cloth.pinTop();

    const bottomRow = [];
    for (let c = 0; c < 4; c++) {
      bottomRow.push(cloth.at(3, c).position.y);
    }

    // Simulate
    for (let i = 0; i < 60; i++) world.step(1/60);

    // Bottom row should have moved down
    for (let c = 0; c < 4; c++) {
      const newY = cloth.at(3, c).position.y;
      assert.ok(newY > bottomRow[c], `Bottom row should fall: ${bottomRow[c]} → ${newY}`);
    }
  });

  it('should access particles by grid position', () => {
    const world = new World();
    const cloth = new ClothGrid(world, new Vec2(0, 0), 3, 3, 10);
    const p = cloth.at(1, 2);
    assert.ok(p !== null);
    assert.ok(Math.abs(p.position.x - 20) < 0.01);
    assert.ok(Math.abs(p.position.y - 10) < 0.01);
  });

  it('should return null for out-of-bounds', () => {
    const world = new World();
    const cloth = new ClothGrid(world, new Vec2(0, 0), 3, 3, 10);
    assert.equal(cloth.at(5, 5), null);
  });
});
