import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADTRegistry, checkExhaustiveness, checkRedundancy,
} from '../src/index.js';

// Pattern constructors
const pvar = (name) => ({ tag: 'pvar', name });
const pwild = () => ({ tag: 'pwild' });
const pcon = (name, args = []) => ({ tag: 'pcon', name, args });
const plit = (type, value) => ({ tag: 'plit', type, value });

function makeOptionRegistry() {
  const reg = new ADTRegistry();
  reg.registerType('Option', [
    { name: 'Some', arity: 1 },
    { name: 'None', arity: 0 },
  ]);
  return reg;
}

function makeBoolRegistry() {
  const reg = new ADTRegistry();
  reg.registerType('Bool', [
    { name: 'True', arity: 0 },
    { name: 'False', arity: 0 },
  ]);
  return reg;
}

function makeListRegistry() {
  const reg = new ADTRegistry();
  reg.registerType('List', [
    { name: 'Cons', arity: 2 },
    { name: 'Nil', arity: 0 },
  ]);
  return reg;
}

function makeEitherRegistry() {
  const reg = new ADTRegistry();
  reg.registerType('Either', [
    { name: 'Left', arity: 1 },
    { name: 'Right', arity: 1 },
  ]);
  return reg;
}

describe('ADTRegistry', () => {
  it('registers and retrieves types', () => {
    const reg = makeOptionRegistry();
    assert.ok(reg.getConstructors('Option'));
    assert.equal(reg.getConstructors('Option').size, 2);
  });

  it('looks up type for constructor', () => {
    const reg = makeOptionRegistry();
    assert.equal(reg.getTypeForConstructor('Some'), 'Option');
    assert.equal(reg.getTypeForConstructor('None'), 'Option');
    assert.equal(reg.getTypeForConstructor('Unknown'), null);
  });

  it('reports constructor arity', () => {
    const reg = makeOptionRegistry();
    assert.equal(reg.getConstructors('Option').get('Some'), 1);
    assert.equal(reg.getConstructors('Option').get('None'), 0);
  });
});

describe('Exhaustiveness Checking', () => {
  it('complete Option match is exhaustive', () => {
    const reg = makeOptionRegistry();
    const patterns = [pcon('Some', [pvar('x')]), pcon('None')];
    const result = checkExhaustiveness(patterns, reg);
    assert.equal(result.exhaustive, true);
    assert.equal(result.missing.length, 0);
  });

  it('missing None is not exhaustive', () => {
    const reg = makeOptionRegistry();
    const patterns = [pcon('Some', [pvar('x')])];
    const result = checkExhaustiveness(patterns, reg);
    assert.equal(result.exhaustive, false);
    assert.deepEqual(result.missing, ['None']);
  });

  it('missing Some is not exhaustive', () => {
    const reg = makeOptionRegistry();
    const patterns = [pcon('None')];
    const result = checkExhaustiveness(patterns, reg);
    assert.equal(result.exhaustive, false);
    assert.deepEqual(result.missing, ['Some']);
  });

  it('wildcard makes match exhaustive', () => {
    const reg = makeOptionRegistry();
    const patterns = [pcon('Some', [pvar('x')]), pwild()];
    const result = checkExhaustiveness(patterns, reg);
    assert.equal(result.exhaustive, true);
  });

  it('variable pattern makes match exhaustive', () => {
    const reg = makeOptionRegistry();
    const patterns = [pvar('x')];
    const result = checkExhaustiveness(patterns, reg);
    assert.equal(result.exhaustive, true);
  });

  it('Bool: both constructors covered', () => {
    const reg = makeBoolRegistry();
    const patterns = [pcon('True'), pcon('False')];
    const result = checkExhaustiveness(patterns, reg);
    assert.equal(result.exhaustive, true);
  });

  it('Bool: missing False', () => {
    const reg = makeBoolRegistry();
    const patterns = [pcon('True')];
    const result = checkExhaustiveness(patterns, reg);
    assert.equal(result.exhaustive, false);
    assert.deepEqual(result.missing, ['False']);
  });

  it('List: Cons + Nil is exhaustive', () => {
    const reg = makeListRegistry();
    const patterns = [pcon('Cons', [pvar('h'), pvar('t')]), pcon('Nil')];
    const result = checkExhaustiveness(patterns, reg);
    assert.equal(result.exhaustive, true);
  });

  it('Either: Left + Right is exhaustive', () => {
    const reg = makeEitherRegistry();
    const patterns = [pcon('Left', [pvar('l')]), pcon('Right', [pvar('r')])];
    const result = checkExhaustiveness(patterns, reg);
    assert.equal(result.exhaustive, true);
  });

  it('literal patterns are not exhaustive without wildcard', () => {
    const reg = makeOptionRegistry();
    const patterns = [plit('int', 1), plit('int', 2)];
    const result = checkExhaustiveness(patterns, reg);
    assert.equal(result.exhaustive, false);
  });
});

describe('Redundancy Checking', () => {
  it('no redundancy in complete match', () => {
    const reg = makeOptionRegistry();
    const patterns = [pcon('Some', [pvar('x')]), pcon('None')];
    const result = checkRedundancy(patterns, reg);
    assert.equal(result.redundant.length, 0);
  });

  it('pattern after wildcard is redundant', () => {
    const reg = makeOptionRegistry();
    const patterns = [pwild(), pcon('Some', [pvar('x')])];
    const result = checkRedundancy(patterns, reg);
    assert.deepEqual(result.redundant, [1]);
  });

  it('pattern after variable is redundant', () => {
    const reg = makeOptionRegistry();
    const patterns = [pvar('x'), pcon('None')];
    const result = checkRedundancy(patterns, reg);
    assert.deepEqual(result.redundant, [1]);
  });

  it('duplicate constructor is redundant', () => {
    const reg = makeOptionRegistry();
    const patterns = [pcon('Some', [pvar('x')]), pcon('Some', [pvar('y')]), pcon('None')];
    const result = checkRedundancy(patterns, reg);
    assert.deepEqual(result.redundant, [1]);
  });

  it('duplicate literal is redundant', () => {
    const reg = makeOptionRegistry();
    const patterns = [plit('int', 42), plit('int', 42)];
    const result = checkRedundancy(patterns, reg);
    assert.deepEqual(result.redundant, [1]);
  });

  it('different literals are not redundant', () => {
    const reg = makeOptionRegistry();
    const patterns = [plit('int', 1), plit('int', 2), pwild()];
    const result = checkRedundancy(patterns, reg);
    assert.equal(result.redundant.length, 0);
  });

  it('multiple patterns after wildcard are all redundant', () => {
    const reg = makeOptionRegistry();
    const patterns = [pwild(), pcon('Some', [pvar('x')]), pcon('None')];
    const result = checkRedundancy(patterns, reg);
    assert.deepEqual(result.redundant, [1, 2]);
  });
});
