// integration.test.js — Complex integration tests combining multiple features
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';
import { GarbageCollector } from './gc.js';
import { DebugVM } from './debugger.js';
import { optimize } from './optimizer.js';
import { MonkeyArray, MonkeyString, MonkeyInteger } from './object.js';

function run(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  const prog = p.parseProgram();
  if (p.errors.length > 0) throw new Error(`Parser errors: ${p.errors.join(', ')}`);
  const c = new Compiler();
  c.compile(prog);
  const vm = new VM(c.bytecode());
  vm.run();
  return vm.lastPoppedStackElem();
}

function runWithGC(input, gcOpts = {}) {
  const l = new Lexer(input);
  const p = new Parser(l);
  const prog = p.parseProgram();
  if (p.errors.length > 0) throw new Error(`Parser errors: ${p.errors.join(', ')}`);
  const c = new Compiler();
  c.compile(prog);
  const gc = new GarbageCollector(gcOpts);
  const vm = new VM(c.bytecode(), gc);
  vm.run();
  return { result: vm.lastPoppedStackElem(), gc };
}

function runOptimized(input) {
  const l = new Lexer(input);
  const p = new Parser(l);
  const prog = p.parseProgram();
  if (p.errors.length > 0) throw new Error(`Parser errors: ${p.errors.join(', ')}`);
  const c = new Compiler();
  c.compile(prog);
  const bc = c.bytecode();
  bc.instructions = optimize(bc.instructions);
  const vm = new VM(bc);
  vm.run();
  return vm.lastPoppedStackElem();
}

describe('Integration Tests', () => {
  describe('Closures + match + comprehensions', () => {
    it('closure factory with match dispatch', () => {
      const result = run(`
        let make_op = fn(name) {
          match name {
            "add" => fn(a, b) { a + b },
            "mul" => fn(a, b) { a * b },
            "sub" => fn(a, b) { a - b },
            _ => fn(a, b) { 0 }
          }
        };
        let add = make_op("add");
        let mul = make_op("mul");
        add(3, mul(4, 5))
      `);
      assert.equal(result.value, 23);
    });

    it('comprehension with closures', () => {
      const result = run(`
        let make_adder = fn(n) { fn(x) { x + n } };
        let adders = [make_adder(i) for i in [1, 2, 3]];
        [f(10) for f in adders]
      `);
      assert.deepEqual(result.elements.map(e => e.value), [11, 12, 13]);
    });
  });

  describe('Mutable state + for-in + match', () => {
    it('counter with categorization', () => {
      const result = run(`
        let make = fn() {
          let n = 0;
          let inc = fn() { set n = n + 1; n };
          let classify = fn() {
            match n {
              0 => "zero",
              1 => "one",
              2 => "two",
              _ => "many"
            }
          };
          [inc, classify]
        };
        let pair = make();
        let inc = pair[0];
        let classify = pair[1];
        let labels = [];
        for (i in [1, 2, 3, 4]) {
          inc();
          set labels = push(labels, classify());
        }
        labels
      `);
      assert.deepEqual(result.elements.map(e => e.value), ['one', 'two', 'many', 'many']);
    });
  });

  describe('Deep equality + spread + comprehensions', () => {
    it('building arrays with spread and comparing', () => {
      const result = run(`
        let a = [1, 2, 3];
        let b = [4, 5, 6];
        let combined = [...a, ...b];
        combined == [1, 2, 3, 4, 5, 6]
      `);
      assert.equal(result.inspect(), 'true');
    });

    it('comprehension + filter + deep equality check', () => {
      const result = run(`
        let evens = [x for x in 1..10 if x % 2 == 0];
        evens == [2, 4, 6, 8, 10]
      `);
      assert.equal(result.inspect(), 'true');
    });
  });

  describe('Pipe + match + f-strings', () => {
    it('piping through classify', () => {
      const result = run(`
        let classify = fn(n) {
          match n {
            0 => "zero",
            1 => "one",
            _ => f"number({n})"
          }
        };
        5 |> classify
      `);
      assert.equal(result.value, 'number(5)');
    });
  });

  describe('Recursion + closures + GC', () => {
    it('tree traversal with GC pressure', () => {
      const { result, gc } = runWithGC(`
        let make_tree = fn(depth) {
          if (depth == 0) { [0] }
          else { [depth, make_tree(depth - 1), make_tree(depth - 1)] }
        };
        let count_nodes = fn(tree) {
          if (len(tree) == 1) { 1 }
          else { 1 + count_nodes(tree[1]) + count_nodes(tree[2]) }
        };
        let tree = make_tree(5);
        count_nodes(tree)
      `, { threshold: 20 });
      
      assert.equal(result.value, 63); // 2^6 - 1
      assert.ok(gc.stats.collections > 0, 'GC should have collected');
    });
  });

  describe('Optimizer preserves complex programs', () => {
    it('optimized closure + match', () => {
      const result = runOptimized(`
        let dispatch = fn(x) {
          if (true) {
            match x { 1 => "one", 2 => "two", _ => "other" }
          } else {
            "unreachable"
          }
        };
        dispatch(2)
      `);
      assert.equal(result.value, 'two');
    });
  });

  describe('Full pipeline: compile + optimize + GC + debug', () => {
    it('debugger traces optimized GC program', () => {
      const input = `
        let sum = fn(arr) {
          let total = 0;
          for (x in arr) { set total = total + x; }
          total
        };
        sum([x * x for x in 1..5])
      `;
      
      const l = new Lexer(input);
      const p = new Parser(l);
      const prog = p.parseProgram();
      const c = new Compiler();
      c.compile(prog);
      const bc = c.bytecode();
      
      // Optimize
      bc.instructions = optimize(bc.instructions);
      
      // Run with GC through debugger
      const gc = new GarbageCollector({ threshold: 10 });
      const dbg = new DebugVM(bc, gc);
      dbg.enableTrace(true);
      
      while (dbg.step() !== 'completed') {}
      
      assert.equal(dbg.result().value, 55); // 1+4+9+16+25
      assert.ok(dbg.trace.length > 0, 'trace should record instructions');
      assert.ok(gc.stats.totalAllocated > 0, 'GC should track allocations');
    });
  });

  describe('Edge cases under stress', () => {
    it('deeply nested closures with comprehensions', () => {
      const result = run(`
        let make = fn(a) {
          fn(b) {
            fn(c) {
              [a + b + c + x for x in [0, 1, 2]]
            }
          }
        };
        make(10)(20)(30)
      `);
      assert.deepEqual(result.elements.map(e => e.value), [60, 61, 62]);
    });

    it('mutual state through cells', () => {
      const result = run(`
        let make = fn() {
          let state = [];
          let add = fn(x) { set state = push(state, x) };
          let get = fn() { state };
          [add, get]
        };
        let pair = make();
        let add = pair[0];
        let get = pair[1];
        add(1); add(2); add(3);
        get() == [1, 2, 3]
      `);
      assert.equal(result.inspect(), 'true');
    });

    it('fibonacci via comprehension + closure', () => {
      const result = run(`
        let fib = fn(n) {
          if (n < 2) { n } else { fib(n - 1) + fib(n - 2) }
        };
        [fib(n) for n in 0..9]
      `);
      assert.deepEqual(result.elements.map(e => e.value), [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]);
    });
  });
});

describe('Type-based dispatch', () => {
  it('type() + match for polymorphism', () => {
    const result = run(`
      let to_string = fn(x) {
        match type(x) {
          "INTEGER" => f"int({x})",
          "STRING" => f"str({x})",
          "ARRAY" => f"arr[{len(x)}]",
          "BOOLEAN" => f"bool({x})",
          "NULL" => "null",
          _ => "?"
        }
      };
      [to_string(42), to_string("hi"), to_string([1,2]), to_string(true), to_string(null)]
    `);
    assert.deepEqual(result.elements.map(e => e.value), [
      'int(42)', 'str(hi)', 'arr[2]', 'bool(true)', 'null'
    ]);
  });

  it('type-safe operations', () => {
    const result = run(`
      let safe_add = fn(a, b) {
        if (type(a) != type(b)) { null }
        else {
          match type(a) {
            "INTEGER" => a + b,
            "STRING" => a + b,
            "ARRAY" => [...a, ...b],
            _ => null
          }
        }
      };
      [safe_add(1, 2), safe_add("a", "b"), safe_add([1], [2])]
    `);
    assert.equal(result.elements[0].value, 3);
    assert.equal(result.elements[1].value, 'ab');
    assert.deepEqual(result.elements[2].elements.map(e => e.value), [1, 2]);
  });

  it('recursive type dispatch', () => {
    const result = run(`
      let type_name = fn(x) {
        match type(x) {
          "ARRAY" => "arr",
          "INTEGER" => "int",
          "STRING" => "str",
          _ => "other"
        }
      };
      [type_name(42), type_name("hi"), type_name([1, 2]), type_name(null)]
    `);
    assert.deepEqual(result.elements.map(e => e.value), ['int', 'str', 'arr', 'other']);
  });
});

describe('Hash Destructuring', () => {
  it('basic hash destructuring', () => {
    const result = run('let {x, y} = {"x": 10, "y": 20}; x + y');
    assert.equal(result.value, 30);
  });

  it('string values', () => {
    const result = run('let {name, role} = {"name": "Alice", "role": "admin"}; name');
    assert.equal(result.value, 'Alice');
  });

  it('combined with array destructuring', () => {
    const result = run('let [a, b] = [1, 2]; let {c, d} = {"c": 3, "d": 4}; a + b + c + d');
    assert.equal(result.value, 10);
  });

  it('with f-string', () => {
    const result = run('let {name, age} = {"name": "Bob", "age": 25}; f"{name} is {age}"');
    assert.equal(result.value, 'Bob is 25');
  });

  it('inside function', () => {
    const result = run(`
      let parse_point = fn(p) { let {x, y} = p; x * x + y * y };
      parse_point({"x": 3, "y": 4})
    `);
    assert.equal(result.value, 25);
  });
});

describe('Rest Parameters', () => {
  it('collects extra args', () => {
    const result = run('let f = fn(a, ...rest) { rest }; f(1, 2, 3)');
    assert.deepEqual(result.elements.map(e => e.value), [2, 3]);
  });

  it('first param works normally', () => {
    assert.equal(run('let f = fn(a, ...rest) { a }; f(1, 2, 3)').value, 1);
  });

  it('rest is empty when no extra args', () => {
    const result = run('let f = fn(a, ...rest) { rest }; f(1)');
    assert.equal(result.elements.length, 0);
  });

  it('all args as rest', () => {
    const result = run('let f = fn(...args) { args }; f(1, 2, 3)');
    assert.deepEqual(result.elements.map(e => e.value), [1, 2, 3]);
  });

  it('rest with len', () => {
    assert.equal(run('let f = fn(a, ...rest) { len(rest) }; f(1, 2, 3, 4, 5)').value, 4);
  });

  it('rest with sum', () => {
    assert.equal(run(`
      let sum_all = fn(...nums) {
        let total = 0;
        for (n in nums) { set total = total + n; }
        total
      };
      sum_all(1, 2, 3, 4, 5)
    `).value, 15);
  });

  it('rest with spread roundtrip', () => {
    const result = run(`
      let collect = fn(...args) { args };
      let arr = collect(10, 20, 30);
      [...arr, 40]
    `);
    assert.deepEqual(result.elements.map(e => e.value), [10, 20, 30, 40]);
  });
});

describe('Default Parameter Values', () => {
  it('uses default when arg missing', () => {
    assert.equal(run('let f = fn(x, y = 10) { x + y }; f(5)').value, 15);
  });

  it('overrides default when arg provided', () => {
    assert.equal(run('let f = fn(x, y = 10) { x + y }; f(5, 20)').value, 25);
  });

  it('all defaults', () => {
    assert.equal(run('let f = fn(x = 1, y = 2) { x + y }; f()').value, 3);
  });

  it('partial defaults override', () => {
    assert.equal(run('let f = fn(x = 1, y = 2) { x + y }; f(100)').value, 102);
  });

  it('string defaults', () => {
    assert.equal(run('let f = fn(a, b = "world") { a + " " + b }; f("hello")').value, 'hello world');
  });

  it('default in closure', () => {
    const result = run(`
      let make = fn(base = 0) {
        fn(x) { x + base }
      };
      let f = make();
      let g = make(10);
      [f(5), g(5)]
    `);
    assert.deepEqual(result.elements.map(e => e.value), [5, 15]);
  });

  it('default with rest', () => {
    const result = run(`
      let f = fn(first, sep = "-", ...rest) { join([str(first), ...([str(r) for r in rest])], sep) };
      f(1, ", ", 2, 3)
    `);
    assert.equal(result.value, '1, 2, 3');
  });
});

describe('Exponentiation Operator (**)', () => {
  it('integer power', () => {
    assert.equal(run('2 ** 10').value, 1024);
  });

  it('zero power', () => {
    assert.equal(run('5 ** 0').value, 1);
  });

  it('float power', () => {
    const result = run('2.0 ** 0.5');
    assert.ok(Math.abs(result.value - Math.SQRT2) < 0.0001);
  });

  it('power with other operations', () => {
    assert.equal(run('10 ** 2 + 1').value, 101);
  });

  it('constant folded', () => {
    assert.equal(run('3 ** 3').value, 27);
  });
});

describe('Milestone: 800 Tests', () => {
  it('all features work together', () => {
    const input = [
      'let power_map = fn(base = 2, ...exponents) {',
      '  [base ** e for e in exponents]',
      '};',
      'let result = power_map(2, 0, 1, 2, 3, 4);',
      'match result {',
      '  [1, 2, 4, 8, 16] => "powers of 2",',
      '  _ => "unexpected"',
      '}'
    ].join('\n');
    const result = run(input);
    assert.equal(result.value, 'powers of 2');
  });
});
