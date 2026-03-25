// Quicksort with in-place mutation
// Demonstrates: recursion, array mutation, slicing, ternary

let swap = fn(arr, i, j) {
  let temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;
};

let partition = fn(arr, lo, hi) {
  let pivot = arr[hi];
  let i = lo;
  for (let j = lo; j < hi; j += 1) {
    if (arr[j] <= pivot) {
      swap(arr, i, j);
      i += 1;
    }
  }
  swap(arr, i, hi);
  i
};

let quicksort_helper = fn(arr, lo, hi) {
  if (lo < hi) {
    let p = partition(arr, lo, hi);
    quicksort_helper(arr, lo, p - 1);
    quicksort_helper(arr, p + 1, hi);
  }
};

let quicksort = fn(arr) {
  quicksort_helper(arr, 0, len(arr) - 1);
  arr
};

// Demo
let data = [38, 27, 43, 3, 9, 82, 10, 64, 25, 12, 22, 11, 55, 7, 99, 1];
puts(`Input:  ${str(data)}`);
quicksort(data);
puts(`Sorted: ${str(data)}`);

// Verify it's sorted
let is_sorted = true;
for (let i = 0; i < len(data) - 1; i += 1) {
  if (data[i] > data[i + 1]) {
    is_sorted = false;
    break;
  }
}
puts(`Correctly sorted: ${str(is_sorted)}`);

// Sort 100 elements
let big = [];
let seed = 42;
for (let i = 0; i < 100; i += 1) {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  big = push(big, seed % 1000);
}
quicksort(big);
let sorted_ok = true;
for (let i = 0; i < 99; i += 1) {
  if (big[i] > big[i + 1]) {
    sorted_ok = false;
    break;
  }
}
puts(`100 elements sorted correctly: ${str(sorted_ok)}`);
