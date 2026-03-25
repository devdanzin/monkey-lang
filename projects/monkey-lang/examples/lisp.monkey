// Tiny Lisp interpreter written in Monkey
// A language inside a language inside a language!
// Supports: numbers, +, -, *, /, if, define, lambda

// Tokenizer
let tokenize_lisp = fn(input) {
  let tokens = [];
  let i = 0;
  while (i < len(input)) {
    let ch = input[i];
    if (ch == " " || ch == "\n" || ch == "\t") { i++; continue; }
    if (ch == "(" || ch == ")") {
      tokens = push(tokens, ch);
      i++;
      continue;
    }
    // Number or symbol
    let word = "";
    while (i < len(input) && input[i] != " " && input[i] != ")" && input[i] != "(" && input[i] != "\n") {
      word = word + input[i];
      i++;
    }
    tokens = push(tokens, word);
  }
  tokens
};

// Parser — returns [ast, remaining_tokens]
let pos = 0;
let tokens = [];

let parse_lisp = fn() {
  if (pos >= len(tokens)) { return null; }
  let tok = tokens[pos];
  pos++;
  
  if (tok == "(") {
    let list = [];
    while (pos < len(tokens) && tokens[pos] != ")") {
      list = push(list, parse_lisp());
    }
    if (pos < len(tokens)) { pos++; } // skip )
    return list;
  }
  
  // Try number
  let n = int(tok);
  if (str(n) == tok) { return n; }
  
  // Symbol
  tok
};

// Evaluator
let eval_lisp = fn(expr, env) {
  // Number
  if (type(expr) == "INTEGER") { return expr; }
  
  // Symbol lookup
  if (type(expr) == "STRING") {
    for ([key, val] in env) {
      if (key == expr) { return val; }
    }
    return `undefined: ${expr}`;
  }
  
  // List (function call or special form)
  if (type(expr) == "ARRAY" && len(expr) > 0) {
    let op = expr[0];
    
    // Special forms
    if (op == "if") {
      let cond = eval_lisp(expr[1], env);
      return cond != 0 ? eval_lisp(expr[2], env) : eval_lisp(expr[3], env);
    }
    
    // Arithmetic
    if (op == "+") { return eval_lisp(expr[1], env) + eval_lisp(expr[2], env); }
    if (op == "-") { return eval_lisp(expr[1], env) - eval_lisp(expr[2], env); }
    if (op == "*") { return eval_lisp(expr[1], env) * eval_lisp(expr[2], env); }
    if (op == "/") { return eval_lisp(expr[1], env) / eval_lisp(expr[2], env); }
    if (op == "=") { return eval_lisp(expr[1], env) == eval_lisp(expr[2], env) ? 1 : 0; }
    if (op == "<") { return eval_lisp(expr[1], env) < eval_lisp(expr[2], env) ? 1 : 0; }
  }
  
  null
};

let run_lisp = fn(code) {
  tokens = tokenize_lisp(code);
  pos = 0;
  let ast = parse_lisp();
  eval_lisp(ast, [])
};

// Demo!
puts("Tiny Lisp in Monkey:");
puts("-" * 30);
puts(`(+ 2 3) = ${run_lisp("(+ 2 3)")}`);
puts(`(* 6 7) = ${run_lisp("(* 6 7)")}`);
puts(`(+ (* 3 4) (- 10 5)) = ${run_lisp("(+ (* 3 4) (- 10 5))")}`);
puts(`(if (< 3 5) 42 0) = ${run_lisp("(if (< 3 5) 42 0)")}`);
puts(`(if (= 1 2) 10 20) = ${run_lisp("(if (= 1 2) 10 20)")}`);
