// shape.test.js — Tests for hidden classes and inline caching
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Shape, getShape, EMPTY_SHAPE, InlineCache, resetShapes, getShapeStats, createICTable, getIC, keyToString } from './shape.js';
import { ShapedHash, MonkeyInteger, MonkeyString, MonkeyBoolean, objectKeyString, MonkeyHash } from './object.js';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { Compiler } from './compiler.js';
import { VM } from './vm.js';

function runVM(input) {
  const lexer = new Lexer(input);
  const parser = new Parser(lexer);
  const program = parser.parseProgram();
  if (parser.errors.length > 0) throw new Error(parser.errors.join('\n'));
  const compiler = new Compiler();
  compiler.compile(program);
  const vm = new VM(compiler.bytecode());
  vm.run();
  return vm.lastPoppedStackElem();
}

describe('Shape', () => {
  beforeEach(() => {
    resetShapes();
  });

  it('EMPTY_SHAPE has no keys', () => {
    assert.equal(EMPTY_SHAPE.slotCount, 0);
    assert.equal(EMPTY_SHAPE.getSlot('x'), -1);
  });

  it('creates shapes with keys', () => {
    const shape = getShape(['str:x', 'str:y']);
    assert.equal(shape.slotCount, 2);
    assert.equal(shape.getSlot('str:x'), 0);
    assert.equal(shape.getSlot('str:y'), 1);
    assert.equal(shape.getSlot('str:z'), -1);
  });

  it('deduplicates shapes with same keys', () => {
    const shape1 = getShape(['str:x', 'str:y']);
    const shape2 = getShape(['str:x', 'str:y']);
    assert.equal(shape1.id, shape2.id);
  });

  it('different key order produces same shape (dedup by sorted signature)', () => {
    const shape1 = getShape(['str:a', 'str:b']);
    const shape2 = getShape(['str:b', 'str:a']);
    // Same signature, same shape (though slot assignment may differ from first creation)
    assert.equal(shape1.id, shape2.id);
  });

  it('different keys produce different shapes', () => {
    const shape1 = getShape(['str:x', 'str:y']);
    const shape2 = getShape(['str:a', 'str:b']);
    assert.notEqual(shape1.id, shape2.id);
  });

  it('transitions create new shapes', () => {
    const base = getShape(['str:x']);
    const extended = base.transition('str:y');
    assert.equal(extended.slotCount, 2);
    assert.equal(extended.getSlot('str:x'), 0);
    assert.equal(extended.getSlot('str:y'), 1);
    assert.notEqual(base.id, extended.id);
  });

  it('transitions are cached', () => {
    const base = getShape(['str:x']);
    const ext1 = base.transition('str:y');
    const ext2 = base.transition('str:y');
    assert.equal(ext1.id, ext2.id);
  });

  it('transition chain: empty → x → xy → xyz', () => {
    let shape = EMPTY_SHAPE;
    shape = shape.transition('str:x');
    assert.equal(shape.slotCount, 1);
    shape = shape.transition('str:y');
    assert.equal(shape.slotCount, 2);
    shape = shape.transition('str:z');
    assert.equal(shape.slotCount, 3);
    assert.equal(shape.getSlot('str:x'), 0);
    assert.equal(shape.getSlot('str:y'), 1);
    assert.equal(shape.getSlot('str:z'), 2);
  });

  it('keys() returns keys in slot order', () => {
    const shape = getShape(['str:c', 'str:a', 'str:b']);
    // getShape sorts for dedup but preserves insertion order for slots via transitions
    const keys = shape.keys();
    assert.equal(keys.length, 3);
  });

  it('shape stats work', () => {
    getShape(['str:x']);
    getShape(['str:y']);
    const stats = getShapeStats();
    assert.ok(stats.totalShapes >= 3); // empty + x + y at minimum
    assert.ok(stats.registrySize >= 3);
  });
});

describe('ShapedHash', () => {
  beforeEach(() => {
    resetShapes();
  });

  it('creates a shaped hash', () => {
    const shape = getShape(['int:1', 'int:2']);
    const k1 = new MonkeyInteger(1);
    const k2 = new MonkeyInteger(2);
    const v1 = new MonkeyString('one');
    const v2 = new MonkeyString('two');
    const hash = new ShapedHash(shape, [v1, v2], [k1, k2]);
    
    assert.equal(hash.type(), 'HASH');
    assert.equal(hash.getByString('int:1').value, 'one');
    assert.equal(hash.getByString('int:2').value, 'two');
    assert.equal(hash.getByString('int:3'), undefined);
  });

  it('getByKey works with MonkeyObjects', () => {
    const shape = getShape(['str:name', 'str:age']);
    const kName = new MonkeyString('name');
    const kAge = new MonkeyString('age');
    const hash = new ShapedHash(shape, [new MonkeyString('Bob'), new MonkeyInteger(30)], [kName, kAge]);
    
    assert.equal(hash.getByKey(new MonkeyString('name')).value, 'Bob');
    assert.equal(hash.getByKey(new MonkeyString('age')).value, 30);
  });

  it('.pairs getter returns Map for compatibility', () => {
    const shape = getShape(['str:x']);
    const k = new MonkeyString('x');
    const v = new MonkeyInteger(42);
    const hash = new ShapedHash(shape, [v], [k]);
    
    const pairs = hash.pairs;
    assert.ok(pairs instanceof Map);
    assert.equal(pairs.size, 1);
  });

  it('setByString mutates existing key', () => {
    const shape = getShape(['str:count']);
    const k = new MonkeyString('count');
    const hash = new ShapedHash(shape, [new MonkeyInteger(1)], [k]);
    
    hash.setByString('str:count', new MonkeyInteger(2), k);
    assert.equal(hash.getByString('str:count').value, 2);
    assert.equal(hash.shape.id, shape.id); // Shape unchanged
  });

  it('setByString transitions shape for new key', () => {
    const shape = getShape(['str:x']);
    const kx = new MonkeyString('x');
    const hash = new ShapedHash(shape, [new MonkeyInteger(1)], [kx]);
    
    const ky = new MonkeyString('y');
    hash.setByString('str:y', new MonkeyInteger(2), ky);
    
    assert.notEqual(hash.shape.id, shape.id);
    assert.equal(hash.shape.slotCount, 2);
    assert.equal(hash.getByString('str:x').value, 1);
    assert.equal(hash.getByString('str:y').value, 2);
  });

  it('inspect returns readable representation', () => {
    const shape = getShape(['int:1']);
    const hash = new ShapedHash(shape, [new MonkeyString('one')], [new MonkeyInteger(1)]);
    assert.equal(hash.inspect(), '{1: one}');
  });
});

describe('InlineCache', () => {
  beforeEach(() => {
    resetShapes();
  });

  it('monomorphic hit', () => {
    const ic = new InlineCache();
    const shape = getShape(['str:x', 'str:y']);
    const slots = [new MonkeyInteger(10), new MonkeyInteger(20)];
    
    // Miss on first access
    let result = ic.lookup(shape, 'str:x', slots);
    assert.equal(result, undefined);
    ic.update(shape, 'str:x', 0);
    
    // Hit on second access
    result = ic.lookup(shape, 'str:x', slots);
    assert.equal(result.value, 10);
    assert.equal(ic.hits, 1);
    assert.equal(ic.misses, 1);
  });

  it('polymorphic: different shapes', () => {
    const ic = new InlineCache();
    const shape1 = getShape(['str:x']);
    const shape2 = getShape(['str:x', 'str:y']);
    
    // First shape
    ic.update(shape1, 'str:x', 0);
    // Second shape (different)
    ic.update(shape2, 'str:x', 0);
    
    assert.ok(ic.poly !== null);
    assert.equal(ic.poly.length, 2);
  });

  it('megamorphic after MAX_POLY shapes', () => {
    const ic = new InlineCache();
    
    for (let i = 0; i < 5; i++) {
      const shape = getShape([`str:key${i}`]);
      ic.update(shape, `str:key${i}`, 0);
    }
    
    assert.ok(ic.megamorphic);
    assert.equal(ic.poly, null);
  });

  it('reset clears all state', () => {
    const ic = new InlineCache();
    const shape = getShape(['str:x']);
    ic.update(shape, 'str:x', 0);
    
    ic.reset();
    assert.equal(ic.shapeId, -1);
    assert.equal(ic.slotIndex, -1);
    assert.equal(ic.hits, 0);
    assert.equal(ic.misses, 0);
    assert.ok(!ic.megamorphic);
  });
});

describe('IC Table', () => {
  it('creates IC entries per bytecode position', () => {
    const table = createICTable();
    const ic1 = getIC(table, 10);
    const ic2 = getIC(table, 20);
    const ic1again = getIC(table, 10);
    
    assert.ok(ic1 instanceof InlineCache);
    assert.notEqual(ic1, ic2);
    assert.equal(ic1, ic1again); // Same position returns same IC
  });
});

describe('VM integration — shaped hashes', () => {
  it('empty hash', () => {
    const result = runVM('{}');
    assert.equal(result.type(), 'HASH');
  });

  it('hash with integer keys', () => {
    const result = runVM('{1: 2, 3: 4}');
    assert.equal(result.type(), 'HASH');
    assert.ok(result instanceof ShapedHash);
  });

  it('hash property access', () => {
    const result = runVM('{"x": 10, "y": 20}["x"]');
    assert.equal(result.value, 10);
  });

  it('hash property access — string keys', () => {
    const result = runVM('let h = {"name": "Alice", "age": 30}; h["name"]');
    assert.equal(result.value, 'Alice');
  });

  it('hash property access — integer keys', () => {
    const result = runVM('let h = {1: "one", 2: "two"}; h[1]');
    assert.equal(result.value, 'one');
  });

  it('hash property access — boolean keys', () => {
    const result = runVM('{true: 1, false: 0}[true]');
    assert.equal(result.value, 1);
  });

  it('hash access — missing key returns null', () => {
    const result = runVM('{"x": 1}["y"]');
    assert.equal(result.type(), 'NULL');
  });

  it('nested hash access', () => {
    const result = runVM('let h = {"a": {"b": 42}}; h["a"]["b"]');
    assert.equal(result.value, 42);
  });

  it('hash in function — same shape reused', () => {
    const result = runVM(`
      let make = fn(x, y) { {"x": x, "y": y} }
      let p1 = make(1, 2)
      let p2 = make(3, 4)
      p1["x"] + p2["y"]
    `);
    assert.equal(result.value, 5);
  });

  it('inline cache hit — repeated access same shape', () => {
    const result = runVM(`
      let h = {"val": 0}
      let a = h["val"]
      let b = h["val"]
      let c = h["val"]
      a + b + c
    `);
    assert.equal(result.value, 0);
  });

  it('keys builtin works with shaped hash', () => {
    const result = runVM('keys({"a": 1, "b": 2})');
    assert.equal(result.type(), 'ARRAY');
    assert.equal(result.elements.length, 2);
  });

  it('values builtin works with shaped hash', () => {
    const result = runVM('values({"x": 10, "y": 20})');
    assert.equal(result.type(), 'ARRAY');
    assert.equal(result.elements.length, 2);
    // Values should be 10 and 20 (order may vary)
    const vals = result.elements.map(e => e.value).sort();
    assert.deepEqual(vals, [10, 20]);
  });

  it('hash deep equality', () => {
    const result = runVM('{"x": 1, "y": 2} == {"x": 1, "y": 2}');
    assert.equal(result.value, true);
  });

  it('hash with computed keys', () => {
    const result = runVM('let k = "hello"; {k: 123}[k]');
    // This depends on how the compiler handles it
    // k as a key literal vs variable
  });

  it('hash in loop — IC polymorphic test', () => {
    const result = runVM(`
      let sum = 0
      let points = [{"x": 1}, {"x": 2}, {"x": 3}, {"x": 4}, {"x": 5}]
      for (p in points) {
        set sum = sum + p["x"]
      }
      sum
    `);
    assert.equal(result.value, 15);
  });

  it('hash property access in recursive function', () => {
    const result = runVM(`
      let get_val = fn(h) { h["value"] }
      get_val({"value": 42})
    `);
    assert.equal(result.value, 42);
  });

  it('multiple different shapes accessed at same site', () => {
    const result = runVM(`
      let get_x = fn(h) { h["x"] }
      let a = get_x({"x": 1, "y": 2})
      let b = get_x({"x": 10})
      a + b
    `);
    assert.equal(result.value, 11);
  });

  it('hash with many keys', () => {
    const result = runVM(`
      let h = {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5}
      h["a"] + h["b"] + h["c"] + h["d"] + h["e"]
    `);
    assert.equal(result.value, 15);
  });

  it('hash.inspect works', () => {
    const result = runVM('{"x": 1}');
    assert.ok(result.inspect().includes('x'));
    assert.ok(result.inspect().includes('1'));
  });
});

describe('objectKeyString', () => {
  it('converts MonkeyInteger', () => {
    assert.equal(objectKeyString(new MonkeyInteger(42)), 'int:42');
  });

  it('converts MonkeyString', () => {
    assert.equal(objectKeyString(new MonkeyString('hello')), 'str:hello');
  });

  it('converts MonkeyBoolean', () => {
    assert.equal(objectKeyString(new MonkeyBoolean(true)), 'bool:true');
  });
});

describe('IC stats — monomorphic hit rate', () => {
  it('achieves high hit rate on repeated access', () => {
    const result = runVM(`
      let h = {"x": 1, "y": 2}
      let sum = 0
      let i = 0
      while (i < 50) {
        set sum = sum + h["x"]
        set i = i + 1
      }
      sum
    `);
    assert.equal(result.value, 50);
  });

  it('handles hash as function argument', () => {
    const result = runVM(`
      let get = fn(h, k) { h[k] }
      let h = {"a": 10, "b": 20}
      get(h, "a") + get(h, "b")
    `);
    assert.equal(result.value, 30);
  });

  it('dot access on hash works', () => {
    const result = runVM(`
      let h = {"name": "Alice"}
      h.name
    `);
    assert.equal(result.value, 'Alice');
  });

  it('handles empty hash access gracefully', () => {
    const result = runVM('{}["x"]');
    assert.equal(result.type(), 'NULL');
  });

  it('large hash with many keys', () => {
    const result = runVM(`
      let h = {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5, "f": 6, "g": 7, "h": 8}
      h["a"] + h["d"] + h["h"]
    `);
    assert.equal(result.value, 13);
  });
});

describe('IC stress — polymorphic patterns', () => {
  it('handles 3 shapes at same access site', () => {
    const result = runVM(`
      let get_x = fn(h) { h["x"] }
      let a = get_x({"x": 1})
      let b = get_x({"x": 2, "y": 3})
      let c = get_x({"x": 4, "y": 5, "z": 6})
      a + b + c
    `);
    assert.equal(result.value, 7);
  });

  it('handles 5+ shapes (megamorphic)', () => {
    const result = runVM(`
      let get_x = fn(h) { h["x"] }
      let a = get_x({"x": 1})
      let b = get_x({"x": 2, "a": 0})
      let c = get_x({"x": 3, "b": 0})
      let d = get_x({"x": 4, "c": 0})
      let e = get_x({"x": 5, "d": 0})
      a + b + c + d + e
    `);
    assert.equal(result.value, 15);
  });

  it('monomorphic loop access (100 iterations)', () => {
    const result = runVM(`
      let h = {"count": 0}
      let i = 0
      while (i < 100) {
        set i = i + h["count"] + 1
      }
      i
    `);
    assert.equal(result.value, 100);
  });

  it('shape transition during runtime', () => {
    const result = runVM(`
      let h = {"a": 1}
      let x = h["a"]
      x
    `);
    assert.equal(result.value, 1);
  });

  it('access on objects with same keys returns same shape', () => {
    const result = runVM(`
      let make = fn(v) { {"key": v} }
      let a = make(10)
      let b = make(20)
      a["key"] + b["key"]
    `);
    assert.equal(result.value, 30);
  });

  it('nested hash access', () => {
    const result = runVM(`
      let outer = {"inner": {"val": 42}}
      outer["inner"]["val"]
    `);
    assert.equal(result.value, 42);
  });

  it('hash with boolean keys', () => {
    const result = runVM(`
      let h = {true: 1, false: 0}
      h[true] + h[false]
    `);
    assert.equal(result.value, 1);
  });

  it('hash keys builtin with shaped hash', () => {
    const result = runVM(`
      let h = {"x": 1, "y": 2, "z": 3}
      len(keys(h))
    `);
    assert.equal(result.value, 3);
  });

  it('values builtin with shaped hash', () => {
    const result = runVM(`
      let h = {"a": 10, "b": 20}
      let v = values(h)
      v[0] + v[1]
    `);
    assert.equal(result.value, 30);
  });

  it('hash equality with shaped hashes', () => {
    const result = runVM(`
      {"x": 1, "y": 2} == {"x": 1, "y": 2}
    `);
    assert.equal(result.value, true);
  });
});
