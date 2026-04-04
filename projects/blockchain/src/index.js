// ===== Simple Blockchain =====
import { createHash } from 'node:crypto';

function sha256(data) { return createHash('sha256').update(data).digest('hex'); }

export class Block {
  constructor(index, timestamp, data, previousHash) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return sha256(
      this.index + this.timestamp + JSON.stringify(this.data) + this.previousHash + this.nonce
    );
  }

  // Proof of work: find nonce such that hash starts with `difficulty` zeros
  mine(difficulty) {
    const target = '0'.repeat(difficulty);
    while (!this.hash.startsWith(target)) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    return this;
  }
}

export class Blockchain {
  constructor(difficulty = 2) {
    this.chain = [this._createGenesis()];
    this.difficulty = difficulty;
    this.pendingTransactions = [];
  }

  _createGenesis() {
    const block = new Block(0, Date.now(), { genesis: true }, '0');
    block.mine(2);
    return block;
  }

  get latestBlock() { return this.chain[this.chain.length - 1]; }
  get length() { return this.chain.length; }

  addBlock(data) {
    const block = new Block(
      this.chain.length,
      Date.now(),
      data,
      this.latestBlock.hash
    );
    block.mine(this.difficulty);
    this.chain.push(block);
    return block;
  }

  // Validate entire chain
  isValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      // Verify hash
      if (current.hash !== current.calculateHash()) return false;
      // Verify link
      if (current.previousHash !== previous.hash) return false;
      // Verify proof of work
      if (!current.hash.startsWith('0'.repeat(this.difficulty))) return false;
    }
    return true;
  }

  // Get block by index
  getBlock(index) { return this.chain[index]; }

  // Transaction support
  addTransaction(transaction) {
    this.pendingTransactions.push(transaction);
  }

  minePendingTransactions(minerAddress) {
    const block = this.addBlock({
      transactions: this.pendingTransactions,
      miner: minerAddress,
    });
    this.pendingTransactions = [];
    return block;
  }

  // Get all transactions
  getAllTransactions() {
    const txs = [];
    for (const block of this.chain) {
      if (block.data.transactions) {
        txs.push(...block.data.transactions);
      }
    }
    return txs;
  }

  // Get balance for address
  getBalance(address) {
    let balance = 0;
    for (const tx of this.getAllTransactions()) {
      if (tx.from === address) balance -= tx.amount;
      if (tx.to === address) balance += tx.amount;
    }
    return balance;
  }
}
