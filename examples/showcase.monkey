// Monkey-lang Functional Programming Showcase
// Demonstrates: closures, mutable closures, higher-order functions,
// for-in, break, arrays, hashes, recursion, VM compiler features

// === Standard Library (pure Monkey) ===

// map: apply function to each element
let map = fn(arr, f) {
  let result = [];
  for (x in arr) { set result = push(result, f(x)) };
  result
};

// filter: keep elements matching predicate
let filter = fn(arr, pred) {
  let result = [];
  for (x in arr) { if (pred(x)) { set result = push(result, x) } };
  result
};

// reduce: fold array with accumulator
let reduce = fn(arr, init, f) {
  let acc = init;
  for (x in arr) { set acc = f(acc, x) };
  acc
};

// range: generate array of integers [start, end)
let range = fn(start, end) {
  let result = [];
  let i = start;
  while (i < end) { set result = push(result, i); set i = i + 1 };
  result
};

// zip: combine two arrays into pairs
let zip = fn(a, b) {
  let result = [];
  let max = if (len(a) < len(b)) { len(a) } else { len(b) };
  for (let i = 0; i < max; set i = i + 1) {
    set result = push(result, [a[i], b[i]])
  };
  result
};

// sum: add all elements
let sum = fn(arr) { reduce(arr, 0, fn(a, b) { a + b }) };

// any: check if any element matches
let any = fn(arr, pred) {
  for (x in arr) { if (pred(x)) { return true } };
  false
};

// all: check if all elements match
let all = fn(arr, pred) {
  for (x in arr) { if (!pred(x)) { return false } };
  true
};

// compose: f(g(x))
let compose = fn(f, g) { fn(x) { f(g(x)) } };

// === Demo: Statistics Calculator ===

let data = range(1, 11); // [1, 2, ..., 10]

let total = sum(data); // 55
let count = len(data); // 10
let mean = total / count; // 5

// Variance using higher-order functions
let sq_diffs = map(data, fn(x) { (x - mean) * (x - mean) });
let variance = sum(sq_diffs) / count;

// === Demo: Mutable Counter State Machine ===

let make_stats = fn() {
  let n = 0;
  let total = 0;
  let max_val = 0;
  
  let add = fn(x) {
    set n = n + 1;
    set total = total + x;
    if (x > max_val) { set max_val = x };
    x
  };
  
  let avg = fn() { if (n > 0) { total / n } else { 0 } };
  let get_max = fn() { max_val };
  let get_count = fn() { n };
  
  {"add": add, "avg": avg, "max": get_max, "count": get_count}
};

let stats = make_stats();
for (x in [3, 7, 2, 9, 1, 8, 4, 6, 5, 10]) {
  stats["add"](x)
};

// === Demo: FizzBuzz with higher-order functions ===

let fizzbuzz = fn(n) {
  let classify = fn(x) {
    if (x % 15 == 0) { "FizzBuzz" }
    else { if (x % 3 == 0) { "Fizz" }
    else { if (x % 5 == 0) { "Buzz" }
    else { x }}}
  };
  map(range(1, n + 1), classify)
};

let fb = fizzbuzz(15);
let fizzbuzz_count = len(filter(fb, fn(x) { x == "FizzBuzz" }));

// === Demo: Recursive quicksort ===

let quicksort = fn(arr) {
  if (len(arr) <= 1) { arr }
  else {
    let pivot = arr[0];
    let rest = [];
    for (let i = 1; i < len(arr); set i = i + 1) {
      set rest = push(rest, arr[i])
    };
    let left = filter(rest, fn(x) { x <= pivot });
    let right = filter(rest, fn(x) { x > pivot });
    let sorted_left = quicksort(left);
    let sorted_right = quicksort(right);
    // Concatenate: sorted_left + [pivot] + sorted_right
    let result = sorted_left;
    set result = push(result, pivot);
    for (x in sorted_right) { set result = push(result, x) };
    result
  }
};

let unsorted = [5, 3, 8, 1, 9, 2, 7, 4, 6, 10];
let sorted = quicksort(unsorted);

// === Results ===
[
  {"test": "sum 1-10", "result": total, "expected": 55},
  {"test": "mean", "result": mean, "expected": 5},
  {"test": "variance", "result": variance, "expected": 8},
  {"test": "stats count", "result": stats["count"](), "expected": 10},
  {"test": "stats max", "result": stats["max"](), "expected": 10},
  {"test": "stats avg", "result": stats["avg"](), "expected": 5},
  {"test": "fizzbuzz count", "result": fizzbuzz_count, "expected": 1},
  {"test": "sorted", "result": sorted, "expected": [1,2,3,4,5,6,7,8,9,10]},
  {"test": "compose", "result": compose(fn(x) { x * 2 }, fn(x) { x + 1 })(5), "expected": 12},
  {"test": "all positive", "result": all(range(1, 6), fn(x) { x > 0 }), "expected": true},
  {"test": "any > 4", "result": any([1,2,3,4,5], fn(x) { x > 4 }), "expected": true}
]
