// ===== Sorting Algorithms with Operation Counting =====

class Stats {
  constructor() { this.comparisons = 0; this.swaps = 0; this.copies = 0; }
  compare(a, b) { this.comparisons++; return a - b; }
  swap(arr, i, j) { this.swaps++; [arr[i], arr[j]] = [arr[j], arr[i]]; }
}

// ===== Quicksort (Lomuto partition) =====

export function quicksort(arr) {
  const a = [...arr];
  const stats = new Stats();
  _quicksort(a, 0, a.length - 1, stats);
  return { sorted: a, stats };
}

function _quicksort(a, lo, hi, stats) {
  if (lo >= hi) return;
  const p = partition(a, lo, hi, stats);
  _quicksort(a, lo, p - 1, stats);
  _quicksort(a, p + 1, hi, stats);
}

function partition(a, lo, hi, stats) {
  const pivot = a[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (stats.compare(a[j], pivot) <= 0) {
      stats.swap(a, i, j);
      i++;
    }
  }
  stats.swap(a, i, hi);
  return i;
}

// ===== Mergesort =====

export function mergesort(arr) {
  const a = [...arr];
  const stats = new Stats();
  _mergesort(a, 0, a.length - 1, stats);
  return { sorted: a, stats };
}

function _mergesort(a, lo, hi, stats) {
  if (lo >= hi) return;
  const mid = (lo + hi) >> 1;
  _mergesort(a, lo, mid, stats);
  _mergesort(a, mid + 1, hi, stats);
  merge(a, lo, mid, hi, stats);
}

function merge(a, lo, mid, hi, stats) {
  const tmp = [];
  let i = lo, j = mid + 1;
  while (i <= mid && j <= hi) {
    if (stats.compare(a[i], a[j]) <= 0) { tmp.push(a[i++]); stats.copies++; }
    else { tmp.push(a[j++]); stats.copies++; }
  }
  while (i <= mid) { tmp.push(a[i++]); stats.copies++; }
  while (j <= hi) { tmp.push(a[j++]); stats.copies++; }
  for (let k = 0; k < tmp.length; k++) { a[lo + k] = tmp[k]; stats.copies++; }
}

// ===== Heapsort =====

export function heapsort(arr) {
  const a = [...arr];
  const n = a.length;
  const stats = new Stats();
  
  // Build max heap
  for (let i = (n >> 1) - 1; i >= 0; i--) heapify(a, n, i, stats);
  
  // Extract
  for (let i = n - 1; i > 0; i--) {
    stats.swap(a, 0, i);
    heapify(a, i, 0, stats);
  }
  
  return { sorted: a, stats };
}

function heapify(a, n, i, stats) {
  let largest = i;
  const l = 2 * i + 1, r = 2 * i + 2;
  if (l < n && stats.compare(a[l], a[largest]) > 0) largest = l;
  if (r < n && stats.compare(a[r], a[largest]) > 0) largest = r;
  if (largest !== i) { stats.swap(a, i, largest); heapify(a, n, largest, stats); }
}

// ===== Insertion sort (used by timsort) =====

export function insertionSort(arr, lo = 0, hi = arr.length - 1, stats = new Stats()) {
  for (let i = lo + 1; i <= hi; i++) {
    const key = arr[i];
    let j = i - 1;
    while (j >= lo && stats.compare(arr[j], key) > 0) {
      arr[j + 1] = arr[j]; stats.copies++;
      j--;
    }
    arr[j + 1] = key; stats.copies++;
  }
  return stats;
}

// ===== Timsort (simplified) =====

export function timsort(arr) {
  const a = [...arr];
  const stats = new Stats();
  const minRun = 32;
  const n = a.length;
  
  // Sort individual runs with insertion sort
  for (let i = 0; i < n; i += minRun) {
    insertionSort(a, i, Math.min(i + minRun - 1, n - 1), stats);
  }
  
  // Merge runs
  for (let size = minRun; size < n; size *= 2) {
    for (let lo = 0; lo < n; lo += 2 * size) {
      const mid = Math.min(lo + size - 1, n - 1);
      const hi = Math.min(lo + 2 * size - 1, n - 1);
      if (mid < hi) merge(a, lo, mid, hi, stats);
    }
  }
  
  return { sorted: a, stats };
}

// ===== Introsort (quicksort + heapsort fallback) =====

export function introsort(arr) {
  const a = [...arr];
  const stats = new Stats();
  const maxDepth = Math.floor(2 * Math.log2(a.length));
  _introsort(a, 0, a.length - 1, maxDepth, stats);
  return { sorted: a, stats };
}

function _introsort(a, lo, hi, depth, stats) {
  if (hi - lo < 16) {
    insertionSort(a, lo, hi, stats);
    return;
  }
  if (depth === 0) {
    // Heapsort fallback
    const sub = a.slice(lo, hi + 1);
    const { sorted } = heapsort(sub);
    for (let i = 0; i < sorted.length; i++) a[lo + i] = sorted[i];
    return;
  }
  const p = partition(a, lo, hi, stats);
  _introsort(a, lo, p - 1, depth - 1, stats);
  _introsort(a, p + 1, hi, depth - 1, stats);
}

// ===== Benchmark utility =====

export function benchmark(size = 1000) {
  const data = Array.from({ length: size }, () => Math.random() * 10000 | 0);
  const results = {};
  
  for (const [name, fn] of [['quicksort', quicksort], ['mergesort', mergesort], ['heapsort', heapsort], ['timsort', timsort], ['introsort', introsort]]) {
    const start = performance.now();
    const { stats } = fn(data);
    const time = performance.now() - start;
    results[name] = { ...stats, time: Math.round(time * 100) / 100 };
  }
  
  return results;
}
