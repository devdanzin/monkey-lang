// Functional Programming Patterns in Monkey
// Demonstrates: closures, higher-order functions, destructuring, for-in

// Pipe: chain functions left to right
let pipe = fn(value, fns) {
  for (f in fns) { value = f(value); }
  value
};

// Transformations
let double = fn(arr) {
  let result = [];
  for (x in arr) { result = push(result, x * 2); }
  result
};

let keep_even = fn(arr) {
  let result = [];
  for (x in arr) { if (x % 2 == 0) { result = push(result, x); } }
  result
};

let total = fn(arr) {
  let s = 0;
  for (x in arr) { s += x; }
  s
};

let data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
let result = pipe(data, [double, keep_even, total]);
puts(`Pipeline: [1..10] |> double |> keep_even |> total = ${result}`);

// Currying
let curry = fn(f) { fn(a) { fn(b) { f(a, b) } } };
let add = curry(fn(a, b) { a + b });
let mul = curry(fn(a, b) { a * b });
puts(`\nCurrying: add(3)(4) = ${add(3)(4)}, mul(5)(6) = ${mul(5)(6)}`);

// Apply-twice
let twice = fn(f) { fn(x) { f(f(x)) } };
let inc = fn(x) { x + 1 };
let double_fn = fn(x) { x * 2 };
puts(`twice(inc)(5) = ${twice(inc)(5)}`);
puts(`twice(double)(3) = ${twice(double_fn)(3)}`);

// Church encoding
let zero = fn(f) { fn(x) { x } };
let succ = fn(n) { fn(f) { fn(x) { f(n(f)(x)) } } };
let to_int = fn(n) { n(fn(x) { x + 1 })(0) };

let one = succ(zero);
let two = succ(one);
let three = succ(two);
puts(`\nChurch: to_int(three) = ${to_int(three)}`);

// Compose
let compose = fn(f, g) { fn(x) { f(g(x)) } };
let add1 = fn(x) { x + 1 };
let mul2 = fn(x) { x * 2 };
let add1_then_mul2 = compose(mul2, add1);
puts(`\nCompose: (x+1)*2 at x=4: ${add1_then_mul2(4)}`);

// Y combinator (self-application for recursion without let-binding)
let Y = fn(f) { fn(x) { f(fn(n) { x(x)(n) }) }(fn(x) { f(fn(n) { x(x)(n) }) }) };
let fact = Y(fn(self) { fn(n) { n == 0 ? 1 : n * self(n - 1) } });
puts(`\nY combinator: fact(10) = ${fact(10)}`);
