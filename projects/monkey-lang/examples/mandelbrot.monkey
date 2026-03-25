// Integer Mandelbrot set using fixed-point arithmetic
// Scale factor: 1000 (so 1.5 = 1500, -2.0 = -2000)

let SCALE = 1000;
let max_iter = 30;
let width = 60;
let height = 25;
let chars = " .-+*#@";

for (let row = 0; row < height; row += 1) {
  let line = "";
  for (let col = 0; col < width; col += 1) {
    // Map to complex plane: x0 in [-2000, 1000], y0 in [-1000, 1000]
    let x0 = -2000 + col * 3000 / width;
    let y0 = -1000 + row * 2000 / height;

    let x = 0;
    let y = 0;
    let iter = 0;

    while (iter < max_iter) {
      // x^2 and y^2 in fixed-point: multiply then divide by SCALE
      let x2 = x * x / SCALE;
      let y2 = y * y / SCALE;
      if (x2 + y2 > 4 * SCALE) { break; }
      let xtemp = x2 - y2 + x0;
      y = 2 * x * y / SCALE + y0;
      x = xtemp;
      iter += 1;
    }

    if (iter == max_iter) {
      line = line + "#";
    } else {
      let ci = iter * len(chars) / max_iter;
      if (ci >= len(chars)) { ci = len(chars) - 1; }
      line = line + chars[ci];
    }
  }
  puts(line);
}
