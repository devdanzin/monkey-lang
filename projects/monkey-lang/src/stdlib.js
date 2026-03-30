// Monkey standard library
// Higher-order array functions and utilities

export const STDLIB_SOURCE = `
let map = fn(arr, f) {
  let result = [];
  for (x in arr) { result = push(result, f(x)); }
  result
};

let filter = fn(arr, f) {
  let result = [];
  for (x in arr) { if (f(x)) { result = push(result, x); } }
  result
};

let reduce = fn(arr, initial, f) {
  let acc = initial;
  for (x in arr) { acc = f(acc, x); }
  acc
};

let forEach = fn(arr, f) {
  for (x in arr) { f(x); }
};

let range = fn(a, b = null) {
  let result = [];
  if (b == null) {
    for (let i = 0; i < a; i += 1) { result = push(result, i); }
  } else {
    for (let i = a; i < b; i += 1) { result = push(result, i); }
  }
  result
};

let contains = fn(arr, val) {
  for (x in arr) { if (x == val) { return true; } }
  false
};

let reverse = fn(arr) {
  let result = [];
  for (let i = len(arr) - 1; i > 0 - 1; i -= 1) {
    result = push(result, arr[i]);
  }
  result
};

let sum = fn(arr) {
  let total = 0;
  for (x in arr) { total += x; }
  total
};

let max = fn(arr) {
  let m = arr[0];
  for (let i = 1; i < len(arr); i += 1) {
    if (arr[i] > m) { m = arr[i]; }
  }
  m
};

let min = fn(arr) {
  let m = arr[0];
  for (let i = 1; i < len(arr); i += 1) {
    if (arr[i] < m) { m = arr[i]; }
  }
  m
};

let zip = fn(a, b) {
  let result = [];
  let n = len(a);
  if (len(b) < n) { n = len(b); }
  for (let i = 0; i < n; i += 1) {
    result = push(result, [a[i], b[i]]);
  }
  result
};

let enumerate = fn(arr) {
  let result = [];
  for (let i = 0; i < len(arr); i += 1) {
    result = push(result, [i, arr[i]]);
  }
  result
};

let flat = fn(arr) {
  let result = [];
  for (x in arr) {
    if (type(x) == "ARRAY") {
      for (y in x) { result = push(result, y); }
    } else {
      result = push(result, x);
    }
  }
  result
};

let sort = fn(arr) {
  let n = len(arr);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n - i - 1; j += 1) {
      if (arr[j] > arr[j + 1]) {
        let temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
      }
    }
  }
  arr
};

let compose = fn(f, g) { fn(x) { f(g(x)) } };
let pipe2 = fn(f, g) { fn(x) { g(f(x)) } };
let partial = fn(f, a) { fn(b) { f(a, b) } };
let memoize = fn(f) {
  let cache = {};
  fn(x) {
    let key = str(x);
    if (cache[key] == null) {
      cache[key] = f(x);
    }
    cache[key]
  }
};
let flip = fn(f) { fn(a, b) { f(b, a) } };
let always = fn(x) { fn() { x } };
let apply = fn(f, args) { f(args[0], args[1]) };
`;

// Helper to prepend stdlib to user code
export function withStdlib(code) {
  return STDLIB_SOURCE + '\n' + code;
}
