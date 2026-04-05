// blockchain.js — Simple Blockchain

import { createHash } from 'node:crypto';

function sha256(data) { return createHash('sha256').update(data).digest('hex'); }

// ===== Merkle Tree =====
export function merkleRoot(items) {
  if (items.length === 0) return sha256('');
  let hashes = items.map(i => sha256(JSON.stringify(i)));
  while (hashes.length > 1) {
    const next = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = i + 1 < hashes.length ? hashes[i + 1] : left;
      next.push(sha256(left + right));
    }
    hashes = next;
  }
  return hashes[0];
}

// ===== Transaction =====
export class Transaction {
  constructor(from, to, amount, timestamp = Date.now()) {
    this.from = from; this.to = to; this.amount = amount; this.timestamp = timestamp;
  }
  hash() { return sha256(JSON.stringify({ from: this.from, to: this.to, amount: this.amount, timestamp: this.timestamp })); }
}

// ===== Block =====
export class Block {
  constructor(index, previousHash, transactions, timestamp = Date.now()) {
    this.index = index;
    this.previousHash = previousHash;
    this.transactions = transactions;
    this.timestamp = timestamp;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return sha256(this.index + this.previousHash + this.timestamp + JSON.stringify(this.transactions) + this.nonce);
  }

  mine(difficulty) {
    const target = '0'.repeat(difficulty);
    while (this.hash.slice(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    return this;
  }

  get merkleRoot() { return merkleRoot(this.transactions); }
}

// ===== Blockchain =====
export class Blockchain {
  constructor(difficulty = 2) {
    this.chain = [this._createGenesis()];
    this.difficulty = difficulty;
    this.pendingTransactions = [];
    this.miningReward = 10;
  }

  _createGenesis() { return new Block(0, '0', [], 0); }
  get latestBlock() { return this.chain[this.chain.length - 1]; }

  addTransaction(tx) {
    if (!tx.from && tx.from !== null) throw new Error('Missing from');
    if (!tx.to) throw new Error('Missing to');
    if (tx.amount <= 0) throw new Error('Amount must be positive');
    this.pendingTransactions.push(tx);
  }

  minePendingTransactions(minerAddress) {
    // Add mining reward
    this.pendingTransactions.push(new Transaction(null, minerAddress, this.miningReward));
    
    const block = new Block(this.chain.length, this.latestBlock.hash, this.pendingTransactions);
    block.mine(this.difficulty);
    this.chain.push(block);
    this.pendingTransactions = [];
    return block;
  }

  getBalance(address) {
    let balance = 0;
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.from === address) balance -= tx.amount;
        if (tx.to === address) balance += tx.amount;
      }
    }
    return balance;
  }

  isValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];
      
      if (current.hash !== current.calculateHash()) return false;
      if (current.previousHash !== previous.hash) return false;
    }
    return true;
  }

  get length() { return this.chain.length; }
}

// ===== Wallet =====
export class Wallet {
  constructor(name) {
    this.address = sha256(name + Date.now() + Math.random()).slice(0, 40);
    this.name = name;
  }

  createTransaction(to, amount) {
    return new Transaction(this.address, to, amount);
  }
}
