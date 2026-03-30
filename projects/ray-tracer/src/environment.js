// environment.js — Environment maps for background rendering

import { Vec3, Color } from './vec3.js';

// Base environment map interface
// Returns a color for any given ray direction (unit vector)

// Sky gradient (the default)
export class SkyGradient {
  constructor(bottom = new Color(1, 1, 1), top = new Color(0.5, 0.7, 1.0)) {
    this.bottom = bottom;
    this.top = top;
  }

  sample(direction) {
    const unitDir = direction.unit();
    const t = 0.5 * (unitDir.y + 1.0);
    return this.bottom.mul(1 - t).add(this.top.mul(t));
  }
}

// Solid color background
export class SolidBackground {
  constructor(color = new Color(0, 0, 0)) {
    this.color = color;
  }

  sample(direction) {
    return this.color;
  }
}

// Sunset gradient
export class SunsetGradient {
  constructor() {}

  sample(direction) {
    const unitDir = direction.unit();
    const t = 0.5 * (unitDir.y + 1.0);

    // Multi-color gradient: ground → horizon orange → sky blue → zenith dark
    if (t < 0.35) {
      // Below horizon: dark ground
      return new Color(0.05, 0.05, 0.08);
    } else if (t < 0.5) {
      // Horizon: warm orange/red
      const ht = (t - 0.35) / 0.15;
      return new Color(0.1, 0.05, 0.05).lerp(new Color(0.9, 0.4, 0.1), ht);
    } else if (t < 0.7) {
      // Lower sky: orange to purple
      const ht = (t - 0.5) / 0.2;
      return new Color(0.9, 0.4, 0.1).lerp(new Color(0.3, 0.2, 0.5), ht);
    } else {
      // Upper sky: purple to dark blue
      const ht = (t - 0.7) / 0.3;
      return new Color(0.3, 0.2, 0.5).lerp(new Color(0.05, 0.05, 0.2), ht);
    }
  }
}

// Procedural starfield
export class StarfieldBackground {
  constructor(starDensity = 0.001) {
    this.density = starDensity;
    // Pre-generate star positions
    this.stars = [];
    for (let i = 0; i < 2000; i++) {
      this.stars.push({
        dir: Vec3.randomUnitVector(),
        brightness: 0.5 + Math.random() * 0.5,
        size: 0.001 + Math.random() * 0.003
      });
    }
  }

  sample(direction) {
    const unitDir = direction.unit();

    // Check if we're near any star
    for (const star of this.stars) {
      const dot = unitDir.dot(star.dir);
      if (dot > 1 - star.size) {
        const intensity = ((dot - (1 - star.size)) / star.size) * star.brightness;
        return new Color(intensity, intensity, intensity * 0.9);
      }
    }

    // Dark sky with slight blue tint at zenith
    const t = Math.max(0, unitDir.y);
    return new Color(0.01 + t * 0.02, 0.01 + t * 0.02, 0.03 + t * 0.05);
  }
}
