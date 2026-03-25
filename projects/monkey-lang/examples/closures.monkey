// Closure examples — demonstrates first-class functions and higher-order functions

// Currying
let add = fn(a) { fn(b) { a + b } };
let add10 = add(10);
puts(`10 + 5 = ${add10(5)}`);
puts(`10 + 20 = ${add10(20)}`);

// Compose
let compose = fn(f, g) { fn(x) { f(g(x)) } };
let double = fn(x) { x * 2 };
let inc = fn(x) { x + 1 };
let doubleInc = compose(double, inc);
puts(`double(inc(4)) = ${doubleInc(4)}`);
puts(`double(inc(10)) = ${doubleInc(10)}`);

// Higher-order: apply
let apply_twice = fn(f, x) { f(f(x)) };
puts(`double(double(3)) = ${apply_twice(double, 3)}`);

// Map and filter with closures
let data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
let evens = [];
for (x in data) {
  if (x % 2 == 0) { evens = push(evens, x); }
}
let doubled = [];
for (x in evens) {
  doubled = push(doubled, double(x));
}
puts(`Evens doubled: ${str(doubled)}`);

// Recursive fibonacci with memoization (manual)
let fib_memo = fn(n) {
  let a = 0;
  let b = 1;
  for (let i = 0; i < n; i += 1) {
    let temp = b;
    b = a + b;
    a = temp;
  }
  a
};
puts(`\nFibonacci (iterative):`);
for (let i = 0; i < 15; i += 1) {
  puts(`  fib(${i}) = ${fib_memo(i)}`);
}
