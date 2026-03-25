// Monkey standard library
// Higher-order array functions and utilities

export const STDLIB_SOURCE = `
let map = fn(arr, f) {
  let result = [];
  let i = 0;
  while (i < len(arr)) {
    result = push(result, f(arr[i]));
    i = i + 1;
  }
  result
};

let filter = fn(arr, f) {
  let result = [];
  let i = 0;
  while (i < len(arr)) {
    if (f(arr[i])) {
      result = push(result, arr[i]);
    }
    i = i + 1;
  }
  result
};

let reduce = fn(arr, initial, f) {
  let acc = initial;
  let i = 0;
  while (i < len(arr)) {
    acc = f(acc, arr[i]);
    i = i + 1;
  }
  acc
};

let forEach = fn(arr, f) {
  let i = 0;
  while (i < len(arr)) {
    f(arr[i]);
    i = i + 1;
  }
};

let range = fn(n) {
  let result = [];
  let i = 0;
  while (i < n) {
    result = push(result, i);
    i = i + 1;
  }
  result
};

let contains = fn(arr, val) {
  let i = 0;
  while (i < len(arr)) {
    if (arr[i] == val) { return true; }
    i = i + 1;
  }
  false
};

let reverse = fn(arr) {
  let result = [];
  let i = len(arr) - 1;
  while (i > 0 - 1) {
    result = push(result, arr[i]);
    i = i - 1;
  }
  result
};
`;

// Helper to prepend stdlib to user code
export function withStdlib(code) {
  return STDLIB_SOURCE + '\n' + code;
}
