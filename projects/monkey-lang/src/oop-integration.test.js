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

describe('OOP: Complete Feature Integration', () => {
  it('shapes hierarchy with area, perimeter, toString, __iter__', () => {
    const r = evaluate(`
      class Shape {
        let color;
        fn init(c) { self.color = c; }
        fn area() { 0; }
        fn perimeter() { 0; }
        fn toString() { self.color + " " + self.name(); }
        fn name() { "shape"; }
      }
      
      class Circle extends Shape {
        let radius;
        fn init(c, r) { self.color = c; self.radius = r; }
        fn area() { 3 * self.radius * self.radius; }
        fn perimeter() { 2 * 3 * self.radius; }
        fn name() { "circle"; }
      }
      
      class Rectangle extends Shape {
        let width; let height;
        fn init(c, w, h) { self.color = c; self.width = w; self.height = h; }
        fn area() { self.width * self.height; }
        fn perimeter() { 2 * (self.width + self.height); }
        fn name() { "rectangle"; }
      }
      
      let shapes = [Circle("red", 5), Rectangle("blue", 3, 4)];
      let total_area = 0;
      for (s in shapes) {
        total_area = total_area + s.area();
      };
      total_area;
    `);
    assert.equal(r.value, 75 + 12); // 3*25 + 12 = 87
  });

  it('LinkedList with full OOP (toString, __iter__, __eq__)', () => {
    const r = evaluate(`
      class Node {
        let val; let next;
        fn init(v, n) { self.val = v; self.next = n; }
      }
      
      class List {
        let head; let size;
        fn init() { self.head = null; self.size = 0; }
        
        fn push(v) {
          self.head = Node(v, self.head);
          self.size = self.size + 1;
          self;
        }
        
        fn __iter__() {
          let result = [];
          let curr = self.head;
          while (curr != null) {
            result = push(result, curr.val);
            curr = curr.next;
          };
          reverse(result);
        }
        
        fn toString() {
          let items = [];
          for (x in self) { items = push(items, str(x)); };
          "[" + reduce(items, fn(a, b) { a + ", " + b }) + "]";
        }
        
        fn contains(v) {
          for (x in self) { if (x == v) { return true; }; };
          false;
        }
        
        static fn from_array(arr) {
          let list = List();
          for (x in arr) { list.push(x); };
          list;
        }
      }
      
      let list = List.from_array([1, 2, 3, 4, 5]);
      let sum = 0;
      for (x in list) { sum = sum + x; };
      [sum, list.size, list.contains(3), list.contains(9), str(list)];
    `);
    assert.equal(r.elements[0].value, 15);
    assert.equal(r.elements[1].value, 5);
    assert.equal(r.elements[2].inspect(), 'true');
    assert.equal(r.elements[3].inspect(), 'false');
    assert.equal(r.elements[4].value, '[1, 2, 3, 4, 5]');
  });

  it('Vec2 math library with operators + generator', () => {
    const r = evaluate(`
      class Vec2 {
        let x; let y;
        fn init(x, y) { self.x = x; self.y = y; }
        fn __add__(o) { Vec2(self.x + o.x, self.y + o.y); }
        fn __sub__(o) { Vec2(self.x - o.x, self.y - o.y); }
        fn __mul__(s) { Vec2(self.x * s, self.y * s); }
        fn __eq__(o) { self.x == o.x && self.y == o.y; }
        fn dot(o) { self.x * o.x + self.y * o.y; }
        fn mag_sq() { self.dot(self); }
        fn toString() { "(" + str(self.x) + ", " + str(self.y) + ")"; }
        
        static fn zero() { Vec2(0, 0); }
        static fn unit_x() { Vec2(1, 0); }
        static fn unit_y() { Vec2(0, 1); }
      }
      
      let path = gen(steps) {
        let pos = Vec2.zero();
        let vel = Vec2(1, 2);
        let i = 0;
        while (i < steps) {
          yield pos;
          pos = pos + vel;
          i = i + 1;
        };
      };
      
      let positions = [];
      for (p in path(4)) {
        positions = push(positions, str(p));
      };
      positions;
    `);
    assert.deepEqual(r.elements.map(e => e.value), [
      '(0, 0)', '(1, 2)', '(2, 4)', '(3, 6)'
    ]);
  });

  it('isinstance with complex hierarchy', () => {
    const r = evaluate(`
      class Vehicle { fn init() {} }
      class Car extends Vehicle { fn init() {} }
      class ElectricCar extends Car { fn init() {} }
      
      let ec = ElectricCar();
      [isinstance(ec, ElectricCar), isinstance(ec, Car), isinstance(ec, Vehicle)];
    `);
    assert.deepEqual(r.elements.map(e => e.inspect()), ['true', 'true', 'true']);
  });

  it('super with multiple levels', () => {
    const r = evaluate(`
      class A {
        fn greet() { "A"; }
      }
      class B extends A {
        fn greet() { super.greet() + "B"; }
      }
      class C extends B {
        fn greet() { super.greet() + "C"; }
      }
      C().greet();
    `);
    assert.equal(r.value, 'ABC');
  });

  it('try/catch in class method', () => {
    const r = evaluate(`
      class SafeDiv {
        let numerator;
        fn init(n) { self.numerator = n; }
        fn divide(d) {
          try {
            if (d == 0) { throw "division by zero"; };
            self.numerator / d;
          } catch (e) {
            -1;
          };
        }
      }
      let sd = SafeDiv(100);
      [sd.divide(4), sd.divide(0), sd.divide(5)];
    `);
    assert.deepEqual(r.elements.map(e => e.value), [25, -1, 20]);
  });

  it('class with generator method', () => {
    const r = evaluate(`
      class FibClass {
        let limit;
        fn init(l) { self.limit = l; }
        fn fibs() {
          let g = gen(n) {
            let a = 0; let b = 1; let i = 0;
            while (i < n) {
              yield a;
              let t = a + b; a = b; b = t;
              i = i + 1;
            };
          };
          g(self.limit);
        }
      }
      let result = [];
      for (f in FibClass(8).fibs()) { result = push(result, f); };
      result;
    `);
    assert.deepEqual(r.elements.map(e => e.value), [0, 1, 1, 2, 3, 5, 8, 13]);
  });
});
