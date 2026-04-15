import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { monkeyEval } from './evaluator.js';
import { Environment } from './object.js';

function evaluate(code) {
  const l = new Lexer(code);
  const p = new Parser(l);
  const program = p.parseProgram();
  if (p.errors.length > 0) throw new Error('Parse: ' + p.errors.join(', '));
  return monkeyEval(program, new Environment());
}

describe('Classes', () => {
  it('basic class construction', () => {
    const r = evaluate(`
      class Dog {
        let name;
        fn init(n) { self.name = n; }
      }
      let d = Dog("Rex");
      d.name;
    `);
    assert.equal(r.value, 'Rex');
  });

  it('method calls', () => {
    const r = evaluate(`
      class Dog {
        let name;
        fn init(n) { self.name = n; }
        fn bark() { "Woof! I'm " + self.name; }
      }
      let d = Dog("Rex");
      d.bark();
    `);
    assert.equal(r.value, "Woof! I'm Rex");
  });

  it('methods with arguments', () => {
    const r = evaluate(`
      class Calculator {
        let result;
        fn init() { self.result = 0; }
        fn add(n) { self.result = self.result + n; self.result; }
      }
      let c = Calculator();
      c.add(10);
      c.add(20);
      c.add(5);
    `);
    assert.equal(r.value, 35);
  });

  it('multiple fields', () => {
    const r = evaluate(`
      class Point {
        let x;
        let y;
        fn init(x, y) { self.x = x; self.y = y; }
        fn magnitude() { self.x * self.x + self.y * self.y; }
      }
      let p = Point(3, 4);
      p.magnitude();
    `);
    assert.equal(r.value, 25);
  });

  it('class type', () => {
    const r = evaluate(`
      class Foo {}
      type(Foo);
    `);
    assert.equal(r.value, 'CLASS');
  });

  it('instance type', () => {
    const r = evaluate(`
      class Foo {}
      type(Foo());
    `);
    assert.equal(r.value, 'INSTANCE');
  });

  it('field mutation via method', () => {
    const r = evaluate(`
      class Counter {
        let count;
        fn init() { self.count = 0; }
        fn inc() { self.count = self.count + 1; }
        fn get() { self.count; }
      }
      let c = Counter();
      c.inc();
      c.inc();
      c.inc();
      c.get();
    `);
    assert.equal(r.value, 3);
  });

  it('multiple instances are independent', () => {
    const r = evaluate(`
      class Box {
        let value;
        fn init(v) { self.value = v; }
      }
      let a = Box(10);
      let b = Box(20);
      a.value + b.value;
    `);
    assert.equal(r.value, 30);
  });

  it('method chaining (returning self)', () => {
    const r = evaluate(`
      class Builder {
        let parts;
        fn init() { self.parts = []; }
        fn add(p) { self.parts = push(self.parts, p); self; }
        fn build() { self.parts; }
      }
      let b = Builder();
      b.add("a").add("b").add("c").build();
    `);
    assert.deepEqual(r.elements.map(e => e.value), ['a', 'b', 'c']);
  });

  it('inheritance — basic', () => {
    const r = evaluate(`
      class Animal {
        let name;
        fn init(n) { self.name = n; }
        fn speak() { self.name + " says..."; }
      }
      class Dog extends Animal {
        fn speak() { self.name + " says Woof!"; }
      }
      let d = Dog("Rex");
      d.speak();
    `);
    assert.equal(r.value, 'Rex says Woof!');
  });

  it('inheritance — inherited method', () => {
    const r = evaluate(`
      class Animal {
        let name;
        fn init(n) { self.name = n; }
        fn getName() { self.name; }
      }
      class Dog extends Animal {
        fn bark() { "Woof!"; }
      }
      let d = Dog("Rex");
      d.getName();
    `);
    assert.equal(r.value, 'Rex');
  });

  it('class with for-in and generators', () => {
    const r = evaluate(`
      class Range {
        let start;
        let stop;
        fn init(start, stop) { self.start = start; self.stop = stop; }
        fn iter() {
          let result = [];
          let i = self.start;
          while (i < self.stop) {
            result = push(result, i);
            i = i + 1;
          };
          result;
        }
      }
      let r = Range(1, 6);
      let sum = 0;
      for (x in r.iter()) { sum = sum + x; };
      sum;
    `);
    assert.equal(r.value, 15);
  });

  it('class with try/catch', () => {
    const r = evaluate(`
      class Safe {
        let value;
        fn init(v) { self.value = v; }
        fn divide(n) {
          try {
            if (n == 0) { throw "division by zero"; };
            self.value / n;
          } catch (e) {
            -1;
          };
        }
      }
      let s = Safe(100);
      [s.divide(4), s.divide(0)];
    `);
    assert.deepEqual(r.elements.map(e => e.value), [25, -1]);
  });

  it('empty class', () => {
    const r = evaluate(`
      class Empty {}
      let e = Empty();
      type(e);
    `);
    assert.equal(r.value, 'INSTANCE');
  });

  it('field access via bracket notation', () => {
    const r = evaluate(`
      class Obj {
        let x;
        fn init(v) { self.x = v; }
      }
      let o = Obj(42);
      o["x"];
    `);
    assert.equal(r.value, 42);
  });
});
