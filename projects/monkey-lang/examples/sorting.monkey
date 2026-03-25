// Sorting algorithms with in-place mutation
// Demonstrates: array mutation, for-loops, break, template literals

// Bubble Sort — O(n²) but simple
let bubble_sort = fn(arr) {
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

// Selection Sort — also O(n²), fewer swaps
let selection_sort = fn(arr) {
  let n = len(arr);
  for (let i = 0; i < n - 1; i += 1) {
    let min_idx = i;
    for (let j = i + 1; j < n; j += 1) {
      if (arr[j] < arr[min_idx]) {
        min_idx = j;
      }
    }
    if (min_idx != i) {
      let temp = arr[i];
      arr[i] = arr[min_idx];
      arr[min_idx] = temp;
    }
  }
  arr
};

puts("=== Bubble Sort ===");
let data1 = [38, 27, 43, 3, 9, 82, 10];
puts(`Input:  ${str(data1)}`);
bubble_sort(data1);
puts(`Sorted: ${str(data1)}`);

puts("\n=== Selection Sort ===");
let data2 = [64, 25, 12, 22, 11];
puts(`Input:  ${str(data2)}`);
selection_sort(data2);
puts(`Sorted: ${str(data2)}`);

puts("\n=== Sort Strings ===");
let words = ["banana", "apple", "cherry", "date", "elderberry"];
puts(`Input:  ${str(words)}`);
bubble_sort(words);
puts(`Sorted: ${str(words)}`);
