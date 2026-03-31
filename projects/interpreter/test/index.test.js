const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Interpreter, num, str, bool, id, bin, un, let_, assign, if_, while_, block, fn, call, ret, prog } = require('../src/index.js');

test('arithmetic', () => {
  const interp = new Interpreter();
  assert.equal(interp.run(bin('+', num(2), num(3))), 5);
  assert.equal(interp.run(bin('*', num(4), num(5))), 20);
});

test('variables', () => {
  const interp = new Interpreter();
  interp.run(prog(let_('x', num(42))));
  assert.equal(interp.run(id('x')), 42);
});

test('assignment', () => {
  const interp = new Interpreter();
  interp.run(prog(let_('x', num(1)), assign('x', num(2))));
  assert.equal(interp.run(id('x')), 2);
});

test('if/else', () => {
  const interp = new Interpreter();
  const result = interp.run(if_(bool(true), num(1), num(2)));
  assert.equal(result, 1);
  assert.equal(interp.run(if_(bool(false), num(1), num(2))), 2);
});

test('while loop', () => {
  const interp = new Interpreter();
  interp.run(prog(
    let_('i', num(0)),
    let_('sum', num(0)),
    while_(bin('<', id('i'), num(5)), block(
      assign('sum', bin('+', id('sum'), id('i'))),
      assign('i', bin('+', id('i'), num(1)))
    ))
  ));
  assert.equal(interp.run(id('sum')), 10); // 0+1+2+3+4
});

test('functions', () => {
  const interp = new Interpreter();
  interp.run(prog(
    fn('add', ['a', 'b'], ret(bin('+', id('a'), id('b'))))
  ));
  assert.equal(interp.run(call(id('add'), num(3), num(4))), 7);
});

test('closures', () => {
  const interp = new Interpreter();
  interp.run(prog(
    fn('makeAdder', ['x'], ret(fn(null, ['y'], ret(bin('+', id('x'), id('y'))))))
  ));
  interp.run(let_('add5', call(id('makeAdder'), num(5))));
  assert.equal(interp.run(call(id('add5'), num(3))), 8);
});

test('print', () => {
  const interp = new Interpreter();
  interp.run(call(id('print'), str('hello'), str('world')));
  assert.equal(interp.getOutput(), 'hello world');
});

test('comparison', () => {
  const interp = new Interpreter();
  assert.equal(interp.run(bin('==', num(1), num(1))), true);
  assert.equal(interp.run(bin('<', num(1), num(2))), true);
  assert.equal(interp.run(bin('>', num(1), num(2))), false);
});

test('string concat', () => {
  const interp = new Interpreter();
  assert.equal(interp.run(bin('+', str('hello'), str(' world'))), 'hello world');
});

test('unary', () => {
  const interp = new Interpreter();
  assert.equal(interp.run(un('-', num(5))), -5);
  assert.equal(interp.run(un('!', bool(true))), false);
});

test('recursive function — factorial', () => {
  const interp = new Interpreter();
  interp.run(prog(
    fn('fact', ['n'],
      if_(bin('<=', id('n'), num(1)),
        ret(num(1)),
        ret(bin('*', id('n'), call(id('fact'), bin('-', id('n'), num(1)))))
      )
    )
  ));
  assert.equal(interp.run(call(id('fact'), num(5))), 120);
});
