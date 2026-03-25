// Simple expression evaluator — a calculator in Monkey
// Demonstrates: recursion, match, string operations, closures

// Tokenizer
let tokenize = fn(input) {
  let tokens = [];
  let i = 0;
  while (i < len(input)) {
    let ch = input[i];
    if (ch == " ") {
      i++;
      continue;
    }
    if (ch == "+" || ch == "-" || ch == "*" || ch == "/" || ch == "(" || ch == ")") {
      tokens = push(tokens, ch);
      i++;
      continue;
    }
    // Number
    if (ord(ch) >= ord("0") && ord(ch) <= ord("9")) {
      let num = "";
      while (i < len(input) && ord(input[i]) >= ord("0") && ord(input[i]) <= ord("9")) {
        num = num + input[i];
        i++;
      }
      tokens = push(tokens, int(num));
      continue;
    }
    i++;
  }
  tokens
};

// Recursive descent parser + evaluator
let pos = 0;
let tokens = [];

let peek = fn() {
  if (pos < len(tokens)) { tokens[pos] } else { null }
};

let consume = fn() {
  let t = tokens[pos];
  pos = pos + 1;
  t
};

// Expression = Term (('+' | '-') Term)*
let parseExpr = fn() {
  let left = parseTerm();
  while (peek() == "+" || peek() == "-") {
    let op = consume();
    let right = parseTerm();
    if (op == "+") { left = left + right; }
    if (op == "-") { left = left - right; }
  }
  left
};

// Term = Factor (('*' | '/') Factor)*
let parseTerm = fn() {
  let left = parseFactor();
  while (peek() == "*" || peek() == "/") {
    let op = consume();
    let right = parseFactor();
    if (op == "*") { left = left * right; }
    if (op == "/") { left = left / right; }
  }
  left
};

// Factor = Number | '(' Expr ')'
let parseFactor = fn() {
  let t = peek();
  if (t == "(") {
    consume(); // skip (
    let result = parseExpr();
    consume(); // skip )
    return result;
  }
  consume()
};

let calc = fn(input) {
  tokens = tokenize(input);
  pos = 0;
  parseExpr()
};

// Demo
let expressions = [
  "2 + 3",
  "10 - 4 * 2",
  "(10 - 4) * 2",
  "100 / (5 + 5)",
  "2 * (3 + 4) * (5 - 1)"
];

puts("Calculator Demo:");
puts("-" * 30);
for (expr in expressions) {
  puts(`  ${expr} = ${calc(expr)}`);
}
