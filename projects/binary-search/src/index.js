// ===== Binary Search Variants =====

// Standard binary search — returns index or -1
export function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

// Lower bound: first index where arr[i] >= target
export function lowerBound(arr, target) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Upper bound: first index where arr[i] > target
export function upperBound(arr, target) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Search insert position (same as lowerBound)
export function searchInsert(arr, target) { return lowerBound(arr, target); }

// Count occurrences of target
export function count(arr, target) { return upperBound(arr, target) - lowerBound(arr, target); }

// First and last occurrence
export function firstOccurrence(arr, target) {
  const i = lowerBound(arr, target);
  return i < arr.length && arr[i] === target ? i : -1;
}
export function lastOccurrence(arr, target) {
  const i = upperBound(arr, target) - 1;
  return i >= 0 && arr[i] === target ? i : -1;
}

// Search in rotated sorted array
export function searchRotated(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === target) return mid;
    
    if (arr[lo] <= arr[mid]) {
      // Left half is sorted
      if (target >= arr[lo] && target < arr[mid]) hi = mid - 1;
      else lo = mid + 1;
    } else {
      // Right half is sorted
      if (target > arr[mid] && target <= arr[hi]) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  return -1;
}

// Find minimum in rotated sorted array
export function findMinRotated(arr) {
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] > arr[hi]) lo = mid + 1;
    else hi = mid;
  }
  return arr[lo];
}

// Find peak element (any local maximum)
export function findPeak(arr) {
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < arr[mid + 1]) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Generic binary search on answer (bisect)
export function bisect(lo, hi, predicate) {
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (predicate(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
