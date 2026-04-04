// wal.js — Write-Ahead Log for crash-safe persistence
// Operations are logged before applied. On recovery, replay the log.

import { appendFileSync, readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { BTree } from './btree.js';

// Log entry types
const OP_SET = 'S';
const OP_DELETE = 'D';
const OP_CHECKPOINT = 'C';

// ===== Write-Ahead Log =====
export class WAL {
  constructor(path) {
    this.path = path;
    this.entries = 0;
  }

  // Append an operation to the log
  append(op, key, value) {
    const entry = JSON.stringify({ op, key, value, ts: Date.now() }) + '\n';
    appendFileSync(this.path, entry, 'utf8');
    this.entries++;
  }

  // Read all entries from the log
  read() {
    if (!existsSync(this.path)) return [];
    const content = readFileSync(this.path, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    return lines.map(line => {
      try { return JSON.parse(line); }
      catch { return null; }
    }).filter(Boolean);
  }

  // Truncate the log (after checkpoint)
  truncate() {
    writeFileSync(this.path, '', 'utf8');
    this.entries = 0;
  }

  // Check if log file exists
  exists() {
    return existsSync(this.path);
  }

  size() {
    if (!existsSync(this.path)) return 0;
    return readFileSync(this.path, 'utf8').length;
  }
}

// ===== Persistent KV Store with WAL =====
export class PersistentKVStore {
  constructor(options = {}) {
    this.dataPath = options.dataPath || 'data.json';
    this.walPath = options.walPath || 'data.wal';
    this.tree = new BTree(options.order || 4);
    this.wal = new WAL(this.walPath);
    this.compactThreshold = options.compactThreshold || 100;

    // Recovery
    this._recover();
  }

  // ===== Public API =====
  get(key) {
    return this.tree.get(key);
  }

  set(key, value) {
    // Write to WAL first (durability)
    this.wal.append(OP_SET, key, value);
    // Then apply to in-memory tree
    this.tree.set(key, value);
    // Auto-compact if WAL is large
    if (this.wal.entries >= this.compactThreshold) {
      this.checkpoint();
    }
    return this;
  }

  delete(key) {
    this.wal.append(OP_DELETE, key);
    this.tree.delete(key);
    return this;
  }

  has(key) { return this.tree.has(key); }
  get size() { return this.tree.size; }

  range(min, max) { return this.tree.range(min, max); }
  keys() { return this.tree.keys(); }
  values() { return this.tree.values(); }
  entries() { return this.tree.entries(); }

  // ===== Checkpoint =====
  // Flush current state to data file, truncate WAL
  checkpoint() {
    const data = this.tree.toArray();
    const snapshot = JSON.stringify(data);

    // Write to temp file first (atomic)
    const tmpPath = this.dataPath + '.tmp';
    writeFileSync(tmpPath, snapshot, 'utf8');

    // Rename atomically
    renameSync(tmpPath, this.dataPath);

    // Truncate WAL
    this.wal.truncate();

    return data.length;
  }

  // ===== Recovery =====
  _recover() {
    // 1. Load last checkpoint
    if (existsSync(this.dataPath)) {
      try {
        const data = JSON.parse(readFileSync(this.dataPath, 'utf8'));
        for (const { key, value } of data) {
          this.tree.set(key, value);
        }
      } catch {
        // Corrupted checkpoint, skip
      }
    }

    // 2. Replay WAL entries on top
    const walEntries = this.wal.read();
    for (const entry of walEntries) {
      if (entry.op === OP_SET) {
        this.tree.set(entry.key, entry.value);
      } else if (entry.op === OP_DELETE) {
        this.tree.delete(entry.key);
      }
    }
  }

  // ===== Cleanup =====
  close() {
    this.checkpoint();
  }

  destroy() {
    try { unlinkSync(this.dataPath); } catch {}
    try { unlinkSync(this.walPath); } catch {}
    try { unlinkSync(this.dataPath + '.tmp'); } catch {}
  }
}
