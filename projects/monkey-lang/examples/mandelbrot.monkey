// Mandelbrot Set in ASCII
// Uses fixed-point integer arithmetic (multiply by 1000 for 3 decimal places)
// Compiles to native WebAssembly!

let SCALE = 1000;
let MAX_ITER = 30;

let mandelbrot = fn(cx, cy) {
  let zx = 0;
  let zy = 0;
  let iter = 0;
  while (iter < MAX_ITER) {
    // z = z^2 + c
    // zx_new = zx*zx - zy*zy + cx
    // zy_new = 2*zx*zy + cy
    let zx2 = zx * zx / SCALE;
    let zy2 = zy * zy / SCALE;
    let zxy = zx * zy / SCALE;

    if (zx2 + zy2 > 4 * SCALE) {
      return iter;
    }

    zx = zx2 - zy2 + cx;
    zy = 2 * zxy + cy;
    iter = iter + 1;
  }
  iter
};

let chars = " .:-=+*#%@";

// Render: x from -2.0 to 1.0, y from -1.0 to 1.0
let y = -1000;
while (y <= 1000) {
  let line = "";
  let x = -2000;
  while (x <= 1000) {
    let iter = mandelbrot(x, y);
    let idx = iter * 9 / MAX_ITER;
    if (idx > 9) { idx = 9; }
    // Use simple character mapping
    if (iter >= MAX_ITER) { line = line + " "; }
    if (iter < MAX_ITER) {
      if (iter < 3) { line = line + "."; }
      if (iter >= 3) {
        if (iter < 6) { line = line + ":"; }
        if (iter >= 6) {
          if (iter < 10) { line = line + "="; }
          if (iter >= 10) {
            if (iter < 15) { line = line + "+"; }
            if (iter >= 15) {
              if (iter < 20) { line = line + "*"; }
              if (iter >= 20) { line = line + "#"; }
            }
          }
        }
      }
    }
    x = x + 75;
  }
  puts(line);
  y = y + 100;
}
