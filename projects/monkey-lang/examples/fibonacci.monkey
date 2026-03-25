// Fibonacci table — demonstrates recursion, for-loops, and template literals

let fib = fn(n) {
  if (n < 2) { return n; }
  fib(n - 1) + fib(n - 2)
};

puts("Fibonacci Numbers");
puts("-" * 30);
for (let i = 0; i < 20; i += 1) {
  puts(`fib(${i}) = ${fib(i)}`);
}
