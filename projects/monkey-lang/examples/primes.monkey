// Prime number generation
// Demonstrates: for loops, break, functions, template literals, array mutation

let is_prime = fn(n) {
  if (n < 2) { return false; }
  if (n < 4) { return true; }
  if (n % 2 == 0) { return false; }
  let i = 3;
  while (i * i <= n) {
    if (n % i == 0) { return false; }
    i += 2;
  }
  true
};

// Find first 50 primes
let primes = [];
let n = 2;
while (len(primes) < 50) {
  if (is_prime(n)) {
    primes = push(primes, n);
  }
  n++;
}

puts("First 50 primes:");
puts("-" * 40);
let line = "";
for (let i = 0; i < len(primes); i++) {
  let p = primes[i];
  let ps = str(p);
  if (len(ps) < 4) { ps = " " * (4 - len(ps)) + ps; }
  line = line + ps;
  if ((i + 1) % 10 == 0) {
    puts(line);
    line = "";
  }
}
if (len(line) > 0) { puts(line); }

puts(`\nLargest: ${primes[-1]}`);

// Twin primes
puts("\nTwin primes (p, p+2):");
for (let i = 0; i < len(primes) - 1; i++) {
  if (primes[i + 1] - primes[i] == 2) {
    puts(`  (${primes[i]}, ${primes[i + 1]})`);
  }
}
