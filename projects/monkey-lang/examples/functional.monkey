// Functional Programming in WebAssembly
// Demonstrates map, filter, reduce, compose, curry — all compiled to native WASM

// Higher-order functions
let map = fn(arr, f) {
  let result = [];
  for (x in arr) { result = push(result, f(x)); }
  result
};

let filter = fn(arr, pred) {
  let result = [];
  for (x in arr) {
    if (pred(x) == 1) { result = push(result, x); }
  }
  result
};

let reduce = fn(arr, init, f) {
  let acc = init;
  for (x in arr) { acc = f(acc, x); }
  acc
};

let forEach = fn(arr, f) {
  for (x in arr) { f(x); }
  0
};

// Function composition
let compose = fn(f, g) { fn(x) { f(g(x)) } };

// Currying
let add = fn(a) { fn(b) { a + b } };
let multiply = fn(a) { fn(b) { a * b } };

// Pipeline
let nums = 1..21;

// 1. Sum of squares of odd numbers 1..20
let sumOddSquares = reduce(
  map(
    filter(nums, fn(x) { x % 2 != 0 }),
    fn(x) { x * x }
  ),
  0,
  fn(acc, x) { acc + x }
);
puts(`Sum of squares of odd numbers 1..20: ${sumOddSquares}`);

// 2. Using composed functions
let doubleAndInc = compose(add(1), multiply(2));
let results = map(1..6, doubleAndInc);
puts("doubleAndInc on 1..5:");
forEach(results, fn(x) { puts(`  ${x}`); });

// 3. FizzBuzz using higher-order functions
puts("FizzBuzz 1..15:");
forEach(1..16, fn(n) {
  if (n % 15 == 0) { puts("FizzBuzz"); }
  if (n % 15 != 0) {
    if (n % 3 == 0) { puts("Fizz"); }
    if (n % 3 != 0) {
      if (n % 5 == 0) { puts("Buzz"); }
      if (n % 5 != 0) { puts(str(n)); }
    }
  }
});

// 4. Fibonacci sequence using reduce
let fib = fn(n) {
  if (n <= 1) { n } else { fib(n - 1) + fib(n - 2) }
};
let fibNums = map(0..10, fib);
puts("First 10 Fibonacci numbers:");
forEach(fibNums, fn(x) { puts(`  ${x}`); });
