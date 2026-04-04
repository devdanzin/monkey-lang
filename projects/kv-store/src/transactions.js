// transactions.js — MVCC transactions for the KV store
// Implements snapshot isolation: each transaction sees a consistent snapshot

import { BTree } from './btree.js';

let txCounter = 0;

// ===== Transaction =====
export class Transaction {
  constructor(store) {
    this.id = ++txCounter;
    this.store = store;
    this.snapshot = store._version; // snapshot at start
    this.writeSet = new Map();      // key -> { op: 'set'|'delete', value }
    this.readSet = new Set();       // keys read
    this.status = 'active';         // active, committed, aborted
  }

  get(key) {
    if (this.status !== 'active') throw new Error('Transaction not active');
    this.readSet.add(key);

    // Check local write set first
    if (this.writeSet.has(key)) {
      const entry = this.writeSet.get(key);
      if (entry.op === 'delete') return undefined;
      return entry.value;
    }

    // Read from snapshot
    return this.store._getAtVersion(key, this.snapshot);
  }

  set(key, value) {
    if (this.status !== 'active') throw new Error('Transaction not active');
    this.writeSet.set(key, { op: 'set', value });
    return this;
  }

  delete(key) {
    if (this.status !== 'active') throw new Error('Transaction not active');
    this.writeSet.set(key, { op: 'delete' });
    return this;
  }

  commit() {
    if (this.status !== 'active') throw new Error('Transaction not active');

    // Validate: check for write-write conflicts
    const conflict = this.store._checkConflicts(this);
    if (conflict) {
      this.status = 'aborted';
      throw new Error(`Transaction conflict on key: ${conflict}`);
    }

    // Apply write set
    this.store._applyTransaction(this);
    this.status = 'committed';
    return true;
  }

  rollback() {
    if (this.status !== 'active') throw new Error('Transaction not active');
    this.status = 'aborted';
  }
}

// ===== Transactional KV Store =====
export class TransactionalKVStore {
  constructor(options = {}) {
    this.tree = new BTree(options.order || 4);
    this._version = 0;
    this._versionHistory = new Map(); // key -> [{version, value, deleted}]
    this._activeTxns = new Set();
    this._committedWrites = new Map(); // key -> last committed version
  }

  // Direct operations (auto-commit)
  get(key) {
    const history = this._versionHistory.get(key);
    if (!history || history.length === 0) return this.tree.get(key);
    const latest = history[history.length - 1];
    if (latest.deleted) return undefined;
    return latest.value;
  }

  set(key, value) {
    this._version++;
    this.tree.set(key, value);
    this._recordVersion(key, value, false);
    return this;
  }

  delete(key) {
    this._version++;
    this.tree.delete(key);
    this._recordVersion(key, undefined, true);
    return this;
  }

  has(key) { return this.get(key) !== undefined; }
  get size() { return this.tree.size; }
  range(min, max) { return this.tree.range(min, max); }

  // ===== Transactions =====
  begin() {
    const txn = new Transaction(this);
    this._activeTxns.add(txn);
    return txn;
  }

  _getAtVersion(key, version) {
    const history = this._versionHistory.get(key);
    if (!history) return this.tree.get(key);

    // Find the latest version <= snapshot
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].version <= version) {
        if (history[i].deleted) return undefined;
        return history[i].value;
      }
    }
    return this.tree.get(key);
  }

  _recordVersion(key, value, deleted) {
    if (!this._versionHistory.has(key)) {
      this._versionHistory.set(key, []);
    }
    this._versionHistory.get(key).push({
      version: this._version,
      value,
      deleted,
    });
    this._committedWrites.set(key, this._version);
  }

  _checkConflicts(txn) {
    for (const [key] of txn.writeSet) {
      const lastWrite = this._committedWrites.get(key);
      if (lastWrite !== undefined && lastWrite > txn.snapshot) {
        return key; // Write-write conflict
      }
    }
    return null;
  }

  _applyTransaction(txn) {
    this._version++;
    for (const [key, entry] of txn.writeSet) {
      if (entry.op === 'set') {
        this.tree.set(key, entry.value);
        this._recordVersion(key, entry.value, false);
      } else if (entry.op === 'delete') {
        this.tree.delete(key);
        this._recordVersion(key, undefined, true);
      }
    }
    this._activeTxns.delete(txn);

    // GC old versions (keep only those needed by active txns)
    this._gc();
  }

  _gc() {
    if (this._activeTxns.size === 0) {
      // No active transactions — can truncate all history
      // Keep just the latest version for each key
      for (const [key, history] of this._versionHistory) {
        if (history.length > 1) {
          this._versionHistory.set(key, [history[history.length - 1]]);
        }
      }
    }
  }

  // Clean up
  clear() {
    this.tree.clear();
    this._version = 0;
    this._versionHistory.clear();
    this._activeTxns.clear();
    this._committedWrites.clear();
  }
}
