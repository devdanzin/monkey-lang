// Conway's Game of Life
// Demonstrates: arrays, mutation, for-loops, functions, template literals

let WIDTH = 40;
let HEIGHT = 20;

// Create a grid
let make_grid = fn(w, h) {
  let grid = [];
  for (let i = 0; i < h; i += 1) {
    let row = [];
    for (let j = 0; j < w; j += 1) {
      row = push(row, 0);
    }
    grid = push(grid, row);
  }
  grid
};

// Set a cell
let set_cell = fn(grid, r, c, val) {
  if (r >= 0 && r < len(grid) && c >= 0 && c < len(grid[0])) {
    grid[r][c] = val;
  }
};

// Count live neighbors
let count_neighbors = fn(grid, r, c) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr == 0 && dc == 0) { continue; }
      let nr = r + dr;
      let nc = c + dc;
      if (nr >= 0 && nr < len(grid) && nc >= 0 && nc < len(grid[0])) {
        count += grid[nr][nc];
      }
    }
  }
  count
};

// One generation step
let step = fn(grid) {
  let h = len(grid);
  let w = len(grid[0]);
  let next = make_grid(w, h);
  for (let r = 0; r < h; r += 1) {
    for (let c = 0; c < w; c += 1) {
      let n = count_neighbors(grid, r, c);
      if (grid[r][c] == 1) {
        next[r][c] = (n == 2 || n == 3) ? 1 : 0;
      } else {
        next[r][c] = n == 3 ? 1 : 0;
      }
    }
  }
  next
};

// Display the grid
let display = fn(grid) {
  for (row in grid) {
    let line = "";
    for (cell in row) {
      line = line + (cell == 1 ? "#" : " ");
    }
    puts(line);
  }
};

// Initialize with a glider gun (Gosper)
let grid = make_grid(WIDTH, HEIGHT);

// Glider
set_cell(grid, 1, 2, 1);
set_cell(grid, 2, 3, 1);
set_cell(grid, 3, 1, 1);
set_cell(grid, 3, 2, 1);
set_cell(grid, 3, 3, 1);

// R-pentomino
set_cell(grid, 10, 20, 1);
set_cell(grid, 10, 21, 1);
set_cell(grid, 11, 19, 1);
set_cell(grid, 11, 20, 1);
set_cell(grid, 12, 20, 1);

// Run 10 generations
for (let gen = 0; gen < 10; gen += 1) {
  puts(`=== Generation ${gen} ===`);
  display(grid);
  puts("");
  grid = step(grid);
}
