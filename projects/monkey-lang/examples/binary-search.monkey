// Binary search with match expression
// Demonstrates: recursion, match, slicing, template literals

let binary_search = fn(arr, target, lo, hi) {
  if (lo > hi) { return -1; }
  let mid = (lo + hi) / 2;
  match (true) {
    arr[mid] == target => mid,
    arr[mid] < target  => binary_search(arr, target, mid + 1, hi),
    _ => binary_search(arr, target, lo, mid - 1)
  }
};

let search = fn(arr, target) {
  binary_search(arr, target, 0, len(arr) - 1)
};

// Create sorted array
let data = [];
for (let i = 0; i < 100; i++) {
  data = push(data, i * 3);
}

// Search for various values
for (target in [0, 15, 42, 99, 150, 297, 300]) {
  let idx = search(data, target);
  if (idx >= 0) {
    puts(`Found ${target} at index ${idx}`);
  } else {
    puts(`${target} not found`);
  }
}
