// Functional Programming in WebAssembly
// Higher-order functions, closures, and composition

// Core functional primitives
let map = fn(arr, f) {
  let result = [];
  for (x in arr) { result = push(result, f(x)); }
  result
};

let filter = fn(arr, pred) {
  let result = [];
  for (x in arr) { if (pred(x)) { result = push(result, x); } }
  result
};

let reduce = fn(arr, init, f) {
  let acc = init;
  for (x in arr) { acc = f(acc, x); }
  acc
};

let forEach = fn(arr, f) {
  for (x in arr) { f(x); }
};

// Pipeline: find sum of squares of odd numbers 1-10
let nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

let isOdd = fn(x) { x % 2 != 0 };
let square = fn(x) { x * x };
let add = fn(a, b) { a + b };

// Step by step
let odds = filter(nums, isOdd);
let squares = map(odds, square);
let sum = reduce(squares, 0, add);

puts("Numbers: 1-10");
puts("Odd: " + str(len(odds)));
puts("Sum of squares of odds: " + str(sum));

// Pipeline
let tripled = map([1, 2, 3, 4, 5], fn(x) { x * 3 });
let big = filter(tripled, fn(x) { x > 6 });
let pipeResult = reduce(big, 0, fn(a, b) { a + b });
puts("Pipeline (sum of 3x where 3x > 6): " + str(pipeResult));

// Function composition
let compose = fn(f, g) {
  fn(x) { f(g(x)) }
};

let double = fn(x) { x * 2 };
let addOne = fn(x) { x + 1 };
let doubleAndAdd = compose(addOne, double);

puts("compose(+1, *2)(5) = " + str(doubleAndAdd(5)));

// Currying
let multiply = fn(x) { fn(y) { x * y } };
let times3 = multiply(3);
let times7 = multiply(7);

puts("3 * 14 = " + str(times3(14)));
puts("7 * 6 = " + str(times7(6)));

// Apply to array
let tripled = map([1, 2, 3, 4], times3);
puts("Tripled:");
forEach(tripled, fn(x) { puts("  " + str(x)); });
