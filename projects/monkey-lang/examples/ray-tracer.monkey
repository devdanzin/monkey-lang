// ray-tracer.monkey — A simple ray tracer written in Monkey-lang
// Renders a scene with spheres to PPM format
// Showcases: arrays, closures, math, string operations

// === Vector operations (as arrays [x, y, z]) ===
let vadd = fn(a, b) { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] };
let vsub = fn(a, b) { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] };
let vmul = fn(a, t) { [a[0] * t, a[1] * t, a[2] * t] };
let vdot = fn(a, b) { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] };
let vlen2 = fn(a) { vdot(a, a) };
let clamp = fn(x, lo, hi) { if (x < lo) { lo } else { if (x > hi) { hi } else { x } } };
let floor = fn(x) { x - x % 1.0 };

// Newton's method sqrt
let sqrt = fn(x) {
  if (x <= 0.0) { return 0.0 }
  let guess = x;
  let i = 0;
  while (i < 20) {
    guess = (guess + x / guess) / 2.0;
    i = i + 1;
  }
  guess
};

let vlen = fn(a) { sqrt(vlen2(a)) };
let vunit = fn(a) {
  let l = vlen(a);
  if (l > 0.0) { vmul(a, 1.0 / l) } else { [0.0, 0.0, 0.0] }
};

// === Sphere intersection: returns t or -1.0 ===
let hit_sphere = fn(center, radius, ro, rd) {
  let oc = vsub(ro, center);
  let a = vdot(rd, rd);
  let hb = vdot(oc, rd);
  let c = vdot(oc, oc) - radius * radius;
  let disc = hb * hb - a * c;
  if (disc < 0.0) {
    0.0 - 1.0
  } else {
    (0.0 - hb - sqrt(disc)) / a
  }
};

// === Ray color with directional light ===
let ray_color = fn(ro, rd, spheres) {
  let closest_t = 999999.0;
  let closest_idx = 0.0 - 1.0;
  let i = 0;
  while (i < len(spheres)) {
    let s = spheres[i];
    let t = hit_sphere(s[0], s[1], ro, rd);
    if (t > 0.001 && t < closest_t) {
      closest_t = t;
      closest_idx = i;
    }
    i = i + 1;
  }

  if (closest_idx >= 0.0) {
    let s = spheres[closest_idx];
    let p = vadd(ro, vmul(rd, closest_t));
    let n = vunit(vsub(p, s[0]));
    let color = s[2];
    let light = vunit([1.0, 1.0, 1.0]);
    let bright = vdot(n, light);
    if (bright < 0.0) { bright = 0.0 }
    let shade = 0.3 + 0.7 * bright;
    return vmul(color, shade);
  }

  // Sky gradient
  let ud = vunit(rd);
  let t = (ud[1] + 1.0) / 2.0;
  vadd(vmul([1.0, 1.0, 1.0], 1.0 - t), vmul([0.5, 0.7, 1.0], t))
};

// === Scene ===
let spheres = [
  [[0.0, -100.5, -1.0], 100.0, [0.8, 0.8, 0.0]],
  [[0.0, 0.0, -1.0], 0.5, [0.7, 0.3, 0.3]],
  [[0.0 - 1.0, 0.0, -1.0], 0.5, [0.3, 0.3, 0.7]],
  [[1.0, 0.0, -1.0], 0.5, [0.3, 0.7, 0.3]]
];

// === Render ===
let width = 40;
let height = 22;
let origin = [0.0, 0.0, 0.0];
let vh = 2.0;
let vw = vh * width / height;
let horiz = [vw, 0.0, 0.0];
let vert = [0.0, vh, 0.0];
let ll = vsub(vsub(vsub(origin, vmul(horiz, 0.5)), vmul(vert, 0.5)), [0.0, 0.0, 1.0]);

puts("P3");
puts(str(width) + " " + str(height));
puts("255");

let j = height - 1;
while (j >= 0) {
  let i = 0;
  while (i < width) {
    let u = i * 1.0 / (width - 1);
    let v = j * 1.0 / (height - 1);
    let dir = vsub(vadd(vadd(ll, vmul(horiz, u)), vmul(vert, v)), origin);
    let c = ray_color(origin, dir, spheres);
    let ir = floor(clamp(c[0] * 255.0, 0.0, 255.0));
    let ig = floor(clamp(c[1] * 255.0, 0.0, 255.0));
    let ib = floor(clamp(c[2] * 255.0, 0.0, 255.0));
    puts(str(ir) + " " + str(ig) + " " + str(ib));
    i = i + 1;
  }
  j = j - 1;
}
