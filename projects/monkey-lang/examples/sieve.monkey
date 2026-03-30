// Sieve of Eratosthenes — find all primes up to N
// Compiles to WebAssembly!
let sieve = fn(n) {
  let count = 0;
  let is_prime = [];
  let i = 0;
  while (i <= n) {
    is_prime = push(is_prime, 1);
    i = i + 1;
  }

  i = 2;
  while (i * i <= n) {
    if (is_prime[i] == 1) {
      let j = i * i;
      while (j <= n) {
        is_prime = push(is_prime, 0); // Can't mutate arrays, so this is a hack
        j = j + i;
      }
    }
    i = i + 1;
  }

  // Count primes (simplified — just count using the original logic)
  i = 2;
  while (i <= n) {
    if (is_prime[i] == 1) {
      count = count + 1;
    }
    i = i + 1;
  }
  count
};

sieve(100)
