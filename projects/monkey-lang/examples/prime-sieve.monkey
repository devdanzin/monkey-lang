// Find all primes below 100 using the algorithms module
import "algorithms" for isPrime;

let primes = [];
for (let n = 2; n < 100; n += 1) {
  if (isPrime(n)) {
    primes = push(primes, n);
  }
}
puts("Primes below 100:");
puts(primes);
puts("Count: " + str(primes.length));
