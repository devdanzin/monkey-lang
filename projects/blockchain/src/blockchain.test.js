import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Block, Blockchain, Transaction, Wallet, merkleRoot } from './blockchain.js';

describe('Block', () => {
  it('creates block', () => { const b = new Block(0, '0', []); assert.equal(b.index, 0); assert.ok(b.hash.length === 64); });
  it('hash changes with data', () => { const a = new Block(0, '0', ['a']); const b = new Block(0, '0', ['b']); assert.notEqual(a.hash, b.hash); });
  it('mines with difficulty', () => { const b = new Block(0, '0', []); b.mine(2); assert.ok(b.hash.startsWith('00')); });
  it('nonce increments', () => { const b = new Block(0, '0', []); b.mine(2); assert.ok(b.nonce > 0); });
});

describe('Transaction', () => {
  it('creates transaction', () => { const tx = new Transaction('alice', 'bob', 10); assert.equal(tx.amount, 10); });
  it('has hash', () => { const tx = new Transaction('a', 'b', 5); assert.ok(tx.hash().length === 64); });
});

describe('Blockchain', () => {
  it('creates with genesis', () => { const bc = new Blockchain(1); assert.equal(bc.length, 1); });
  it('is valid initially', () => { assert.ok(new Blockchain(1).isValid()); });
  it('adds transactions and mines', () => {
    const bc = new Blockchain(1);
    bc.addTransaction(new Transaction('alice', 'bob', 5));
    bc.minePendingTransactions('miner');
    assert.equal(bc.length, 2);
  });
  it('calculates balance', () => {
    const bc = new Blockchain(1);
    bc.addTransaction(new Transaction('alice', 'bob', 5));
    bc.minePendingTransactions('miner');
    assert.equal(bc.getBalance('bob'), 5);
    assert.equal(bc.getBalance('miner'), 10); // mining reward
  });
  it('is valid after mining', () => {
    const bc = new Blockchain(1);
    bc.addTransaction(new Transaction('a', 'b', 1));
    bc.minePendingTransactions('miner');
    assert.ok(bc.isValid());
  });
  it('detects tampered block', () => {
    const bc = new Blockchain(1);
    bc.addTransaction(new Transaction('a', 'b', 1));
    bc.minePendingTransactions('miner');
    bc.chain[1].transactions[0] = new Transaction('a', 'hacker', 1000);
    assert.ok(!bc.isValid());
  });
  it('rejects negative amount', () => {
    const bc = new Blockchain(1);
    assert.throws(() => bc.addTransaction(new Transaction('a', 'b', -5)), /positive/);
  });
});

describe('Wallet', () => {
  it('generates address', () => { const w = new Wallet('alice'); assert.equal(w.address.length, 40); });
  it('creates transaction', () => { const w = new Wallet('alice'); const tx = w.createTransaction('bob_addr', 10); assert.equal(tx.from, w.address); });
  it('unique addresses', () => { const a = new Wallet('alice'); const b = new Wallet('bob'); assert.notEqual(a.address, b.address); });
});

describe('Merkle Tree', () => {
  it('empty', () => { assert.ok(merkleRoot([]).length === 64); });
  it('single item', () => { assert.ok(merkleRoot(['a']).length === 64); });
  it('multiple items', () => { const root = merkleRoot(['a', 'b', 'c']); assert.ok(root.length === 64); });
  it('deterministic', () => { assert.equal(merkleRoot(['a', 'b']), merkleRoot(['a', 'b'])); });
  it('order matters', () => { assert.notEqual(merkleRoot(['a', 'b']), merkleRoot(['b', 'a'])); });
});
