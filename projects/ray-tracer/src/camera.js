// camera.js — Configurable camera with depth of field and bokeh shapes

import { Vec3, Point3 } from './vec3.js';
import { Ray } from './ray.js';
import { createBokehSampler } from './bokeh.js';

export class Camera {
  constructor({
    lookFrom = new Point3(0, 0, 0),
    lookAt = new Point3(0, 0, -1),
    vup = new Vec3(0, 1, 0),
    vfov = 90,  // Vertical field of view in degrees
    aspectRatio = 16 / 9,
    aperture = 0,
    focusDist = 1,
    time0 = 0,
    time1 = 0,
    bokeh = 'circle',      // Bokeh shape: 'circle', 'hexagon', 'pentagon', 'star', 'heart', 'ring'
    bokehOpts = {}          // Shape-specific options (rotation, blades, innerRadius, etc.)
  } = {}) {
    const theta = vfov * Math.PI / 180;
    const h = Math.tan(theta / 2);
    const viewportHeight = 2.0 * h;
    const viewportWidth = aspectRatio * viewportHeight;

    this.w = lookFrom.sub(lookAt).unit();
    this.u = vup.cross(this.w).unit();
    this.v = this.w.cross(this.u);

    this.origin = lookFrom;
    this.horizontal = this.u.mul(viewportWidth * focusDist);
    this.vertical = this.v.mul(viewportHeight * focusDist);
    this.lowerLeftCorner = this.origin
      .sub(this.horizontal.div(2))
      .sub(this.vertical.div(2))
      .sub(this.w.mul(focusDist));

    this.lensRadius = aperture / 2;
    this.time0 = time0;
    this.time1 = time1;

    // Bokeh shape sampler
    this.bokehSampler = typeof bokeh === 'function' ? bokeh : createBokehSampler(bokeh, bokehOpts);
  }

  getRay(s, t) {
    const rd = this.bokehSampler().mul(this.lensRadius);
    const offset = this.u.mul(rd.x).add(this.v.mul(rd.y));
    const time = this.time0 + Math.random() * (this.time1 - this.time0);

    return new Ray(
      this.origin.add(offset),
      this.lowerLeftCorner
        .add(this.horizontal.mul(s))
        .add(this.vertical.mul(t))
        .sub(this.origin)
        .sub(offset),
      time
    );
  }
}
