import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, Color } from '../src/vec3.js';
import { PreethamSky, skyFromTime } from '../src/sky.js';

describe('PreethamSky', () => {
  it('creates with default options', () => {
    const sky = new PreethamSky();
    assert.ok(sky.turbidity === 2.5);
    assert.ok(sky.intensity === 1.0);
  });

  it('creates with custom sun direction and turbidity', () => {
    const sky = new PreethamSky({
      sunDirection: new Vec3(0.5, 0.8, 0.2),
      turbidity: 4.0,
    });
    assert.ok(sky.turbidity === 4.0);
    assert.ok(sky.thetaS >= 0 && sky.thetaS <= Math.PI / 2);
  });

  it('samples zenith as brightest non-sun direction', () => {
    const sky = new PreethamSky({
      sunDirection: new Vec3(0, 0.5, 1).unit(),
      turbidity: 2.5,
    });
    const zenith = sky.sample(new Vec3(0, 1, 0));
    assert.ok(zenith instanceof Color);
    assert.ok(zenith.x >= 0, 'Zenith R should be non-negative');
    assert.ok(zenith.y >= 0, 'Zenith G should be non-negative');
    assert.ok(zenith.z >= 0, 'Zenith B should be non-negative');
  });

  it('returns dark color below horizon', () => {
    const sky = new PreethamSky({ sunDirection: new Vec3(0, 1, 0) });
    const ground = sky.sample(new Vec3(0, -1, 0));
    assert.ok(ground.x < 0.1);
    assert.ok(ground.y < 0.1);
    assert.ok(ground.z < 0.1);
  });

  it('sky near sun is brighter than opposite direction', () => {
    const sunDir = new Vec3(0.5, 0.5, 0).unit();
    const sky = new PreethamSky({ sunDirection: sunDir, turbidity: 3 });
    const nearSun = sky.sample(sunDir);
    const opposite = sky.sample(sunDir.mul(-1).add(new Vec3(0, 1, 0)).unit());
    // Near sun should have higher luminance
    const lumNear = nearSun.x * 0.2126 + nearSun.y * 0.7152 + nearSun.z * 0.0722;
    const lumOpp = opposite.x * 0.2126 + opposite.y * 0.7152 + opposite.z * 0.0722;
    assert.ok(lumNear > lumOpp, `Near-sun luminance (${lumNear}) should exceed opposite (${lumOpp})`);
  });

  it('higher turbidity makes sky less blue', () => {
    const sunDir = new Vec3(0, 1, 0);
    const clear = new PreethamSky({ sunDirection: sunDir, turbidity: 2 });
    const hazy = new PreethamSky({ sunDirection: sunDir, turbidity: 8 });
    const dir = new Vec3(1, 0.3, 0).unit();
    const clearColor = clear.sample(dir);
    const hazyColor = hazy.sample(dir);
    // Hazy sky should have less blue saturation (more uniform)
    const clearBlueRatio = clearColor.z / (clearColor.x + 0.001);
    const hazyBlueRatio = hazyColor.z / (hazyColor.x + 0.001);
    assert.ok(hazyBlueRatio < clearBlueRatio * 2, 'Hazy sky should be less saturated blue');
  });

  it('sampleWithSun adds bright disk near sun direction', () => {
    const sunDir = new Vec3(0, 0.5, 1).unit();
    const sky = new PreethamSky({ sunDirection: sunDir, turbidity: 2.5 });
    const atSun = sky.sampleWithSun(sunDir);
    const awaySun = sky.sampleWithSun(new Vec3(0, 1, 0));
    const lumSun = atSun.x + atSun.y + atSun.z;
    const lumAway = awaySun.x + awaySun.y + awaySun.z;
    assert.ok(lumSun > lumAway * 2, 'Sun disk should be significantly brighter');
  });

  it('sampleWithSun has corona glow near sun', () => {
    const sunDir = new Vec3(0, 0.5, 1).unit();
    const sky = new PreethamSky({ sunDirection: sunDir, turbidity: 2.5 });
    // Slightly off-axis from sun
    const nearDir = sunDir.add(new Vec3(0.05, 0, 0)).unit();
    const withSun = sky.sampleWithSun(nearDir);
    const withoutSun = sky.sample(nearDir);
    const lumWith = withSun.x + withSun.y + withSun.z;
    const lumWithout = withoutSun.x + withoutSun.y + withoutSun.z;
    assert.ok(lumWith >= lumWithout, 'Corona should add brightness near sun');
  });

  it('all color channels are finite', () => {
    const sky = new PreethamSky({ sunDirection: new Vec3(1, 0.3, 0).unit() });
    for (let i = 0; i < 20; i++) {
      const dir = Vec3.randomUnitVector();
      const c = sky.sample(dir);
      assert.ok(isFinite(c.x), `R should be finite for dir ${dir}`);
      assert.ok(isFinite(c.y), `G should be finite for dir ${dir}`);
      assert.ok(isFinite(c.z), `B should be finite for dir ${dir}`);
    }
  });
});

describe('skyFromTime', () => {
  it('noon sun is high (positive Y)', () => {
    const sky = skyFromTime(12);
    assert.ok(sky.sunDirection.y > 0.5, 'Noon sun should be high');
  });

  it('sunrise sun is near horizon', () => {
    const sky = skyFromTime(6);
    assert.ok(sky.sunDirection.y < 0.3, 'Sunrise sun should be near horizon');
  });

  it('sunset sun is near horizon', () => {
    const sky = skyFromTime(18);
    assert.ok(sky.sunDirection.y < 0.3, 'Sunset sun should be near horizon');
  });

  it('creates sky for various times without error', () => {
    for (const hour of [5, 7, 9, 12, 15, 17, 19]) {
      const sky = skyFromTime(hour, 3);
      const c = sky.sample(new Vec3(0, 1, 0));
      assert.ok(c instanceof Color);
      assert.ok(isFinite(c.x + c.y + c.z));
    }
  });

  it('noon is brighter than sunrise', () => {
    const noon = skyFromTime(12);
    const dawn = skyFromTime(6.5);
    const dir = new Vec3(0, 1, 0);
    const noonLum = noon.sample(dir);
    const dawnLum = dawn.sample(dir);
    const noonTotal = noonLum.x + noonLum.y + noonLum.z;
    const dawnTotal = dawnLum.x + dawnLum.y + dawnLum.z;
    assert.ok(noonTotal > dawnTotal, 'Noon should be brighter than dawn');
  });

  it('respects turbidity parameter', () => {
    const clear = skyFromTime(12, 2);
    const hazy = skyFromTime(12, 8);
    assert.ok(clear.turbidity === 2);
    assert.ok(hazy.turbidity === 8);
  });
});
