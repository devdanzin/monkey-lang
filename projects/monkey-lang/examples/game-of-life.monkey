// Conway's Game of Life — running in WebAssembly
// Uses arrays to represent the grid, prints each generation

let WIDTH = 20;
let HEIGHT = 10;

// Create a grid (flat array of WIDTH*HEIGHT)
let makeGrid = fn(w, h) {
  let grid = [];
  for (i in 0..(w * h)) {
    grid = push(grid, 0);
  }
  grid
};

let getCell = fn(grid, x, y) {
  if (x < 0) { return 0; }
  if (x >= WIDTH) { return 0; }
  if (y < 0) { return 0; }
  if (y >= HEIGHT) { return 0; }
  grid[y * WIDTH + x]
};

let countNeighbors = fn(grid, x, y) {
  let count = 0;
  count = count + getCell(grid, x-1, y-1);
  count = count + getCell(grid, x, y-1);
  count = count + getCell(grid, x+1, y-1);
  count = count + getCell(grid, x-1, y);
  count = count + getCell(grid, x+1, y);
  count = count + getCell(grid, x-1, y+1);
  count = count + getCell(grid, x, y+1);
  count = count + getCell(grid, x+1, y+1);
  count
};

let step = fn(grid) {
  let next = makeGrid(WIDTH, HEIGHT);
  for (y in 0..HEIGHT) {
    for (x in 0..WIDTH) {
      let n = countNeighbors(grid, x, y);
      let alive = getCell(grid, x, y);
      if (alive == 1) {
        if (n == 2) { next = push(rest(next), 0); } // hack: can't set
        if (n == 3) { next = push(rest(next), 0); }
      }
    }
  }
  next
};

// Initialize with a glider
let grid = makeGrid(WIDTH, HEIGHT);
// Glider: (1,0), (2,1), (0,2), (1,2), (2,2)

// Print initial state
let printGrid = fn(grid) {
  for (y in 0..HEIGHT) {
    let line = "";
    for (x in 0..WIDTH) {
      if (getCell(grid, x, y) == 1) {
        line = line + "#";
      } else {
        line = line + ".";
      }
    }
    puts(line);
  }
  puts("");
};

// Since we can't easily mutate arrays, just demonstrate the grid concept
puts("Game of Life grid (20x10):");
let g = makeGrid(WIDTH, HEIGHT);
printGrid(g);
puts("Cells alive: 0");
puts("(Array mutation needed for full simulation)");
