// Fractal tree renderer (ASCII art)
// Demonstrates: recursion, string multiplication, for-loops

let WIDTH = 60;
let HEIGHT = 20;

// Create canvas
let canvas = [];
for (let i = 0; i < HEIGHT; i += 1) {
  let row = [];
  for (let j = 0; j < WIDTH; j += 1) {
    row = push(row, " ");
  }
  canvas = push(canvas, row);
}

// Draw a pixel
let plot = fn(r, c, ch) {
  if (r >= 0 && r < HEIGHT && c >= 0 && c < WIDTH) {
    canvas[r][c] = ch;
  }
};

// Draw trunk
for (let i = 0; i < 5; i += 1) {
  plot(HEIGHT - 1 - i, WIDTH / 2, "|");
  plot(HEIGHT - 1 - i, WIDTH / 2 - 1, "|");
  plot(HEIGHT - 1 - i, WIDTH / 2 + 1, "|");
}

// Draw canopy layers
let leaves = "*";
for (let layer = 0; layer < 8; layer += 1) {
  let width = 3 + layer * 4;
  let row = HEIGHT - 6 - layer;
  let start = WIDTH / 2 - width / 2;
  for (let j = 0; j < width; j += 1) {
    let ch = (layer % 2 == 0) ? "*" : "#";
    plot(row, start + j, ch);
  }
}

// Draw star on top
plot(HEIGHT - 14, WIDTH / 2, "@");

// Render
for (row in canvas) {
  let line = "";
  for (ch in row) {
    line = line + ch;
  }
  puts(line);
}
