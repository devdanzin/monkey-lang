// Monkey Language Showcase
// Demonstrates ALL language features in one program

puts("=" * 50);
puts("  Monkey Language Feature Showcase");
puts("=" * 50);

// 1. Variables and types
let name = "Monkey";
let version = 2;
let features = ["for-loops", "match", "destructuring", "closures"];
puts(`\n1. ${name} v${version} with ${len(features)} features`);

// 2. For-in iteration
puts("\n2. Language features:");
for (f in features) { puts(`   - ${f}`); }

// 3. Closures and default params
let makeGreeter = fn(prefix = "Hello") {
  fn(name) { `${prefix}, ${name}!` }
};
let greet = makeGreeter();
let wave = makeGreeter("Hey");
puts(`\n3. ${greet("World")} ${wave("Monkey")}`);

// 4. Match expressions
let classify = fn(n) {
  match (n % 3) {
    0 => "divisible by 3",
    1 => "remainder 1",
    _ => "remainder 2"
  }
};
puts(`\n4. 15 is ${classify(15)}, 7 is ${classify(7)}`);

// 5. Array operations
let data = [5, 3, 8, 1, 9, 2, 7, 4, 6];
puts(`\n5. Original: ${str(data)}`);

// Quicksort with i++ and array mutation
let swap = fn(a, i, j) { let t = a[i]; a[i] = a[j]; a[j] = t; };
let qs = fn(a, lo, hi) {
  if (lo >= hi) { return null; }
  let p = a[hi]; let i = lo;
  for (let j = lo; j < hi; j++) {
    if (a[j] <= p) { swap(a, i, j); i++; }
  }
  swap(a, i, hi);
  qs(a, lo, i - 1); qs(a, i + 1, hi);
};
qs(data, 0, len(data) - 1);
puts(`   Sorted: ${str(data)}`);
puts(`   Slice [2:5]: ${str(data[2:5])}`);
puts(`   Last: ${data[-1]}, First: ${data[0]}`);

// 6. Destructuring
let [min_val, _, _, _, _, _, _, _, max_val] = data;
puts(`\n6. Min: ${min_val}, Max: ${max_val}`);

// 7. String operations
let text = "Hello, Monkey World!";
puts(`\n7. "${text}"`);
puts(`   Upper: ${upper(text)}`);
puts(`   Words: ${str(split(text, " "))}`);
puts(`   Starts with "Hello": ${startsWith(text, "Hello")}`);

// 8. Ternary and null
let maybe = fn(x) { x != null ? x : "default" };
puts(`\n8. maybe(42) = ${maybe(42)}, maybe(null) = ${maybe(null)}`);

// 9. Higher-order functions with for-in
let evens = [];
let squares = [];
for (x in data) {
  if (x % 2 == 0) { evens = push(evens, x); }
  squares = push(squares, x * x);
}
puts(`\n9. Evens: ${str(evens)}`);
puts(`   Squares: ${str(squares)}`);

// 10. Mutable counter closure
let counter = fn() {
  let n = 0;
  fn() { n = n + 1; n }
};
let c = counter();
puts(`\n10. Counter: ${c()}, ${c()}, ${c()}`);

puts("\n" + "=" * 50);
puts(`  ${len(data)} elements sorted, ${len(features)} features shown!`);
puts("=" * 50);
