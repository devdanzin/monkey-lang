import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Environment } from './object.js';

function run(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  const prog = p.parseProgram();
  if (p.errors.length > 0) throw new Error('Parse errors: ' + p.errors.join(', '));
  const r = monkeyEval(prog, new Environment());
  return r?.inspect ? r.inspect() : String(r);
}

describe('Monkey Language Feature Showcase', () => {
  
  it('f-string interpolation', () => {
    assert.equal(run('let name = "world"; f"hello {name}"'), 'hello world');
    assert.equal(run('let x = 5; f"{x} squared is {x * x}"'), '5 squared is 25');
    assert.equal(run('f"PI ≈ {3.14}"'), 'PI ≈ 3.14');
  });

  it('destructuring let/const', () => {
    assert.equal(run('let [a, b, c] = [1, 2, 3]; a + b + c'), '6');
    assert.equal(run('let [x, y] = [10, 20, 30]; x + y'), '30');
    assert.equal(run('let {x, y} = {"x": 1, "y": 2}; x + y'), '3');
    assert.equal(run('const [a, b] = [5, 10]; a'), '5');
  });

  it('range operator', () => {
    assert.equal(run('1..5'), '[1, 2, 3, 4, 5]');
    assert.equal(run('5..1'), '[5, 4, 3, 2, 1]');
    assert.equal(run('(1..3).len()'), '3');
  });

  it('arrow functions', () => {
    assert.equal(run('let double = fn(x) => x * 2; double(5)'), '10');
    assert.equal(run('map(1..5, fn(x) => x * x)'), '[1, 4, 9, 16, 25]');
  });

  it('pipe operator', () => {
    assert.equal(run('[1,2,3] |> len'), '3');
    assert.equal(run('5 |> fn(x) { x * 2 }'), '10');
  });

  it('method syntax (dot notation)', () => {
    assert.equal(run('[1,2,3].len()'), '3');
    assert.equal(run('[1,2,3,4,5].filter(fn(x) => x > 3).map(fn(x) => x * 10)'), '[40, 50]');
    assert.equal(run('"hello".upper()'), 'HELLO');
    assert.equal(run('"Hello World".lower()'), 'hello world');
  });

  it('spread operator', () => {
    assert.equal(run('let a = [1,2]; [0, ...a, 3]'), '[0, 1, 2, 3]');
    assert.equal(run('[...[1,2], ...[3,4]]'), '[1, 2, 3, 4]');
    assert.equal(run('let add3 = fn(a,b,c) { a + b + c }; add3(...[1,2,3])'), '6');
  });

  it('rest parameters', () => {
    assert.equal(run('let f = fn(first, ...rest) { rest }; f(1, 2, 3, 4)'), '[2, 3, 4]');
    assert.equal(run('let sum = fn(...nums) { reduce(nums, 0, fn(a, x) => a + x) }; sum(1, 2, 3, 4, 5)'), '15');
  });

  it('default parameter values', () => {
    assert.equal(run('let f = fn(x, y = 10) { x + y }; f(5)'), '15');
    assert.equal(run('let f = fn(x, y = 10) { x + y }; f(5, 20)'), '25');
    assert.equal(run('let greet = fn(name = "world") => f"hello {name}"; greet()'), 'hello world');
  });

  it('array comprehensions', () => {
    assert.equal(run('[x * 2 for x in [1,2,3]]'), '[2, 4, 6]');
    assert.equal(run('[x * x for x in 1..5]'), '[1, 4, 9, 16, 25]');
    assert.equal(run('[x for x in 1..10 if x % 2 == 0]'), '[2, 4, 6, 8, 10]');
  });

  it('null literal and coalescing', () => {
    assert.equal(run('null'), 'null');
    assert.equal(run('null ?? 42'), '42');
    assert.equal(run('5 ?? 42'), '5');
    assert.equal(run('let x = null; x ?? "default"'), 'default');
  });

  it('match expression', () => {
    assert.equal(run('match 2 { 1 => "one", 2 => "two", _ => "other" }'), 'two');
    assert.equal(run('match "error" { "ok" => 200, "error" => 500, _ => 0 }'), '500');
    assert.equal(run('match true { true => "yes", false => "no" }'), 'yes');
  });

  it('string builtins', () => {
    assert.equal(run('"hello".upper()'), 'HELLO');
    assert.equal(run('"HELLO".lower()'), 'hello');
    assert.equal(run('replace("hello world", "world", "there")'), 'hello there');
    assert.equal(run('starts_with("hello", "hel")'), 'true');
    assert.equal(run('ends_with("hello", "llo")'), 'true');
    assert.equal(run('contains("hello world", "world")'), 'true');
    assert.equal(run('slice("hello", 1, 3)'), 'el');
    assert.equal(run('chars("hi")'), '[h, i]');
  });

  it('float support', () => {
    assert.equal(run('3.14'), '3.14');
    assert.equal(run('1.5 + 2.5'), '4');
    assert.equal(run('let pi = 3.14159; f"PI is {pi}"'), 'PI is 3.14159');
  });

  it('math stdlib', () => {
    assert.equal(run('sqrt(16)'), '4');
    assert.equal(run('pow(2, 10)'), '1024');
    assert.equal(run('abs(-42)'), '42');
  });

  it('try/catch/throw', () => {
    assert.equal(run('try { throw "oops" } catch (e) { f"caught: {e}" }'), 'caught: oops');
    assert.equal(run('try { 42 } catch (e) { e }'), '42');
  });

  it('composing ALL features together', () => {
    // F-string + match + type + method + arrow + range
    assert.equal(run(`
      let describe = fn(x) => match type(x) {
        "INTEGER" => f"number: {x}",
        "STRING" => f"string of length {x.len()}",
        "ARRAY" => f"array: {x}",
        _ => "unknown"
      };
      describe(42)
    `), 'number: 42');

    // Range + comprehension + filter + arrow + reduce
    assert.equal(run(`
      [x * x for x in 1..10 if x % 2 == 0]
        .reduce(0, fn(a, x) => a + x)
    `), '220'); // 4 + 16 + 36 + 64 + 100

    // Destructuring + spread + rest + default
    assert.equal(run(`
      let args = [1, 2, 3, 4, 5];
      let process = fn(h, ...t) => [h * 10, ...t];
      process(...args)
    `), '[10, 2, 3, 4, 5]');

    // Pipe + arrow + f-string + method
    assert.equal(run(`
      "hello world"
        |> fn(s) => s.upper()
        |> fn(s) => replace(s, " ", "_")
        |> fn(s) => f"result: {s}"
    `), 'result: HELLO_WORLD');

    // Variadic function with match and null coalescing
    assert.equal(run(`
      let safe_div = fn(a, b = 1) => match b {
        0 => null,
        _ => a / b
      };
      (safe_div(10, 0) ?? "division by zero")
    `), 'division by zero');
  });
});
