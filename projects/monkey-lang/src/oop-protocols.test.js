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

describe('OOP Protocols', () => {
  // === toString ===
  it('toString via str()', () => {
    const r = evaluate(`
      class Point { let x; let y;
        fn init(x, y) { self.x = x; self.y = y; }
        fn toString() { "(" + str(self.x) + ", " + str(self.y) + ")"; }
      }
      str(Point(3, 4));
    `);
    assert.equal(r.value, '(3, 4)');
  });

  it('toString in string concatenation', () => {
    const r = evaluate(`
      class Dog { let name;
        fn init(n) { self.name = n; }
        fn toString() { "Dog(" + self.name + ")"; }
      }
      "I have a " + str(Dog("Rex"));
    `);
    assert.equal(r.value, 'I have a Dog(Rex)');
  });

  // === Operator Overloading ===
  it('__add__', () => {
    const r = evaluate(`
      class Vec { let x; let y;
        fn init(x, y) { self.x = x; self.y = y; }
        fn __add__(o) { Vec(self.x + o.x, self.y + o.y); }
      }
      let c = Vec(1, 2) + Vec(3, 4);
      c.x + c.y;
    `);
    assert.equal(r.value, 10); // (4, 6) → 4+6=10
  });

  it('__sub__', () => {
    const r = evaluate(`
      class Vec { let x; let y;
        fn init(x, y) { self.x = x; self.y = y; }
        fn __sub__(o) { Vec(self.x - o.x, self.y - o.y); }
      }
      let c = Vec(5, 8) - Vec(2, 3);
      c.x * 10 + c.y;
    `);
    assert.equal(r.value, 35); // (3, 5) → 30+5=35
  });

  it('__mul__ with scalar', () => {
    const r = evaluate(`
      class Vec { let x; let y;
        fn init(x, y) { self.x = x; self.y = y; }
        fn __mul__(s) { Vec(self.x * s, self.y * s); }
      }
      let c = Vec(2, 3) * 4;
      c.x + c.y;
    `);
    assert.equal(r.value, 20); // (8, 12) → 20
  });

  it('__eq__', () => {
    const r = evaluate(`
      class Point { let x; let y;
        fn init(x, y) { self.x = x; self.y = y; }
        fn __eq__(o) { self.x == o.x && self.y == o.y; }
      }
      [Point(1,2) == Point(1,2), Point(1,2) == Point(3,4)];
    `);
    assert.equal(r.elements[0].inspect(), 'true');
    assert.equal(r.elements[1].inspect(), 'false');
  });

  it('__lt__ enables sorting', () => {
    const r = evaluate(`
      class Temp { let val;
        fn init(v) { self.val = v; }
        fn __lt__(o) { self.val < o.val; }
      }
      let t1 = Temp(30);
      let t2 = Temp(20);
      t1 < t2;
    `);
    assert.equal(r.inspect(), 'false');
  });

  it('chained operators', () => {
    const r = evaluate(`
      class Num { let v;
        fn init(v) { self.v = v; }
        fn __add__(o) { Num(self.v + o.v); }
        fn __mul__(o) { Num(self.v * o.v); }
      }
      let result = (Num(2) + Num(3)) * Num(4);
      result.v;
    `);
    assert.equal(r.value, 20);
  });

  // === __iter__ Protocol ===
  it('__iter__ with array return', () => {
    const r = evaluate(`
      class Range { let s; let e;
        fn init(s, e) { self.s = s; self.e = e; }
        fn __iter__() {
          let r = []; let i = self.s;
          while (i < self.e) { r = push(r, i); i = i + 1; };
          r;
        }
      }
      let sum = 0;
      for (x in Range(1, 6)) { sum = sum + x; };
      sum;
    `);
    assert.equal(r.value, 15);
  });

  it('__iter__ with generator return', () => {
    const r = evaluate(`
      class Counter { let n;
        fn init(n) { self.n = n; }
        fn __iter__() {
          let g = gen(limit) {
            let i = 0;
            while (i < limit) { yield i; i = i + 1; };
          };
          g(self.n);
        }
      }
      let result = [];
      for (x in Counter(4)) { result = push(result, x); };
      result;
    `);
    assert.deepEqual(r.elements.map(e => e.value), [0, 1, 2, 3]);
  });

  it('LinkedList with __iter__', () => {
    const r = evaluate(`
      class LinkedList { let head;
        fn init() { self.head = null; }
        fn prepend(v) {
          let node = {"val": v, "next": self.head};
          self.head = node; self;
        }
        fn __iter__() {
          let r = []; let curr = self.head;
          while (curr != null) { r = push(r, curr["val"]); curr = curr["next"]; };
          r;
        }
      }
      let list = LinkedList().prepend(3).prepend(2).prepend(1);
      let sum = 0;
      for (x in list) { sum = sum + x; };
      sum;
    `);
    assert.equal(r.value, 6);
  });

  // === Combined Protocols ===
  it('all protocols together', () => {
    const r = evaluate(`
      class Matrix { let data;
        fn init(data) { self.data = data; }
        fn __add__(o) {
          let result = [];
          let i = 0;
          while (i < len(self.data)) {
            result = push(result, self.data[i] + o.data[i]);
            i = i + 1;
          };
          Matrix(result);
        }
        fn __iter__() { self.data; }
        fn toString() {
          let s = "[";
          let first = true;
          for (x in self) {
            if (!first) { s = s + ", "; };
            s = s + str(x);
            first = false;
          };
          s + "]";
        }
      }
      let a = Matrix([1, 2, 3]);
      let b = Matrix([4, 5, 6]);
      let c = a + b;
      str(c);
    `);
    assert.equal(r.value, '[5, 7, 9]');
  });
});
