// Collatz conjecture — count steps until reaching 1
let collatz = fn(n) {
  let steps = 0;
  while (n != 1) {
    if (n % 2 == 0) {
      n = n / 2;
    } else {
      n = n * 3 + 1;
    }
    steps = steps + 1;
  }
  steps
};

// Test: 27 takes 111 steps
puts("collatz(27) = " + str(collatz(27)));
puts("collatz(1) = " + str(collatz(1)));
puts("collatz(100) = " + str(collatz(100)));

// Find the number under 1000 with the most steps
let maxSteps = 0;
let maxN = 0;
let i = 1;
while (i < 1000) {
  let s = collatz(i);
  if (s > maxSteps) {
    maxSteps = s;
    maxN = i;
  }
  i = i + 1;
}
puts("Longest under 1000: " + str(maxN) + " with " + str(maxSteps) + " steps")
