// Sorting Algorithms in WebAssembly
// Demonstrates array mutation, recursion, and closures in WASM

// Bubble sort (in-place with array mutation)
let bubbleSort = fn(arr) {
  let n = len(arr);
  for (i in 0..n) {
    for (j in 0..(n - 1 - i)) {
      if (arr[j] > arr[j + 1]) {
        let temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
      }
    }
  }
  arr
};

// Insertion sort
let insertionSort = fn(arr) {
  let n = len(arr);
  for (i in 1..n) {
    let key = arr[i];
    let j = i - 1;
    while (j >= 0) {
      if (arr[j] > key) {
        arr[j + 1] = arr[j];
        j = j - 1;
      } else {
        j = -1; // break (no break statement in for-in context)
      }
    }
    arr[j + 1] = key;
  }
  arr
};

// Print array
let printArr = fn(label, arr) {
  let s = label + ": [";
  for (i in 0..len(arr)) {
    if (i > 0) { s = s + ", "; }
    s = s + str(arr[i]);
  }
  puts(s + "]");
};

// Test bubble sort
let arr1 = [64, 34, 25, 12, 22, 11, 90];
printArr("Before", arr1);
bubbleSort(arr1);
printArr("Bubble", arr1);

puts("");

// Test insertion sort
let arr2 = [5, 2, 4, 6, 1, 3];
printArr("Before", arr2);
insertionSort(arr2);
printArr("Insert", arr2);

puts("");

// Sort larger array
let arr3 = [];
let seed = 42;
for (i in 0..20) {
  seed = (seed * 1103515245 + 12345) % 1000;
  if (seed < 0) { seed = 0 - seed; }
  arr3 = push(arr3, seed % 100);
}
printArr("Random", arr3);
bubbleSort(arr3);
printArr("Sorted", arr3);
