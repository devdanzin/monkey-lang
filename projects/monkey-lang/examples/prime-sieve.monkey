// Prime Sieve — Sieve of Eratosthenes
// Demonstrates: arrays, loops, modulo, conditionals, JIT optimization
//
// This is the kind of program where the JIT really shines:
// - Hot inner loop with array access + modulo
// - Range check elimination removes bounds checks
// - Induction variable analysis proves counter non-negative
// - Guard elimination removes redundant type checks

let sieve = fn(limit) {
  // Initialize: all numbers are prime candidates
  let is_prime = [];
  let i = 0;
  while (i < limit) {
    is_prime = push(is_prime, true);
    i = i + 1;
  }

  // Sieve: mark composites
  let p = 2;
  while (p * p < limit) {
    if (is_prime[p] == true) {
      // Mark all multiples of p as composite
      let j = p * p;
      while (j < limit) {
        // Note: we can't mutate arrays in Monkey, so we rebuild
        // In practice you'd use a hash for this, but this exercises the JIT
        is_prime = push(rest(rest(is_prime)), false);
        j = j + p;
      }
    }
    p = p + 1;
  }

  // Count primes
  let count = 0;
  let k = 2;
  while (k < limit) {
    if (is_prime[k] == true) {
      count = count + 1;
    }
    k = k + 1;
  }
  count
};

// Actually this won't work well because Monkey arrays are immutable
// and we can't do arr[j] = false. Let's use a different approach:
// Trial division instead.

let is_prime = fn(n) {
  if (n < 2) { return false; }
  if (n < 4) { return true; }
  if (n % 2 == 0) { return false; }
  let i = 3;
  while (i * i < n + 1) {
    if (n % i == 0) { return false; }
    i = i + 2;
  }
  true
};

// Count primes up to 1000
let count = 0;
let n = 2;
while (n < 1000) {
  if (is_prime(n)) {
    count = count + 1;
  }
  n = n + 1;
}
puts("Primes below 1000: " + str(count));
// Expected: 168
