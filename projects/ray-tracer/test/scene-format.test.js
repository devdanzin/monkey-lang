import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadScene, Vec3, Camera, Renderer } from '../src/index.js';

describe('Scene format', () => {
  it('loads a simple scene', () => {
    const json = {
      name: 'Test Scene',
      objects: [
        { type: 'sphere', center: [0, 0, -1], radius: 0.5, material: { type: 'lambertian', color: [0.8, 0.3, 0.3] } },
        { type: 'sphere', center: [0, -100.5, -1], radius: 100, material: { type: 'lambertian', color: [0.8, 0.8, 0.0] } }
      ],
      camera: { lookFrom: [0, 0, 0], lookAt: [0, 0, -1], vfov: 90 }
    };
    const { world, name } = loadScene(json);
    assert.equal(name, 'Test Scene');
    assert.equal(world.objects.length, 2);
  });

  it('loads metal and glass', () => {
    const json = {
      objects: [
        { type: 'sphere', center: [0, 0, -1], radius: 0.5, material: { type: 'metal', color: [0.8, 0.8, 0.8], fuzz: 0.1 } },
        { type: 'sphere', center: [1, 0, -1], radius: 0.5, material: { type: 'dielectric', ior: 1.5 } }
      ]
    };
    const { world } = loadScene(json);
    assert.equal(world.objects.length, 2);
  });

  it('loads with transforms', () => {
    const json = {
      objects: [
        { type: 'box', min: [0,0,0], max: [1,1,1], material: { type: 'lambertian', color: [0.5,0.5,0.5] },
          rotate_y: 45, translate: [2, 0, 0] }
      ]
    };
    const { world } = loadScene(json);
    assert.equal(world.objects.length, 1);
  });

  it('loads emissive and textures', () => {
    const json = {
      objects: [
        { type: 'xz_rect', x0: -1, x1: 1, z0: -1, z1: 1, k: 3,
          material: { type: 'light', emit: [4, 4, 4] } },
        { type: 'sphere', center: [0, 0, 0], radius: 1,
          material: { type: 'lambertian', texture: { type: 'checker', even: [0.1,0.1,0.1], odd: [0.9,0.9,0.9] } } }
      ]
    };
    const { world } = loadScene(json);
    assert.equal(world.objects.length, 2);
  });

  it('renders a loaded scene', () => {
    const json = {
      objects: [
        { type: 'sphere', center: [0, 0, -1], radius: 0.5, material: { type: 'lambertian', color: [0.5, 0.5, 0.5] } }
      ],
      camera: { lookFrom: [0, 0, 0], lookAt: [0, 0, -1], vfov: 90, aspectRatio: 2 }
    };
    const { world, camera: camOpts } = loadScene(json);
    const cam = new Camera({ lookFrom: new Vec3(...camOpts.lookFrom), lookAt: new Vec3(...camOpts.lookAt), vfov: camOpts.vfov, aspectRatio: camOpts.aspectRatio || 2 });
    const renderer = new Renderer({ width: 4, height: 2, samplesPerPixel: 1, maxDepth: 5, camera: cam, world });
    const pixels = renderer.render();
    assert.equal(pixels.length, 4 * 2 * 4);
  });

  it('loads from JSON string', () => {
    const json = '{"name":"String Test","objects":[{"type":"sphere","center":[0,0,-1],"radius":0.5,"material":{"type":"lambertian","color":[1,0,0]}}]}';
    const { world, name } = loadScene(json);
    assert.equal(name, 'String Test');
    assert.equal(world.objects.length, 1);
  });
});
