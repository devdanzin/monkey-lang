// Fibonacci Tower — visual ASCII art
// Each row shows a Fibonacci number as a bar

let fib = fn(n) {
  if (n <= 1) { n } else { fib(n - 1) + fib(n - 2) }
};

let repeat = fn(ch, n) {
  let s = "";
  for (i in 0..n) { s = s + ch; }
  s
};

let center = fn(text, width) {
  let padding = (width - len(text)) / 2;
  repeat(" ", padding) + text
};

let width = 40;
puts(center("★ Fibonacci Tower ★", width));
puts(center("=" + repeat("=", 18) + "=", width));
puts("");

for (i in 1..13) {
  let n = fib(i);
  let bar = repeat("█", n);
  let label = str(n);
  let line = repeat(" ", 3 - len(label)) + label + " " + bar;
  puts(line);
}

puts("");
puts(center("Built with Monkey + WASM", width));
