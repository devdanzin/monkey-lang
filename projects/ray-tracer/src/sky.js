// sky.js — Preetham sky model (physically-based atmospheric scattering)
// Based on "A Practical Analytic Model for Daylight" by Preetham et al. 1999
// Models Rayleigh + Mie scattering for realistic sky gradients

import { Vec3, Color } from './vec3.js';

/**
 * Preetham Sky Model
 * @param {Object} options
 * @param {Vec3} options.sunDirection - Unit vector pointing toward the sun
 * @param {number} options.turbidity - Atmospheric turbidity (2=clear, 10=hazy)
 * @param {number} options.intensity - Overall brightness multiplier
 */
export class PreethamSky {
  constructor({ sunDirection, turbidity = 2.5, intensity = 1.0 } = {}) {
    this.sunDirection = sunDirection ? sunDirection.unit() : new Vec3(0, 1, 0);
    this.turbidity = turbidity;
    this.intensity = intensity;

    // Precompute sun's zenith angle
    this.thetaS = Math.acos(Math.max(0, Math.min(1, this.sunDirection.y)));

    // Precompute Perez distribution coefficients for Y (luminance), x, y (chromaticity)
    this.coeffsY = this._perezCoeffs([
      [0.1787, -1.4630], [-0.3554, 0.4275], [-0.0227, 5.3251],
      [0.1206, -2.5771], [-0.0670, 0.3703]
    ]);
    this.coeffsx = this._perezCoeffs([
      [-0.0193, -0.2592], [-0.0665, 0.0008], [-0.0004, 0.2125],
      [-0.0641, -0.8989], [-0.0033, 0.0452]
    ]);
    this.coeffsy = this._perezCoeffs([
      [-0.0167, -0.2608], [-0.0950, 0.0092], [-0.0079, 0.2102],
      [-0.0441, -1.6537], [-0.0109, 0.0529]
    ]);

    // Precompute zenith luminance and chromaticity
    this.zenithY = this._zenithLuminance();
    this.zenithx = this._zenithChromaticity('x');
    this.zenithy = this._zenithChromaticity('y');
  }

  _perezCoeffs(table) {
    const T = this.turbidity;
    return table.map(([a, b]) => a * T + b);
  }

  _zenithLuminance() {
    const T = this.turbidity;
    const thetaS = this.thetaS;
    const chi = (4.0 / 9.0 - T / 120.0) * (Math.PI - 2 * thetaS);
    return (4.0453 * T - 4.9710) * Math.tan(chi) - 0.2155 * T + 2.4192;
  }

  _zenithChromaticity(channel) {
    const T = this.turbidity;
    const thetaS = this.thetaS;
    const t2 = thetaS * thetaS;
    const t3 = t2 * thetaS;

    if (channel === 'x') {
      const T2 = T * T;
      return (
        (0.00166 * t3 - 0.00375 * t2 + 0.00209 * thetaS + 0) * T2 +
        (-0.02903 * t3 + 0.06377 * t2 - 0.03202 * thetaS + 0.00394) * T +
        (0.11693 * t3 - 0.21196 * t2 + 0.06052 * thetaS + 0.25886)
      );
    } else {
      const T2 = T * T;
      return (
        (0.00275 * t3 - 0.00610 * t2 + 0.00317 * thetaS + 0) * T2 +
        (-0.04214 * t3 + 0.08970 * t2 - 0.04153 * thetaS + 0.00516) * T +
        (0.15346 * t3 - 0.26756 * t2 + 0.06670 * thetaS + 0.26688)
      );
    }
  }

  /**
   * Perez all-weather sky luminance distribution function
   * F(theta, gamma) = (1 + A * exp(B / cos(theta))) * (1 + C * exp(D * gamma) + E * cos²(gamma))
   */
  _perez(coeffs, theta, gamma) {
    const [A, B, C, D, E] = coeffs;
    const cosTheta = Math.max(0.001, Math.cos(theta));
    const cosGamma = Math.cos(gamma);
    return (
      (1 + A * Math.exp(B / cosTheta)) *
      (1 + C * Math.exp(D * gamma) + E * cosGamma * cosGamma)
    );
  }

  /**
   * Sample the sky color for a given direction
   * @param {Vec3} direction - Ray direction (unit vector)
   * @returns {Color} Sky color in linear RGB
   */
  sample(direction) {
    const dir = direction.unit();

    // If looking below horizon, return dark ground
    if (dir.y < 0) {
      const t = Math.max(0, -dir.y);
      return new Color(0.05 * (1 - t), 0.05 * (1 - t), 0.08 * (1 - t));
    }

    // Zenith angle of the viewing direction
    const theta = Math.acos(Math.max(0, Math.min(1, dir.y)));

    // Angle between viewing direction and sun
    const cosGamma = Math.max(-1, Math.min(1, dir.dot(this.sunDirection)));
    const gamma = Math.acos(cosGamma);

    // Evaluate Perez function ratios (direction / zenith)
    const Y = this.zenithY *
      this._perez(this.coeffsY, theta, gamma) /
      this._perez(this.coeffsY, 0, this.thetaS);

    const x = this.zenithx *
      this._perez(this.coeffsx, theta, gamma) /
      this._perez(this.coeffsx, 0, this.thetaS);

    const y = this.zenithy *
      this._perez(this.coeffsy, theta, gamma) /
      this._perez(this.coeffsy, 0, this.thetaS);

    // Convert Yxy to XYZ
    if (y <= 0) return new Color(0, 0, 0);
    const Yabs = Math.max(0, Y) * this.intensity;
    const X = (x / y) * Yabs;
    const Z = ((1 - x - y) / y) * Yabs;

    // XYZ to linear sRGB
    const r = 3.2406 * X - 1.5372 * Yabs - 0.4986 * Z;
    const g = -0.9689 * X + 1.8758 * Yabs + 0.0415 * Z;
    const b = 0.0557 * X - 0.2040 * Yabs + 1.0570 * Z;

    return new Color(
      Math.max(0, r),
      Math.max(0, g),
      Math.max(0, b)
    );
  }

  /**
   * Create a sun disk effect — adds bright spot near the sun direction
   */
  sampleWithSun(direction, sunRadius = 0.02, sunIntensity = 50) {
    const base = this.sample(direction);
    const dir = direction.unit();
    const cosAngle = dir.dot(this.sunDirection);
    const sunAngle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    if (sunAngle < sunRadius) {
      // Inside sun disk — bright yellow-white
      const t = sunAngle / sunRadius;
      const limb = 1 - t * t; // Limb darkening
      const sunColor = new Color(1.0, 0.95, 0.8).mul(sunIntensity * limb);
      return base.add(sunColor);
    } else if (sunAngle < sunRadius * 3) {
      // Corona / glow around sun
      const t = (sunAngle - sunRadius) / (sunRadius * 2);
      const glow = Math.exp(-t * 3) * sunIntensity * 0.1;
      return base.add(new Color(glow, glow * 0.9, glow * 0.7));
    }

    return base;
  }
}

/**
 * Create a PreethamSky from hour-of-day
 * @param {number} hour - 0-24, where 6=sunrise, 12=noon, 18=sunset
 * @param {number} turbidity - Atmospheric turbidity (2=clear, 10=hazy)
 * @param {number} northAngle - Rotation around Y axis in radians
 */
export function skyFromTime(hour, turbidity = 2.5, northAngle = 0) {
  // Sun elevation: peaks at noon (90°), 0° at sunrise/sunset
  const solarAngle = (hour - 6) / 12 * Math.PI; // 0 at 6am, PI at 6pm
  const elevation = Math.sin(solarAngle) * (Math.PI / 2);

  // Sun azimuth: east at sunrise, south at noon, west at sunset
  const azimuth = solarAngle + northAngle;

  const sunDir = new Vec3(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth)
  );

  return new PreethamSky({
    sunDirection: sunDir,
    turbidity,
    intensity: Math.max(0.1, Math.sin(Math.max(0, elevation)) * 1.5),
  });
}
