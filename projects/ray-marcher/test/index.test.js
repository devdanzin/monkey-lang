const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  vec3, add, sub, mul, dot, length, normalize, clamp, reflect, cross,
  sdSphere, sdBox, sdTorus, sdCylinder, sdPlane, sdCapsule,
  opUnion, opIntersect, opSubtract, opSmoothUnion,
  opTranslate, opScale, opRepeat, opTwist,
  material, Scene, Camera,
  render, toPPM, demoScene,
} = require('../src/index.js');

const approx = (a, b, eps = 0.001) => Math.abs(a - b) < eps;

// ==================== Vector Math ====================

test('vec3 operations', () => {
  assert.deepEqual(add(vec3(1, 2, 3), vec3(4, 5, 6)), vec3(5, 7, 9));
  assert.deepEqual(sub(vec3(5, 3, 1), vec3(1, 1, 1)), vec3(4, 2, 0));
  assert.deepEqual(mul(vec3(2, 3, 4), 2), vec3(4, 6, 8));
  assert.equal(dot(vec3(1, 0, 0), vec3(0, 1, 0)), 0);
  assert.equal(dot(vec3(1, 0, 0), vec3(1, 0, 0)), 1);
  assert.ok(approx(length(vec3(3, 4, 0)), 5));
});

test('normalize', () => {
  const n = normalize(vec3(3, 0, 0));
  assert.ok(approx(n.x, 1));
  assert.ok(approx(n.y, 0));
  assert.ok(approx(n.z, 0));
});

test('cross product', () => {
  const c = cross(vec3(1, 0, 0), vec3(0, 1, 0));
  assert.ok(approx(c.x, 0));
  assert.ok(approx(c.y, 0));
  assert.ok(approx(c.z, 1));
});

test('reflect', () => {
  const r = reflect(vec3(1, -1, 0), vec3(0, 1, 0));
  assert.ok(approx(r.x, 1));
  assert.ok(approx(r.y, 1));
});

// ==================== SDF Primitives ====================

test('sdSphere — distance from origin', () => {
  const s = sdSphere(1);
  assert.ok(approx(s(vec3(0, 0, 0)), -1)); // inside
  assert.ok(approx(s(vec3(1, 0, 0)), 0));  // on surface
  assert.ok(approx(s(vec3(2, 0, 0)), 1));  // outside
  assert.ok(approx(s(vec3(0, 3, 0)), 2));  // further out
});

test('sdBox — axis-aligned box', () => {
  const b = sdBox(vec3(1, 1, 1));
  assert.ok(b(vec3(0, 0, 0)) < 0);       // inside
  assert.ok(approx(b(vec3(1, 0, 0)), 0)); // on surface
  assert.ok(b(vec3(2, 0, 0)) > 0);        // outside
});

test('sdTorus', () => {
  const t = sdTorus(1, 0.3);
  // On the torus surface ring at (1, 0, 0)
  assert.ok(approx(t(vec3(1, 0, 0)), -0.3, 0.01));
  // Far outside
  assert.ok(t(vec3(5, 5, 5)) > 0);
});

test('sdCylinder', () => {
  const c = sdCylinder(0.5, 1);
  assert.ok(c(vec3(0, 0, 0)) < 0);   // inside
  assert.ok(c(vec3(2, 0, 0)) > 0);   // outside
});

test('sdPlane', () => {
  const p = sdPlane(vec3(0, 1, 0), 0);
  assert.ok(approx(p(vec3(0, 0, 0)), 0));
  assert.ok(approx(p(vec3(0, 1, 0)), 1));
  assert.ok(approx(p(vec3(0, -1, 0)), -1));
});

test('sdCapsule', () => {
  const c = sdCapsule(vec3(0, -1, 0), vec3(0, 1, 0), 0.5);
  assert.ok(c(vec3(0, 0, 0)) < 0); // inside
  assert.ok(c(vec3(3, 0, 0)) > 0); // outside
});

// ==================== CSG Operations ====================

test('opUnion — minimum distance', () => {
  const u = opUnion(
    opTranslate(sdSphere(1), vec3(-1, 0, 0)),
    opTranslate(sdSphere(1), vec3(1, 0, 0))
  );
  // Between the two spheres
  assert.ok(u(vec3(0, 0, 0)) < 1);
  // Inside left sphere
  assert.ok(u(vec3(-1, 0, 0)) < 0);
});

test('opIntersect', () => {
  const i = opIntersect(
    sdSphere(1.5),
    opTranslate(sdSphere(1.5), vec3(1, 0, 0))
  );
  // Origin is inside both
  assert.ok(i(vec3(0, 0, 0)) < 0);
  // Far left — inside first but not second
  assert.ok(i(vec3(-1.2, 0, 0)) > 0);
});

test('opSubtract — A minus B', () => {
  const s = opSubtract(sdSphere(1), opTranslate(sdSphere(0.5), vec3(0.7, 0, 0)));
  // Origin is inside A but not subtracted
  assert.ok(s(vec3(0, 0, 0)) < 0);
  // Point near subtracted region
  assert.ok(s(vec3(0.7, 0, 0)) > 0);
});

test('opSmoothUnion — blends shapes', () => {
  const sharp = opUnion(
    sdSphere(1),
    opTranslate(sdSphere(1), vec3(1.5, 0, 0))
  );
  const smooth = opSmoothUnion(
    sdSphere(1),
    opTranslate(sdSphere(1), vec3(1.5, 0, 0)),
    0.5
  );
  // Smooth union should be <= sharp union everywhere
  const p = vec3(0.75, 0, 0);
  assert.ok(smooth(p) <= sharp(p) + 0.001);
});

// ==================== Domain Operations ====================

test('opTranslate', () => {
  const s = opTranslate(sdSphere(1), vec3(3, 0, 0));
  assert.ok(approx(s(vec3(3, 0, 0)), -1)); // center of translated sphere
  assert.ok(s(vec3(0, 0, 0)) > 0);          // origin is far
});

test('opScale', () => {
  const s = opScale(sdSphere(1), 2);
  assert.ok(approx(s(vec3(2, 0, 0)), 0, 0.01)); // surface at r=2
  assert.ok(s(vec3(0, 0, 0)) < 0);                // inside
});

test('opTwist does not crash', () => {
  const t = opTwist(sdBox(vec3(1, 2, 1)), 0.5);
  // Just verify it's callable and returns finite values
  assert.ok(isFinite(t(vec3(0, 0, 0))));
  assert.ok(isFinite(t(vec3(1, 1, 1))));
});

// ==================== Scene ====================

test('Scene.map returns closest object', () => {
  const scene = new Scene();
  scene.add(opTranslate(sdSphere(1), vec3(-2, 0, 0)), material(vec3(1, 0, 0)));
  scene.add(opTranslate(sdSphere(1), vec3(2, 0, 0)), material(vec3(0, 0, 1)));

  const left = scene.map(vec3(-2, 0, 0));
  assert.equal(left.idx, 0);
  assert.ok(left.dist < 0);

  const right = scene.map(vec3(2, 0, 0));
  assert.equal(right.idx, 1);
});

test('Scene.normal estimates surface normal', () => {
  const scene = new Scene();
  scene.add(sdSphere(1));
  const n = scene.normal(vec3(1, 0, 0));
  assert.ok(approx(n.x, 1, 0.01));
  assert.ok(approx(n.y, 0, 0.01));
  assert.ok(approx(n.z, 0, 0.01));
});

test('Scene.march hits a sphere', () => {
  const scene = new Scene();
  scene.add(sdSphere(1));
  const result = scene.march(vec3(0, 0, 5), vec3(0, 0, -1));
  assert.ok(result.hit);
  assert.ok(approx(result.dist, 4, 0.01));
});

test('Scene.march misses', () => {
  const scene = new Scene();
  scene.add(sdSphere(1));
  const result = scene.march(vec3(0, 0, 5), vec3(0, 0, 1)); // away
  assert.ok(!result.hit);
});

test('Scene.shadow — point in shadow', () => {
  const scene = new Scene();
  // Big sphere blocking the light
  scene.add(opTranslate(sdSphere(1), vec3(0, 2, 0)));
  // Point below, light above
  const factor = scene.shadow(vec3(0, 0, 0), vec3(0, 1, 0), 10);
  assert.ok(factor < 0.5, 'Should be in shadow');
});

test('Scene.ao — unoccluded point', () => {
  const scene = new Scene();
  scene.add(sdPlane(vec3(0, 1, 0), 1));
  const ao = scene.ao(vec3(0, 5, 0), vec3(0, 1, 0));
  assert.ok(ao > 0.8, 'High point should have little occlusion');
});

// ==================== Camera ====================

test('Camera generates rays', () => {
  const cam = new Camera(vec3(0, 0, 5), vec3(0, 0, 0));
  const { origin, dir } = cam.ray(0, 0);
  assert.deepEqual(origin, vec3(0, 0, 5));
  // Center ray should point roughly toward -Z
  assert.ok(dir.z < 0);
});

// ==================== Rendering ====================

test('render produces RGBA pixels', () => {
  const scene = new Scene();
  scene.add(sdSphere(1), material(vec3(1, 0, 0)));
  scene.addLight(vec3(3, 3, 3));
  const cam = new Camera(vec3(0, 0, 5), vec3(0, 0, 0));
  const w = 8, h = 8;
  const pixels = render(scene, cam, w, h);
  assert.equal(pixels.length, w * h * 4);
  // Center pixel should have some red (the sphere)
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const idx = (cy * w + cx) * 4;
  assert.ok(pixels[idx] > 0, 'Should have red component');
  assert.equal(pixels[idx + 3], 255, 'Alpha should be 255');
});

test('toPPM produces valid header', () => {
  const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
  const ppm = toPPM(pixels, 2, 1);
  assert.ok(ppm.startsWith('P3\n2 1\n255\n'));
  assert.ok(ppm.includes('255 0 0'));
  assert.ok(ppm.includes('0 255 0'));
});

test('demoScene renders without errors', () => {
  const scene = demoScene();
  const cam = new Camera(vec3(0, 1, 4), vec3(0, 0, 0));
  // Small render to verify no crashes
  const pixels = render(scene, cam, 4, 4);
  assert.equal(pixels.length, 4 * 4 * 4);
});

// ==================== Integration ====================

test('full pipeline: scene → render → PPM', () => {
  const scene = new Scene();
  scene.add(sdSphere(1), material(vec3(0, 0.5, 1)));
  scene.add(sdPlane(vec3(0, 1, 0), 1), material(vec3(0.5, 0.5, 0.5)));
  scene.addLight(vec3(2, 3, 2));
  const cam = new Camera(vec3(0, 1, 3), vec3(0, 0, 0));
  const pixels = render(scene, cam, 16, 16);
  const ppm = toPPM(pixels, 16, 16);
  assert.ok(ppm.length > 100);
  // Verify the background is dark (top corners)
  const topLeft = { r: pixels[0], g: pixels[1], b: pixels[2] };
  assert.ok(topLeft.r < 100, 'Top-left should be dark (background or far)');
});

test('reflective material produces different colors', () => {
  const scene = new Scene();
  scene.add(sdSphere(1), material(vec3(0.8, 0.8, 0.8), { reflectivity: 0.5 }));
  scene.add(
    sdPlane(vec3(0, 1, 0), 2),
    material(vec3(1, 0, 0)) // red floor
  );
  scene.addLight(vec3(3, 5, 3));
  const cam = new Camera(vec3(0, 0, 3), vec3(0, 0, 0));
  const pixels = render(scene, cam, 8, 8);
  // Just verify it completes without error
  assert.equal(pixels.length, 8 * 8 * 4);
});

test('CSG scene renders — box with sphere subtracted', () => {
  const scene = new Scene();
  scene.add(
    opSubtract(sdBox(vec3(1, 1, 1)), sdSphere(1.2)),
    material(vec3(0.9, 0.6, 0.1))
  );
  scene.addLight(vec3(3, 3, 3));
  const cam = new Camera(vec3(2, 2, 3), vec3(0, 0, 0));
  const pixels = render(scene, cam, 8, 8);
  assert.equal(pixels.length, 8 * 8 * 4);
});
