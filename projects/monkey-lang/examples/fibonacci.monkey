// Fibonacci — recursive
// The JIT traces the recursive calls and achieves ~9x speedup

let fib = fn(n) {
  if (n < 2) { return n; }
  fib(n - 1) + fib(n - 2)
};

puts("Fibonacci sequence:");
let i = 0;
while (i < 15) {
  puts(str(fib(i)));
  i = i + 1;
}

// Compute fib(30) — the JIT really shines here
let result = fib(30);
puts("fib(30) = " + str(result));
