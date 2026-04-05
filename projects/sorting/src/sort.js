// sort.js — Sorting algorithms

export function bubbleSort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length; i++) {
    let swapped = false;
    for (let j = 0; j < a.length - i - 1; j++) {
      if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; swapped = true; }
    }
    if (!swapped) break;
  }
  return a;
}

export function selectionSort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length; i++) {
    let min = i;
    for (let j = i + 1; j < a.length; j++) if (a[j] < a[min]) min = j;
    if (min !== i) [a[i], a[min]] = [a[min], a[i]];
  }
  return a;
}

export function insertionSort(arr) {
  const a = [...arr];
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; j--; }
    a[j + 1] = key;
  }
  return a;
}

export function mergeSort(arr) {
  if (arr.length <= 1) return [...arr];
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  return merge(left, right);
}

function merge(a, b) {
  const result = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) result.push(a[i] <= b[j] ? a[i++] : b[j++]);
  while (i < a.length) result.push(a[i++]);
  while (j < b.length) result.push(b[j++]);
  return result;
}

export function quickSort(arr) {
  const a = [...arr];
  _quickSort(a, 0, a.length - 1);
  return a;
}

function _quickSort(a, lo, hi) {
  if (lo >= hi) return;
  const pivot = a[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (a[j] <= pivot) { [a[i], a[j]] = [a[j], a[i]]; i++; }
  }
  [a[i], a[hi]] = [a[hi], a[i]];
  _quickSort(a, lo, i - 1);
  _quickSort(a, i + 1, hi);
}

export function quickSortHoare(arr) {
  const a = [...arr];
  _quickSortH(a, 0, a.length - 1);
  return a;
}

function _quickSortH(a, lo, hi) {
  if (lo >= hi) return;
  const pivot = a[Math.floor((lo + hi) / 2)];
  let i = lo, j = hi;
  while (i <= j) {
    while (a[i] < pivot) i++;
    while (a[j] > pivot) j--;
    if (i <= j) { [a[i], a[j]] = [a[j], a[i]]; i++; j--; }
  }
  if (lo < j) _quickSortH(a, lo, j);
  if (i < hi) _quickSortH(a, i, hi);
}

export function heapSort(arr) {
  const a = [...arr];
  const n = a.length;
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) heapify(a, n, i);
  for (let i = n - 1; i > 0; i--) { [a[0], a[i]] = [a[i], a[0]]; heapify(a, i, 0); }
  return a;
}

function heapify(a, n, i) {
  let largest = i;
  const l = 2 * i + 1, r = 2 * i + 2;
  if (l < n && a[l] > a[largest]) largest = l;
  if (r < n && a[r] > a[largest]) largest = r;
  if (largest !== i) { [a[i], a[largest]] = [a[largest], a[i]]; heapify(a, n, largest); }
}

export function countingSort(arr) {
  if (arr.length === 0) return [];
  const min = Math.min(...arr), max = Math.max(...arr);
  const count = new Array(max - min + 1).fill(0);
  for (const v of arr) count[v - min]++;
  const result = [];
  for (let i = 0; i < count.length; i++) for (let j = 0; j < count[i]; j++) result.push(i + min);
  return result;
}

export function radixSort(arr) {
  if (arr.length === 0) return [];
  const max = Math.max(...arr.map(Math.abs));
  let exp = 1;
  let a = [...arr];
  while (Math.floor(max / exp) > 0) {
    const buckets = Array.from({ length: 10 }, () => []);
    for (const v of a) buckets[Math.floor(Math.abs(v) / exp) % 10].push(v);
    a = buckets.flat();
    exp *= 10;
  }
  // Handle negatives
  const neg = a.filter(x => x < 0).reverse();
  const pos = a.filter(x => x >= 0);
  return [...neg, ...pos];
}

export function shellSort(arr) {
  const a = [...arr];
  let gap = Math.floor(a.length / 2);
  while (gap > 0) {
    for (let i = gap; i < a.length; i++) {
      const temp = a[i];
      let j = i;
      while (j >= gap && a[j - gap] > temp) { a[j] = a[j - gap]; j -= gap; }
      a[j] = temp;
    }
    gap = Math.floor(gap / 2);
  }
  return a;
}

export function bucketSort(arr, bucketCount = 10) {
  if (arr.length === 0) return [];
  const min = Math.min(...arr), max = Math.max(...arr);
  const range = max - min + 1;
  const buckets = Array.from({ length: bucketCount }, () => []);
  for (const v of arr) {
    const idx = Math.min(Math.floor((v - min) / range * bucketCount), bucketCount - 1);
    buckets[idx].push(v);
  }
  return buckets.map(b => insertionSort(b)).flat();
}

// ===== Benchmark =====
export function benchmark(sortFn, sizes = [100, 1000, 10000]) {
  const results = {};
  for (const n of sizes) {
    const arr = Array.from({ length: n }, () => Math.random() * n | 0);
    const start = performance.now();
    sortFn(arr);
    results[n] = performance.now() - start;
  }
  return results;
}
