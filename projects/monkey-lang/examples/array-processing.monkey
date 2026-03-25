// Array Processing with Standard Library
// Demonstrates map, filter, reduce, and the JIT's closure inlining

// Standard library (normally loaded via :stdlib in REPL)
let map = fn(arr, f) { let r = []; let i = 0; while (i < len(arr)) { r = push(r, f(arr[i])); i = i + 1; } r };
let filter = fn(arr, f) { let r = []; let i = 0; while (i < len(arr)) { if (f(arr[i])) { r = push(r, arr[i]); } i = i + 1; } r };
let reduce = fn(arr, init, f) { let acc = init; let i = 0; while (i < len(arr)) { acc = f(acc, arr[i]); i = i + 1; } acc };
let range = fn(n) { let r = []; let i = 0; while (i < n) { r = push(r, i); i = i + 1; } r };

// Build an array of 1000 numbers
let numbers = range(1000);

// Sum all numbers
let sum = reduce(numbers, 0, fn(acc, x) { acc + x });
puts("Sum of 0..999: " + str(sum));

// Double each number and sum
let doubled_sum = reduce(map(numbers, fn(x) { x * 2 }), 0, fn(acc, x) { acc + x });
puts("Sum of doubled: " + str(doubled_sum));

// Count numbers > 500
let big_count = len(filter(numbers, fn(x) { x > 500 }));
puts("Numbers > 500: " + str(big_count));

// Dot product (sum of squares)
let dot = reduce(numbers, 0, fn(acc, x) { acc + x * x });
puts("Sum of squares: " + str(dot));
