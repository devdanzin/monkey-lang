/**
 * Tiny Bloom Clock
 *
 * A probabilistic causal ordering mechanism that combines bloom filters
 * with vector clocks. Instead of tracking exact event counts per node,
 * a bloom clock hashes events into a fixed-size bit array, enabling
 * compact causality tracking with tunable false-positive rates.
 *
 * Key properties:
 * - Space-efficient: O(m) bits regardless of number of nodes
 * - Causality: if A happened-before B, then A's bits ⊆ B's bits
 * - Probabilistic: may report false concurrency but never false causality
 * - Mergeable: union of two bloom clocks preserves causal history
 */

class BloomClock {
  /**
   * @param {number} size - Number of bits in the bloom filter
   * @param {number} hashCount - Number of hash functions to use
   * @param {string} nodeId - Identifier for this node
   */
  constructor(size = 64, hashCount = 3, nodeId = 'default') {
    this.size = size;
    this.hashCount = hashCount;
    this.nodeId = nodeId;
    this.bits = new Uint8Array(Math.ceil(size / 8));
    this.eventCount = 0;
  }

  /**
   * Record a local event, setting bits in the bloom filter
   * @param {string} [eventId] - Optional event identifier (auto-generated if omitted)
   * @returns {BloomClock} this
   */
  tick(eventId) {
    const id = eventId || `${this.nodeId}:${this.eventCount}`;
    this.eventCount++;
    const positions = this._hash(id);
    for (const pos of positions) {
      this._setBit(pos);
    }
    return this;
  }

  /**
   * Merge another bloom clock into this one (causal join)
   * @param {BloomClock} other
   * @returns {BloomClock} this
   */
  merge(other) {
    if (other.size !== this.size) {
      throw new Error(`Size mismatch: ${this.size} vs ${other.size}`);
    }
    for (let i = 0; i < this.bits.length; i++) {
      this.bits[i] |= other.bits[i];
    }
    return this;
  }

  /**
   * Check if this clock's events are a subset of another's (happened-before)
   * @param {BloomClock} other
   * @returns {boolean} true if this ≤ other (this happened-before or equal)
   */
  happenedBefore(other) {
    for (let i = 0; i < this.bits.length; i++) {
      if ((this.bits[i] & other.bits[i]) !== this.bits[i]) return false;
    }
    return true;
  }

  /**
   * Compare causality between two clocks
   * @param {BloomClock} other
   * @returns {'before'|'after'|'concurrent'|'equal'}
   */
  compare(other) {
    const thisBeforeOther = this.happenedBefore(other);
    const otherBeforeThis = other.happenedBefore(this);

    if (thisBeforeOther && otherBeforeThis) return 'equal';
    if (thisBeforeOther) return 'before';
    if (otherBeforeThis) return 'after';
    return 'concurrent';
  }

  /**
   * Check if a specific event is (probably) recorded in this clock
   * @param {string} eventId
   * @returns {boolean}
   */
  contains(eventId) {
    const positions = this._hash(eventId);
    return positions.every(pos => this._getBit(pos));
  }

  /**
   * Return the number of set bits (hamming weight / population count)
   * @returns {number}
   */
  popCount() {
    let count = 0;
    for (let i = 0; i < this.bits.length; i++) {
      let b = this.bits[i];
      while (b) {
        count += b & 1;
        b >>= 1;
      }
    }
    return count;
  }

  /**
   * Estimate the false positive rate given current fill level
   * @returns {number} estimated FPR between 0 and 1
   */
  estimateFPR() {
    const setBits = this.popCount();
    // Probability a single hash hits a set bit
    const p = setBits / this.size;
    // Probability all k hashes hit set bits
    return Math.pow(p, this.hashCount);
  }

  /**
   * Create a deep copy
   * @returns {BloomClock}
   */
  clone() {
    const c = new BloomClock(this.size, this.hashCount, this.nodeId);
    c.bits = new Uint8Array(this.bits);
    c.eventCount = this.eventCount;
    return c;
  }

  /**
   * Serialize to a compact object
   * @returns {object}
   */
  serialize() {
    return {
      size: this.size,
      hashCount: this.hashCount,
      nodeId: this.nodeId,
      bits: Buffer.from(this.bits).toString('base64'),
      eventCount: this.eventCount,
    };
  }

  /**
   * Deserialize from a compact object
   * @param {object} data
   * @returns {BloomClock}
   */
  static deserialize(data) {
    const bc = new BloomClock(data.size, data.hashCount, data.nodeId);
    bc.bits = new Uint8Array(Buffer.from(data.bits, 'base64'));
    bc.eventCount = data.eventCount;
    return bc;
  }

  // --- Internal ---

  _setBit(pos) {
    const byteIdx = pos >> 3;
    const bitIdx = pos & 7;
    this.bits[byteIdx] |= (1 << bitIdx);
  }

  _getBit(pos) {
    const byteIdx = pos >> 3;
    const bitIdx = pos & 7;
    return (this.bits[byteIdx] & (1 << bitIdx)) !== 0;
  }

  /**
   * Simple but effective hash: FNV-1a with different seeds
   * @param {string} key
   * @returns {number[]} array of bit positions
   */
  _hash(key) {
    const positions = [];
    for (let i = 0; i < this.hashCount; i++) {
      let h = 2166136261 ^ (i * 16777619);
      for (let j = 0; j < key.length; j++) {
        h ^= key.charCodeAt(j);
        h = Math.imul(h, 16777619);
      }
      positions.push(((h >>> 0) % this.size));
    }
    return positions;
  }
}

module.exports = { BloomClock };
