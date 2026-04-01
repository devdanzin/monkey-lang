// tile-worker.js — Renders a tile (rectangular region) of the image
importScripts('bundle.js');

// Access everything via RT to avoid redeclaring class bindings from bundle.js
const RT = self.RayTracer;

self.onmessage = function(e) {
  const { tile, config } = e.data;
  const { width, height, samplesPerPixel, maxDepth, scene, cameraConfig, background, renderMode, bgMode, skyHour, skyTurbidity } = config;
  const { x0, y0, x1, y1, tileId } = tile;

  // Notify main thread that we're building the scene
  self.postMessage({ building: true, tileId: tile.tileId });

  // Build scene (each worker builds its own — no shared state needed)
  let world;
  if (scene === 'random') world = RT.createRandomScene();
  else if (scene === 'cornell') world = RT.createCornellBox();
  else if (scene === 'glass') world = RT.createGlassStudy();
  else if (scene === 'metal') world = RT.createMetalShowcase();
  else if (scene === 'lit') world = RT.createLitRoom();
  else if (scene === 'textured') world = RT.createTexturedWorld();
  else if (scene === 'smoky') world = RT.createSmokyCornell();
  else if (scene === 'solar') world = RT.createSolarSystem();
  else if (scene === 'showcase') world = RT.createShowcase();
  else if (scene === 'motion') world = RT.createMotionBlur();
  else if (scene === 'final') world = RT.createFinalScene();
  else if (scene === 'museum') world = RT.createMuseum();
  else if (scene === 'sunset') world = RT.createSimpleScene();
  else if (scene === 'preetham') world = createPreethamSceneTile();
  else world = RT.createSimpleScene();

  let sceneHit;
  if (world.objects && world.objects.length > 4) {
    sceneHit = new RT.BVHNode([...world.objects]);
  } else {
    sceneHit = world;
  }

  const cam = new RT.Camera(cameraConfig);
  const bg = background ? new RT.Vec3(background.x, background.y, background.z) : null;

  // Build Preetham sky function if needed
  let preethamFn = null;
  if (bgMode === 'preetham') {
    preethamFn = createPreethamBgFnTile(skyHour || 10, skyTurbidity || 2.5);
  }

  const tileW = x1 - x0;
  const tileH = y1 - y0;
  const pixels = new Uint8ClampedArray(tileW * tileH * 4);

  for (let py = y0; py < y1; py++) {
    const j = height - 1 - py; // Flip y (image coords are top-down)
    for (let px = x0; px < x1; px++) {
      let r = 0, g = 0, b = 0;

      for (let s = 0; s < samplesPerPixel; s++) {
        const u = (px + Math.random()) / (width - 1);
        const v = (j + Math.random()) / (height - 1);
        const ray = cam.getRay(u, v);

        let color;
        if (renderMode === 'normals') {
          const rec = sceneHit.hit(ray, 0.001, Infinity);
          if (rec) {
            const n = rec.normal;
            color = new RT.Vec3((n.x+1)*0.5, (n.y+1)*0.5, (n.z+1)*0.5);
          } else {
            color = new RT.Vec3(0, 0, 0);
          }
        } else if (renderMode === 'depth') {
          const rec = sceneHit.hit(ray, 0.001, Infinity);
          if (rec) {
            const d = 1 - Math.min(rec.t / 20, 1);
            color = new RT.Vec3(d, d, d);
          } else {
            color = new RT.Vec3(0.5, 0.7, 1.0);
          }
        } else if (renderMode === 'flat') {
          const rec = sceneHit.hit(ray, 0.001, Infinity);
          if (rec && rec.material.texture) {
            color = rec.material.texture.value(0, 0, rec.p);
          } else if (rec && rec.material.albedo) {
            color = rec.material.albedo;
          } else if (rec && rec.material.emit) {
            color = rec.material.emit;
          } else if (!rec) {
            if (bg) color = bg;
            else {
              const ud = ray.direction.unit();
              const t = 0.5 * (ud.y + 1.0);
              color = new RT.Vec3(1,1,1).mul(1-t).add(new RT.Vec3(0.5,0.7,1.0).mul(t));
            }
          } else {
            color = new RT.Vec3(0.5, 0.5, 0.5);
          }
        } else {
          color = rayColor(ray, sceneHit, maxDepth, bg, bgMode, preethamFn);
        }
        r += color.x; g += color.y; b += color.z;
      }

      const scale = 1.0 / samplesPerPixel;
      const idx = ((py - y0) * tileW + (px - x0)) * 4;
      pixels[idx]     = Math.floor(256 * Math.max(0, Math.min(0.999, Math.sqrt(r * scale))));
      pixels[idx + 1] = Math.floor(256 * Math.max(0, Math.min(0.999, Math.sqrt(g * scale))));
      pixels[idx + 2] = Math.floor(256 * Math.max(0, Math.min(0.999, Math.sqrt(b * scale))));
      pixels[idx + 3] = 255;
    }
  }

  self.postMessage({ tileId, x0, y0, tileW, tileH, pixels });
};

function rayColor(ray, world, depth, bg, bgMode, preethamFn) {
  if (depth <= 0) return new RT.Vec3(0, 0, 0);
  const rec = world.hit(ray, 0.001, Infinity);
  if (rec) {
    const emitted = rec.material.emitted
      ? rec.material.emitted(0, 0, rec.p)
      : new RT.Vec3(0, 0, 0);
    const result = rec.material.scatter(ray, rec);
    if (result) return emitted.add(rayColor(result.scattered, world, depth - 1, bg, bgMode, preethamFn).mul(result.attenuation));
    return emitted;
  }
  // Environment background
  if (preethamFn) return preethamFn(ray);
  if (bgMode === 'sunset') {
    const ud = ray.direction.unit();
    const t = 0.5 * (ud.y + 1.0);
    if (t < 0.35) return new RT.Vec3(0.05, 0.05, 0.08);
    if (t < 0.5) { const h = (t-0.35)/0.15; return new RT.Vec3(0.1+h*0.8, 0.05+h*0.35, 0.05+h*0.05); }
    if (t < 0.7) { const h = (t-0.5)/0.2; return new RT.Vec3(0.9-h*0.6, 0.4-h*0.2, 0.1+h*0.4); }
    const h = (t-0.7)/0.3; return new RT.Vec3(0.3-h*0.25, 0.2-h*0.15, 0.5-h*0.3);
  }
  if (bg) return bg;
  const unitDir = ray.direction.unit();
  const t = 0.5 * (unitDir.y + 1.0);
  return new RT.Vec3(1, 1, 1).mul(1 - t).add(new RT.Vec3(0.5, 0.7, 1.0).mul(t));
}

// --- Preetham Sky (inline for tile worker) ---
function createPreethamBgFnTile(hour, turbidity) {
  const solarAngle = (hour - 6) / 12 * Math.PI;
  const elevation = Math.sin(solarAngle) * (Math.PI / 2);
  const azimuth = solarAngle;
  const sunDir = new RT.Vec3(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth)
  ).unit();

  const thetaS = Math.acos(Math.max(0, Math.min(1, sunDir.y)));
  const T = turbidity;
  const intensity = Math.max(0.1, Math.sin(Math.max(0, elevation)) * 1.5);

  const cY = [[0.1787,-1.4630],[-0.3554,0.4275],[-0.0227,5.3251],[0.1206,-2.5771],[-0.0670,0.3703]].map(([a,b])=>a*T+b);
  const cx = [[-0.0193,-0.2592],[-0.0665,0.0008],[-0.0004,0.2125],[-0.0641,-0.8989],[-0.0033,0.0452]].map(([a,b])=>a*T+b);
  const cy = [[-0.0167,-0.2608],[-0.0950,0.0092],[-0.0079,0.2102],[-0.0441,-1.6537],[-0.0109,0.0529]].map(([a,b])=>a*T+b);

  const chi = (4.0/9.0 - T/120.0) * (Math.PI - 2*thetaS);
  const zenithY = (4.0453*T - 4.9710) * Math.tan(chi) - 0.2155*T + 2.4192;
  const t2 = thetaS*thetaS, t3 = t2*thetaS, T2 = T*T;
  const zenithx = (0.00166*t3-0.00375*t2+0.00209*thetaS)*T2+(-0.02903*t3+0.06377*t2-0.03202*thetaS+0.00394)*T+(0.11693*t3-0.21196*t2+0.06052*thetaS+0.25886);
  const zenithy = (0.00275*t3-0.00610*t2+0.00317*thetaS)*T2+(-0.04214*t3+0.08970*t2-0.04153*thetaS+0.00516)*T+(0.15346*t3-0.26756*t2+0.06670*thetaS+0.26688);

  function perez(c, theta, gamma) {
    const ct = Math.max(0.001, Math.cos(theta));
    const cg = Math.cos(gamma);
    return (1+c[0]*Math.exp(c[1]/ct))*(1+c[2]*Math.exp(c[3]*gamma)+c[4]*cg*cg);
  }
  const pY0 = perez(cY,0,thetaS), px0 = perez(cx,0,thetaS), py0 = perez(cy,0,thetaS);

  return function(ray) {
    const dir = ray.direction.unit();
    if (dir.y < 0) return new RT.Vec3(0.05*(1+dir.y), 0.05*(1+dir.y), 0.08*(1+dir.y));
    const theta = Math.acos(Math.max(0,Math.min(1,dir.y)));
    const cosG = Math.max(-1,Math.min(1, dir.x*sunDir.x+dir.y*sunDir.y+dir.z*sunDir.z));
    const gamma = Math.acos(cosG);
    const Y = zenithY*perez(cY,theta,gamma)/pY0;
    const x = zenithx*perez(cx,theta,gamma)/px0;
    const y = zenithy*perez(cy,theta,gamma)/py0;
    if (y<=0) return new RT.Vec3(0,0,0);
    const Yabs = Math.max(0,Y)*intensity;
    const X = (x/y)*Yabs, Z = ((1-x-y)/y)*Yabs;
    const r=Math.max(0,3.2406*X-1.5372*Yabs-0.4986*Z);
    const g=Math.max(0,-0.9689*X+1.8758*Yabs+0.0415*Z);
    const b=Math.max(0,0.0557*X-0.2040*Yabs+1.0570*Z);
    const sunAngle = gamma, sunR = 0.02;
    if (sunAngle<sunR) { const s=sunAngle/sunR, l=1-s*s; return new RT.Vec3(r+l*50,g+l*47.5,b+l*40); }
    if (sunAngle<sunR*3) { const s=(sunAngle-sunR)/(sunR*2), gl=Math.exp(-s*3)*5; return new RT.Vec3(r+gl,g+gl*0.9,b+gl*0.7); }
    return new RT.Vec3(r,g,b);
  };
}

function createPreethamSceneTile() {
  const world = new RT.HittableList();
  world.add(new RT.XZRect(-20,20,-20,20,0, new RT.Metal(new RT.Vec3(0.7,0.7,0.7),0.15)));
  world.add(new RT.Sphere(new RT.Vec3(0,1.5,0),1.5, new RT.Dielectric(1.5)));
  world.add(new RT.Sphere(new RT.Vec3(-3,1,2),1, new RT.Metal(new RT.Vec3(0.8,0.2,0.2),0.05)));
  world.add(new RT.Sphere(new RT.Vec3(3,1,2),1, new RT.Metal(new RT.Vec3(0.2,0.2,0.8),0.05)));
  world.add(new RT.Sphere(new RT.Vec3(-1.5,0.6,3),0.6, new RT.Metal(new RT.Vec3(0.9,0.7,0.2),0.02)));
  world.add(new RT.Sphere(new RT.Vec3(1.5,0.7,3.5),0.7, new RT.Lambertian(new RT.MarbleTexture())));
  for (let i=0;i<15;i++) {
    const x=-6+Math.random()*12, z=-3+Math.random()*8, r=0.15+Math.random()*0.25;
    const c=new RT.Vec3(0.2+Math.random()*0.6,0.2+Math.random()*0.6,0.2+Math.random()*0.6);
    world.add(new RT.Sphere(new RT.Vec3(x,r,z),r, Math.random()>0.5?new RT.Lambertian(c):new RT.Metal(c,Math.random()*0.3)));
  }
  return world;
}
