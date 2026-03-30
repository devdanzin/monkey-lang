// Numerical computation showcase for WASM backend
// This program demonstrates multiple computational patterns
// that compile efficiently to WebAssembly.

// 1. Recursive Fibonacci
let fib = fn(n) {
  if (n <= 1) { n } else { fib(n - 1) + fib(n - 2) }
};

// 2. Iterative factorial
let factorial = fn(n) {
  let result = 1;
  for (let i = 2; i <= n; i = i + 1) {
    result = result * i;
  }
  result
};

// 3. GCD via Euclidean algorithm
let gcd = fn(a, b) {
  if (b == 0) { a } else { gcd(b, a % b) }
};

// 4. Power function
let pow = fn(base, exp) {
  if (exp == 0) { 1 } else { base * pow(base, exp - 1) }
};

// 5. Collatz sequence length
let collatz = fn(n) {
  let steps = 0;
  while (n != 1) {
    if (n % 2 == 0) { n = n / 2; } else { n = n * 3 + 1; }
    steps = steps + 1;
  }
  steps
};

// 6. Sum of squares using closures
let makeSquarer = fn() {
  fn(x) { x * x }
};
let square = makeSquarer();

// Run computations
puts(`fib(25) = ${fib(25)}`);
puts(`factorial(10) = ${factorial(10)}`);
puts(`gcd(252, 105) = ${gcd(252, 105)}`);
puts(`2^20 = ${pow(2, 20)}`);
puts(`collatz(27) = ${collatz(27)} steps`);

// Sum of squares 1..100
let sumSquares = 0;
for (i in 1..101) {
  sumSquares = sumSquares + square(i);
}
puts(`sum of squares 1..100 = ${sumSquares}`);

// Prime check
let isPrime = fn(n) {
  if (n < 2) { return 0; }
  let i = 2;
  while (i * i <= n) {
    if (n % i == 0) { return 0; }
    i = i + 1;
  }
  1
};

// Count primes under 1000
let primeCount = 0;
for (n in 2..1000) {
  if (isPrime(n) == 1) {
    primeCount = primeCount + 1;
  }
}
puts(`primes under 1000: ${primeCount}`);
