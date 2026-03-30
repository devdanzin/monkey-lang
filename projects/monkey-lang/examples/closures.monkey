// Higher-order functions showcase
// Demonstrates closures compiling to WebAssembly

let makeAdder = fn(x) { fn(y) { x + y } };
let add10 = makeAdder(10);
let add20 = makeAdder(20);

puts("add10(5) = " + str(add10(5)));
puts("add20(5) = " + str(add20(5)));

// Function composition
let compose = fn(f, g) {
  fn(x) { f(g(x)) }
};

let double = fn(x) { x * 2 };
let inc = fn(x) { x + 1 };
let doubleAndInc = compose(inc, double);

puts("doubleAndInc(5) = " + str(doubleAndInc(5)));

// Iterative power using closures
let makePower = fn(exp) {
  fn(base) {
    let result = 1;
    let i = 0;
    while (i < exp) {
      result = result * base;
      i = i + 1;
    }
    result
  }
};

let square = makePower(2);
let cube = makePower(3);

puts("square(5) = " + str(square(5)));
puts("cube(3) = " + str(cube(3)));
