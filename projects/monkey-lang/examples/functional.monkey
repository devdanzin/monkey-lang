// Functional programming patterns
import "math" for pow, sqrt;
import "algorithms" for fibonacci, factorial;

// Map + filter using stdlib
let numbers = range(1, 20);
let squares = map(numbers, fn(x) { pow(x, 2) });
let evens = filter(squares, fn(x) { x % 2 == 0 });
puts("Even squares 1-20: ");
puts(evens);

// Fibonacci sequence
let fibs = map(range(1, 15), fn(n) { fibonacci(n) });
puts("First 14 Fibonacci numbers:");
puts(fibs);

// Factorial growth
for (n in 1..10) {
  puts(str(n) + "! = " + str(factorial(n)));
}
