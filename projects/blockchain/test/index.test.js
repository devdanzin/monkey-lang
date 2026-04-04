import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Block, Blockchain } from '../src/index.js';

describe('Block', () => {
  it('calculates hash', () => {
    const b = new Block(0, 1000, { test: true }, '0');
    assert.ok(b.hash.length === 64);
  });

  it('mines with difficulty', () => {
    const b = new Block(1, 1000, 'test', '0');
    b.mine(2);
    assert.ok(b.hash.startsWith('00'));
    assert.ok(b.nonce > 0);
  });

  it('different data → different hash', () => {
    const a = new Block(0, 1000, 'a', '0');
    const b = new Block(0, 1000, 'b', '0');
    assert.notEqual(a.hash, b.hash);
  });
});

describe('Blockchain — basic', () => {
  it('starts with genesis', () => {
    const bc = new Blockchain(1);
    assert.equal(bc.length, 1);
    assert.equal(bc.chain[0].index, 0);
  });

  it('adds blocks', () => {
    const bc = new Blockchain(1);
    bc.addBlock({ msg: 'first' });
    bc.addBlock({ msg: 'second' });
    assert.equal(bc.length, 3);
  });

  it('links blocks correctly', () => {
    const bc = new Blockchain(1);
    bc.addBlock('data');
    assert.equal(bc.chain[1].previousHash, bc.chain[0].hash);
  });

  it('mined blocks satisfy difficulty', () => {
    const bc = new Blockchain(2);
    bc.addBlock('test');
    assert.ok(bc.chain[1].hash.startsWith('00'));
  });
});

describe('Blockchain — validation', () => {
  it('valid chain passes', () => {
    const bc = new Blockchain(1);
    bc.addBlock('a'); bc.addBlock('b');
    assert.equal(bc.isValid(), true);
  });

  it('tampered data detected', () => {
    const bc = new Blockchain(1);
    bc.addBlock('original');
    bc.chain[1].data = 'tampered';
    assert.equal(bc.isValid(), false);
  });

  it('tampered hash detected', () => {
    const bc = new Blockchain(1);
    bc.addBlock('x');
    bc.chain[1].hash = '0000000000';
    assert.equal(bc.isValid(), false);
  });
});

describe('Blockchain — transactions', () => {
  it('tracks transactions', () => {
    const bc = new Blockchain(1);
    bc.addTransaction({ from: 'Alice', to: 'Bob', amount: 50 });
    bc.addTransaction({ from: 'Bob', to: 'Charlie', amount: 20 });
    bc.minePendingTransactions('miner1');
    
    assert.equal(bc.getAllTransactions().length, 2);
  });

  it('calculates balance', () => {
    const bc = new Blockchain(1);
    bc.addTransaction({ from: 'Alice', to: 'Bob', amount: 100 });
    bc.addTransaction({ from: 'Bob', to: 'Charlie', amount: 30 });
    bc.minePendingTransactions('miner');
    
    assert.equal(bc.getBalance('Alice'), -100);
    assert.equal(bc.getBalance('Bob'), 70);
    assert.equal(bc.getBalance('Charlie'), 30);
  });
});
