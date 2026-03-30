// Numeric Benchmark Suite for WASM Backend
// Tests various computation patterns

// 1. Matrix multiply (3x3 using flat arrays)
let matMul = fn(a, b) {
  let c = [0,0,0,0,0,0,0,0,0];
  for (i in 0..3) {
    for (j in 0..3) {
      let sum = 0;
      for (k in 0..3) {
        sum += a[i*3+k] * b[k*3+j];
      }
      c[i*3+j] = sum;
    }
  }
  c
};

let identity = [1,0,0, 0,1,0, 0,0,1];
let scale2 = [2,0,0, 0,2,0, 0,0,2];

let result = matMul(identity, scale2);
puts("Matrix multiply:");
for (i in 0..3) {
  puts("  [" + str(result[i*3]) + " " + str(result[i*3+1]) + " " + str(result[i*3+2]) + "]");
}

// 2. Sieve of Eratosthenes
let sieve = fn(n) {
  let is_prime = [];
  for (i in 0..n) { is_prime = push(is_prime, 1); }
  is_prime[0] = 0;
  is_prime[1] = 0;
  for (i in 2..n) {
    if (is_prime[i] == 1) {
      let j = i * i;
      while (j < n) {
        is_prime[j] = 0;
        j += i;
      }
    }
  }
  let count = 0;
  for (i in 0..n) { if (is_prime[i] == 1) { count += 1; } }
  count
};

puts("");
let primeCount = sieve(100);
puts("Primes under 100: " + str(primeCount));

// 3. GCD and LCM
let gcd = fn(a, b) {
  while (b != 0) {
    let temp = b;
    b = a % b;
    a = temp;
  }
  a
};

puts("");
puts("GCD(48, 18) = " + str(gcd(48, 18)));
// LCM = a / gcd(a,b) * b
let a = 12;
let b = 18;
let g = gcd(a, b);
puts("LCM(12, 18) = " + str(a / g * b));

// 4. Collatz sequence
let collatz = fn(n) {
  let steps = 0;
  while (n != 1) {
    if (n % 2 == 0) { n = n / 2; }
    else { n = 3 * n + 1; }
    steps += 1;
  }
  steps
};

puts("");
puts("Collatz(27) steps: " + str(collatz(27)));
puts("Collatz(97) steps: " + str(collatz(97)));

// 5. Power (iterative)
let pow = fn(base, exp) {
  let result = 1;
  for (i in 0..exp) { result *= base; }
  result
};

puts("");
puts("2^10 = " + str(pow(2, 10)));
puts("3^7 = " + str(pow(3, 7)));
