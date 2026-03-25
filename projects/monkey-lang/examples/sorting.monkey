// Insertion sort with immutable arrays
// Demonstrates: for-in, break, push, closures, template literals

let insertion_sort = fn(arr) {
  let sorted = [];
  for (x in arr) {
    let inserted = false;
    let result = [];
    for (s in sorted) {
      if (!inserted) {
        if (x < s) {
          result = push(result, x);
          inserted = true;
        }
      }
      result = push(result, s);
    }
    if (!inserted) {
      result = push(result, x);
    }
    sorted = result;
  }
  sorted
};

let data = [38, 27, 43, 3, 9, 82, 10];
puts(`Input:  ${str(data)}`);
let result = insertion_sort(data);
puts(`Sorted: ${str(result)}`);

// Sort strings lexicographically
let words = ["banana", "apple", "cherry", "date"];
puts(`\nWords:  ${str(words)}`);
puts(`Sorted: ${str(insertion_sort(words))}`);
