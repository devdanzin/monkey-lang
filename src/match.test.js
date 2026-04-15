// match.test.js — Tests for pattern matching and deep equality
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';
import { MonkeyInteger, MonkeyString, MonkeyArray, TRUE, FALSE, NULL } from './object.js';

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

describe('Match Expression', () => {
  describe('Literal patterns', () => {
    it('matches integer', () => {
      assert.equal(run('match 2 { 1 => "one", 2 => "two", 3 => "three" }').value, 'two');
    });

    it('matches string', () => {
      assert.equal(run('match "hello" { "hello" => 1, "world" => 2 }').value, 1);
    });

    it('matches boolean', () => {
      assert.equal(run('match true { true => "yes", false => "no" }').value, 'yes');
    });

    it('matches with default', () => {
      assert.equal(run('match 99 { 1 => "a", 2 => "b", _ => "default" }').value, 'default');
    });

    it('returns null when no match and no default', () => {
      assert.strictEqual(run('match 99 { 1 => "a" }'), NULL);
    });

    it('first matching arm wins', () => {
      assert.equal(run('match 1 { 1 => "first", 1 => "second" }').value, 'first');
    });

    it('matches against variable values', () => {
      assert.equal(run('let x = 2; match x { 1 => "one", 2 => "two" }').value, 'two');
    });

    it('match body can be complex expression', () => {
      assert.equal(run('match 1 { 1 => 10 + 20, _ => 0 }').value, 30);
    });
  });

  describe('Array patterns (deep equality)', () => {
    it('matches empty array', () => {
      assert.equal(run('match [] { [] => "empty", _ => "not" }').value, 'empty');
    });

    it('matches simple array', () => {
      assert.equal(run('match [1, 2, 3] { [1, 2, 3] => "yes", _ => "no" }').value, 'yes');
    });

    it('rejects wrong array', () => {
      assert.equal(run('match [1, 2, 3] { [1, 2, 4] => "wrong", _ => "correct" }').value, 'correct');
    });

    it('rejects different length', () => {
      assert.equal(run('match [1, 2] { [1, 2, 3] => "wrong", _ => "correct" }').value, 'correct');
    });

    it('matches nested arrays', () => {
      assert.equal(run('match [[1, 2], [3, 4]] { [[1, 2], [3, 4]] => "nested", _ => "no" }').value, 'nested');
    });

    it('matches array of strings', () => {
      assert.equal(run('match ["a", "b"] { ["a", "b"] => 1, _ => 0 }').value, 1);
    });

    it('matches mixed array types', () => {
      assert.equal(run('match [1, "two", true] { [1, "two", true] => "yes", _ => "no" }').value, 'yes');
    });

    it('first matching array arm wins', () => {
      const result = run('match [1, 2] { [1, 2] => "first", [1, 2] => "second" }');
      assert.equal(result.value, 'first');
    });

    it('falls through to correct arm', () => {
      const result = run('match [3, 4] { [1, 2] => "a", [3, 4] => "b", _ => "c" }');
      assert.equal(result.value, 'b');
    });
  });

  describe('Deep equality in other contexts', () => {
    it('deeply nested arrays', () => {
      assert.equal(run('match [[[1]]] { [[[1]]] => "deep", _ => "no" }').value, 'deep');
    });

    it('array with null', () => {
      assert.equal(run('match [null] { [null] => "null-arr", _ => "no" }').value, 'null-arr');
    });
  });

  describe('Match with functions', () => {
    it('match inside function', () => {
      const result = run(`
        let classify = fn(n) {
          match n { 0 => "zero", 1 => "one", _ => "many" }
        };
        classify(1)
      `);
      assert.equal(result.value, 'one');
    });

    it('match on function result', () => {
      const result = run(`
        let f = fn() { [1, 2] };
        match f() { [1, 2] => "pair", _ => "other" }
      `);
      assert.equal(result.value, 'pair');
    });

    it('match in loop', () => {
      const result = run(`
        let labels = [];
        for (x in [1, 2, 3]) {
          let label = match x { 1 => "one", 2 => "two", _ => "other" };
          set labels = push(labels, label);
        }
        labels
      `);
      assert.ok(result instanceof MonkeyArray);
      assert.equal(result.elements[0].value, 'one');
      assert.equal(result.elements[1].value, 'two');
      assert.equal(result.elements[2].value, 'other');
    });
  });

  describe('Match edge cases', () => {
    it('single arm match', () => {
      assert.equal(run('match 1 { 1 => "only" }').value, 'only');
    });

    it('only default arm', () => {
      assert.equal(run('match 42 { _ => "always" }').value, 'always');
    });

    it('match on computed expression', () => {
      assert.equal(run('match 1 + 1 { 2 => "yes", _ => "no" }').value, 'yes');
    });

    it('match with function body workaround', () => {
      const result = run(`
        let compute = fn() { let x = 10; let y = 20; x + y };
        match 1 { 
          1 => compute(),
          _ => 0
        }
      `);
      assert.equal(result.value, 30);
    });
  });
});

describe('Deep Equality Operator (==)', () => {
  it('arrays equal by value', () => {
    assert.strictEqual(run('[1, 2, 3] == [1, 2, 3]'), TRUE);
  });

  it('arrays not equal', () => {
    assert.strictEqual(run('[1, 2, 3] == [1, 2, 4]'), FALSE);
  });

  it('nested arrays equal', () => {
    assert.strictEqual(run('[1, [2, 3]] == [1, [2, 3]]'), TRUE);
  });

  it('empty arrays equal', () => {
    assert.strictEqual(run('[] == []'), TRUE);
  });

  it('different length arrays not equal', () => {
    assert.strictEqual(run('[1, 2] == [1, 2, 3]'), FALSE);
  });

  it('arrays not-equal operator', () => {
    assert.strictEqual(run('[1] != [2]'), TRUE);
    assert.strictEqual(run('[1] != [1]'), FALSE);
  });

  it('mixed types in arrays', () => {
    assert.strictEqual(run('[1, "two", true] == [1, "two", true]'), TRUE);
    assert.strictEqual(run('[1, "two", true] == [1, "two", false]'), FALSE);
  });

  it('null arrays', () => {
    assert.strictEqual(run('[null] == [null]'), TRUE);
  });

  it('primitives still work', () => {
    assert.strictEqual(run('1 == 1'), TRUE);
    assert.strictEqual(run('"hello" == "hello"'), TRUE);
    assert.strictEqual(run('true == true'), TRUE);
    assert.strictEqual(run('null == null'), TRUE);
    assert.strictEqual(run('1 == 2'), FALSE);
  });

  it('deep equality in conditions', () => {
    assert.equal(run('if ([1, 2] == [1, 2]) { "same" } else { "diff" }').value, 'same');
    assert.equal(run('if ([1, 2] == [3, 4]) { "same" } else { "diff" }').value, 'diff');
  });
});
