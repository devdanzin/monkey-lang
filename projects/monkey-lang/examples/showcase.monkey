// Monkey Language Showcase — demonstrates all major features
// Run with the evaluator: import { monkeyEval } from './evaluator.js'

// === CLASSES ===
class Animal {
  let name;
  let sound;
  
  fn init(name, sound) {
    self.name = name;
    self.sound = sound;
  }
  
  fn speak() {
    self.name + " says " + self.sound + "!";
  }
}

class Dog extends Animal {
  let tricks;
  
  fn init(name) {
    self.name = name;
    self.sound = "Woof";
    self.tricks = [];
  }
  
  fn learn(trick) {
    self.tricks = push(self.tricks, trick);
    self;
  }
  
  fn show() {
    let result = self.name + " knows: ";
    for (t in self.tricks) {
      result = result + t + " ";
    };
    result;
  }
}

// === GENERATORS ===
let fibonacci = gen(limit) {
  let a = 0;
  let b = 1;
  while (a < limit) {
    yield a;
    let tmp = a + b;
    a = b;
    b = tmp;
  };
};

let primes = gen(limit) {
  let sieve = [];
  let i = 0;
  while (i <= limit) { sieve = push(sieve, true); i = i + 1; };
  sieve[0] = false;
  sieve[1] = false;
  let p = 2;
  while (p * p <= limit) {
    if (sieve[p]) {
      let j = p * p;
      while (j <= limit) { sieve[j] = false; j = j + p; };
    };
    p = p + 1;
  };
  let k = 2;
  while (k <= limit) {
    if (sieve[k]) { yield k; };
    k = k + 1;
  };
};

// === STANDARD LIBRARY ===
let nums = range(1, 11);
let evens = filter(nums, fn(x) { x % 2 == 0 });
let doubled = map(evens, fn(x) { x * 2 });
let sum = reduce(doubled, fn(a, b) { a + b }, 0);

// === TRY/CATCH ===
let safe_sqrt = fn(x) {
  try {
    if (x < 0) { throw "cannot take sqrt of negative"; };
    let guess = x / 2;
    let i = 0;
    while (i < 20) {
      guess = (guess + x / guess) / 2;
      i = i + 1;
    };
    guess;
  } catch (e) {
    -1;
  };
};

// === DESTRUCTURING ===
let [first, second, ...rest] = [10, 20, 30, 40, 50];

// === PATTERN MATCHING ===
let classify = fn(x) {
  match (x) {
    0 -> "zero";
    1 -> "one";
    _ -> "many";
  };
};

// === FOR-IN + GENERATORS ===
let fib_sum = 0;
for (n in fibonacci(100)) {
  fib_sum = fib_sum + n;
};

// === CLASSES + GENERATORS ===
let rex = Dog("Rex");
rex.learn("sit").learn("shake").learn("roll");

// === MODULES ===
import "math" for sqrt, PI;

// === RESULTS ===
let results = {
  "sum_doubled_evens": sum,
  "fib_sum_under_100": fib_sum,
  "primes_to_30": [],
  "dog": rex.show(),
  "safe_sqrt_16": safe_sqrt(16),
  "safe_sqrt_neg": safe_sqrt(-1),
  "classify_0": classify(0),
  "first": first,
  "second": second,
  "pi_approx": PI
};

// Collect primes
let prime_list = [];
for (p in primes(30)) { prime_list = push(prime_list, p); };

results;
