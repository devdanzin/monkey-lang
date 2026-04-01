import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  Vec3, Color, Camera, Renderer, HittableList,
  Sphere, XZRect, YZRect,
  Lambertian, Metal, Dielectric, DiffuseLight,
  ImageTexture, CheckerTexture, NoiseTexture, MarbleTexture,
  MovingSphere, ConstantMedium,
  PreethamSky, skyFromTime,
} from '../src/index.js';
import { Triangle } from '../src/triangle.js';

describe('Showcase scene integration', () => {
  it('renders without errors', () => {
    const world = new HittableList();
    const lights = [];

    // Checker floor
    world.add(new XZRect(-5, 5, -5, 5, 0, 
      new Lambertian(new CheckerTexture(new Color(0.2, 0.3, 0.1), new Color(0.9, 0.9, 0.9)))));

    // Area light
    const light = new XZRect(-1, 1, -1, 1, 5, new DiffuseLight(new Color(10, 10, 10)));
    world.add(light);
    lights.push(light);

    // Image textured sphere
    const imgData = new Uint8Array(4 * 2 * 3);
    for (let i = 0; i < imgData.length; i++) imgData[i] = Math.floor(Math.random() * 256);
    world.add(new Sphere(new Vec3(0, 1, 0), 1, new Lambertian(new ImageTexture(imgData, 4, 2))));

    // Marble sphere
    world.add(new Sphere(new Vec3(-3, 1, 0), 1, new Lambertian(new MarbleTexture())));

    // Metal sphere
    world.add(new Sphere(new Vec3(3, 1, 0), 1, new Metal(new Color(0.8, 0.6, 0.2), 0.1)));

    // Motion blur sphere
    world.add(new MovingSphere(new Vec3(0, 1, 3), new Vec3(0, 2, 3), 0, 1, 0.5,
      new Lambertian(new Color(0.9, 0.2, 0.2))));

    // Volume
    world.add(new ConstantMedium(
      new Sphere(new Vec3(0, 2, -3), 2, new Dielectric(1.5)),
      0.1, new Color(0.8, 0.8, 1.0)));

    const camera = new Camera({
      lookFrom: new Vec3(0, 4, 10),
      lookAt: new Vec3(0, 1, 0),
      vUp: new Vec3(0, 1, 0),
      vfov: 40, aspectRatio: 2,
    });

    const renderer = new Renderer({
      width: 8, height: 4, samplesPerPixel: 2, maxDepth: 5,
      camera, world, lights,
      background: new Color(0.01, 0.01, 0.02),
    });

    const pixels = renderer.render();
    assert.ok(pixels instanceof Uint8ClampedArray);
    assert.equal(pixels.length, 8 * 4 * 4);
    
    // At least some non-black pixels
    let hasColor = false;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 0 || pixels[i+1] > 0 || pixels[i+2] > 0) {
        hasColor = true;
        break;
      }
    }
    assert.ok(hasColor, 'Scene should produce some non-black pixels');
  });

  it('all feature combinations render safely', () => {
    const world = new HittableList();
    
    // Noise + glass + motion = complex interaction
    world.add(new MovingSphere(
      new Vec3(0, 1, 0), new Vec3(0, 2, 0), 0, 1, 1,
      new Lambertian(new NoiseTexture(new Color(1, 1, 1), 4))));
    world.add(new Sphere(new Vec3(2, 1, 0), 1, new Dielectric(1.5)));
    
    const light = new XZRect(-2, 2, -2, 2, 5, new DiffuseLight(new Color(5, 5, 5)));
    world.add(light);

    const camera = new Camera({
      lookFrom: new Vec3(0, 3, 8),
      lookAt: new Vec3(0, 1, 0),
      vUp: new Vec3(0, 1, 0),
      vfov: 40, aspectRatio: 2,
    });

    const renderer = new Renderer({
      width: 4, height: 2, samplesPerPixel: 2, maxDepth: 4,
      camera, world, lights: [light],
      background: new Color(0, 0, 0),
    });

    const pixels = renderer.render();
    assert.ok(pixels.length > 0);
  });

  it('Preetham sky scene renders correctly', () => {
    const world = new HittableList();

    // Reflective ground plane
    world.add(new XZRect(-10, 10, -10, 10, 0,
      new Metal(new Color(0.5, 0.5, 0.5), 0.3)));

    // Glass sphere reflecting the sky
    world.add(new Sphere(new Vec3(0, 1.5, 0), 1.5, new Dielectric(1.5)));

    // Metal spheres
    world.add(new Sphere(new Vec3(-3, 1, 2), 1, new Metal(new Color(0.8, 0.2, 0.2), 0.05)));
    world.add(new Sphere(new Vec3(3, 1, 2), 1, new Metal(new Color(0.2, 0.2, 0.8), 0.05)));

    // Marble sphere
    world.add(new Sphere(new Vec3(0, 0.7, 3), 0.7, new Lambertian(new MarbleTexture())));

    const sky = skyFromTime(10, 2.5); // 10 AM, clear sky

    const camera = new Camera({
      lookFrom: new Vec3(0, 3, 8),
      lookAt: new Vec3(0, 1, 0),
      vUp: new Vec3(0, 1, 0),
      vfov: 50, aspectRatio: 2,
    });

    const renderer = new Renderer({
      width: 8, height: 4, samplesPerPixel: 2, maxDepth: 5,
      camera, world, lights: [],
      backgroundFn: (ray) => sky.sampleWithSun(ray.direction),
    });

    const pixels = renderer.render();
    assert.ok(pixels instanceof Uint8ClampedArray);
    assert.equal(pixels.length, 8 * 4 * 4);

    // Sky scene should have color variety
    let hasBlue = false, hasNonBlack = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 2] > 50) hasBlue = true;
      if (pixels[i] > 5 || pixels[i + 1] > 5 || pixels[i + 2] > 5) hasNonBlack++;
    }
    assert.ok(hasNonBlack > 0, 'Sky scene should have non-black pixels');
  });

  it('sunset scene with smooth-normal triangle', () => {
    const world = new HittableList();

    // Ground
    world.add(new XZRect(-5, 5, -5, 5, 0,
      new Lambertian(new CheckerTexture(new Color(0.1, 0.1, 0.1), new Color(0.3, 0.3, 0.3)))));

    // Triangle with smooth normals
    const triMat = new Lambertian(new Color(0.8, 0.6, 0.3));
    world.add(new Triangle(
      new Vec3(-1, 0, 0), new Vec3(1, 0, 0), new Vec3(0, 2, 0),
      triMat,
      { normals: [new Vec3(-0.3, 0, 1).unit(), new Vec3(0.3, 0, 1).unit(), new Vec3(0, 0.3, 1).unit()] }
    ));

    const sky = skyFromTime(18.5, 3); // Sunset, slightly hazy

    const camera = new Camera({
      lookFrom: new Vec3(0, 2, 5),
      lookAt: new Vec3(0, 1, 0),
      vUp: new Vec3(0, 1, 0),
      vfov: 40, aspectRatio: 2,
    });

    const renderer = new Renderer({
      width: 4, height: 2, samplesPerPixel: 2, maxDepth: 4,
      camera, world, lights: [],
      backgroundFn: (ray) => sky.sample(ray.direction),
    });

    const pixels = renderer.render();
    assert.ok(pixels.length > 0, 'Sunset scene should render');
  });
});
