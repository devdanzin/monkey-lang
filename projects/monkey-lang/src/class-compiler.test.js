import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';

function runCompiled(code) {
  const l = new Lexer(code);
  const p = new Parser(l);
  const program = p.parseProgram();
  if (p.errors.length > 0) throw new Error('Parse: ' + p.errors.join(', '));
  const c = new Compiler();
  const err = c.compile(program);
  if (err) throw new Error('Compile: ' + err);
  const vm = new VM(c.bytecode());
  vm.run();
  return vm.lastPoppedStackElem();
}

describe('Classes (compiler/VM path)', () => {
  it('basic construction and field access', () => {
    const r = runCompiled(`
      class Dog { let name; fn init(n) { self.name = n; } }
      let d = Dog("Rex"); d.name;
    `);
    assert.equal(r.value, 'Rex');
  });

  it('method call', () => {
    const r = runCompiled(`
      class Dog {
        let name;
        fn init(n) { self.name = n; }
        fn bark() { "Woof! " + self.name; }
      }
      Dog("Rex").bark();
    `);
    assert.equal(r.value, 'Woof! Rex');
  });

  it('method with args', () => {
    const r = runCompiled(`
      class Calc {
        let result;
        fn init() { self.result = 0; }
        fn add(n) { self.result = self.result + n; self.result; }
      }
      let c = Calc(); c.add(10); c.add(20); c.add(5);
    `);
    assert.equal(r.value, 35);
  });

  it('multiple fields', () => {
    const r = runCompiled(`
      class Point {
        let x; let y;
        fn init(x, y) { self.x = x; self.y = y; }
        fn magnitude() { self.x * self.x + self.y * self.y; }
      }
      Point(3, 4).magnitude();
    `);
    assert.equal(r.value, 25);
  });

  it('counter with mutation', () => {
    const r = runCompiled(`
      class Counter {
        let count;
        fn init() { self.count = 0; }
        fn inc() { self.count = self.count + 1; }
        fn get() { self.count; }
      }
      let c = Counter(); c.inc(); c.inc(); c.inc(); c.get();
    `);
    assert.equal(r.value, 3);
  });

  it('independent instances', () => {
    const r = runCompiled(`
      class Box { let v; fn init(v) { self.v = v; } }
      let a = Box(10); let b = Box(20); a.v + b.v;
    `);
    assert.equal(r.value, 30);
  });

  it('method chaining', () => {
    const r = runCompiled(`
      class Builder {
        let parts;
        fn init() { self.parts = []; }
        fn add(p) { self.parts = push(self.parts, p); self; }
        fn count() { len(self.parts); }
      }
      Builder().add("a").add("b").add("c").count();
    `);
    assert.equal(r.value, 3);
  });

  it('empty class', () => {
    const r = runCompiled(`
      class Empty {}
      type(Empty());
    `);
    assert.equal(r.value, 'INSTANCE');
  });

  it('class with array field', () => {
    const r = runCompiled(`
      class Stack {
        let items;
        fn init() { self.items = []; }
        fn push_val(v) { self.items = push(self.items, v); }
        fn size() { len(self.items); }
      }
      let s = Stack();
      s.push_val(1); s.push_val(2); s.push_val(3);
      s.size();
    `);
    assert.equal(r.value, 3);
  });

  it('class field access via bracket notation', () => {
    const r = runCompiled(`
      class Obj { let x; fn init(v) { self.x = v; } }
      let o = Obj(42); o["x"];
    `);
    assert.equal(r.value, 42);
  });
});
