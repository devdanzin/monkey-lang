// Closure examples — first-class functions, mutable closures, higher-order functions

// Counter with mutable closure
let makeCounter = fn() {
  let count = 0;
  fn() { count = count + 1; count }
};
let counter = makeCounter();
puts(`Counter: ${counter()}, ${counter()}, ${counter()}`);

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

// Higher-order: apply twice
let apply_twice = fn(f, x) { f(f(x)) };
puts(`double(double(3)) = ${apply_twice(double, 3)}`);

// Map and filter with for-in
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
