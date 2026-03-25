// Sierpinski Triangle (ASCII)
// Demonstrates: recursion, string operations, for-loops

let SIZE = 32;

// Create the triangle pattern using XOR rule
let row = [];
for (let i = 0; i < SIZE; i++) {
  row = push(row, 0);
}
row[SIZE / 2] = 1;

for (let line = 0; line < SIZE; line++) {
  // Render current row
  let output = "";
  for (cell in row) {
    output = output + (cell == 1 ? "*" : " ");
  }
  puts(output);

  // Compute next row using Rule 90 (XOR of neighbors)
  let next = [];
  for (let i = 0; i < SIZE; i++) {
    let left = i > 0 ? row[i - 1] : 0;
    let right = i < SIZE - 1 ? row[i + 1] : 0;
    // XOR: left + right == 1 means exactly one neighbor is alive
    next = push(next, (left + right == 1) ? 1 : 0);
  }
  row = next;
}
