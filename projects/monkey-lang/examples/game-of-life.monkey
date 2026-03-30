// Conway's Game of Life — running in WebAssembly
// Uses mutable arrays for the grid, simulates 5 generations

let WIDTH = 30;
let HEIGHT = 15;
let SIZE = WIDTH * HEIGHT;

// Create a zero-filled grid
let makeGrid = fn() {
  let grid = [];
  for (i in 0..SIZE) { grid = push(grid, 0); }
  grid
};

let idx = fn(x, y) { y * WIDTH + x };

let getCell = fn(grid, x, y) {
  if (x < 0) { return 0; }
  if (x >= WIDTH) { return 0; }
  if (y < 0) { return 0; }
  if (y >= HEIGHT) { return 0; }
  grid[idx(x, y)]
};

let countNeighbors = fn(grid, x, y) {
  getCell(grid, x-1, y-1) + getCell(grid, x, y-1) + getCell(grid, x+1, y-1) +
  getCell(grid, x-1, y) + getCell(grid, x+1, y) +
  getCell(grid, x-1, y+1) + getCell(grid, x, y+1) + getCell(grid, x+1, y+1)
};

let step = fn(grid) {
  let next = makeGrid();
  for (y in 0..HEIGHT) {
    for (x in 0..WIDTH) {
      let n = countNeighbors(grid, x, y);
      let alive = getCell(grid, x, y);
      // Rules: alive with 2-3 neighbors stays alive, dead with 3 becomes alive
      if (alive == 1) {
        if (n == 2 || n == 3) { next[idx(x, y)] = 1; }
      } else {
        if (n == 3) { next[idx(x, y)] = 1; }
      }
    }
  }
  next
};

let printGrid = fn(grid, gen) {
  puts(`Generation ${gen}:`);
  for (y in 0..HEIGHT) {
    let line = "";
    for (x in 0..WIDTH) {
      if (getCell(grid, x, y) == 1) {
        line = line + "█";
      } else {
        line = line + " ";
      }
    }
    puts(line);
  }
  puts("");
};

// Initialize with an R-pentomino (common chaotic pattern)
let grid = makeGrid();
let cx = WIDTH / 2;
let cy = HEIGHT / 2;
grid[idx(cx+1, cy-1)] = 1;
grid[idx(cx+2, cy-1)] = 1;
grid[idx(cx, cy)] = 1;
grid[idx(cx+1, cy)] = 1;
grid[idx(cx+1, cy+1)] = 1;

// Run 5 generations
printGrid(grid, 0);
for (gen in 1..6) {
  grid = step(grid);
  printGrid(grid, gen);
}
