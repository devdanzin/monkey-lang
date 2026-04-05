// random.js — Random / PRNG

// ===== XorShift128 =====
export class XorShift128 {
  constructor(seed = Date.now()) {
    this.state = [seed, seed ^ 0xDEADBEEF, seed ^ 0xCAFEBABE, seed ^ 0x12345678].map(s => s >>> 0);
  }

  next() {
    let t = this.state[3];
    const s = this.state[0];
    this.state[3] = this.state[2];
    this.state[2] = this.state[1];
    this.state[1] = s;
    t ^= t << 11; t ^= t >>> 8;
    this.state[0] = t ^ s ^ (s >>> 19);
    return this.state[0] >>> 0;
  }

  float() { return this.next() / 4294967296; }
  int(min, max) { return Math.floor(this.float() * (max - min + 1)) + min; }
  bool(probability = 0.5) { return this.float() < probability; }
}

// ===== Random helpers =====
export class Random {
  constructor(seed) { this.rng = new XorShift128(seed); }

  float(min = 0, max = 1) { return min + this.rng.float() * (max - min); }
  int(min, max) { return this.rng.int(min, max); }
  bool(p = 0.5) { return this.rng.bool(p); }

  // Normal distribution (Box-Muller)
  gaussian(mean = 0, stddev = 1) {
    const u1 = this.rng.float() || 1e-10;
    const u2 = this.rng.float();
    return mean + stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // Pick one from array
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }

  // Sample n items without replacement
  sample(arr, n) {
    const copy = [...arr];
    const result = [];
    for (let i = 0; i < Math.min(n, copy.length); i++) {
      const idx = this.int(i, copy.length - 1);
      [copy[i], copy[idx]] = [copy[idx], copy[i]];
      result.push(copy[i]);
    }
    return result;
  }

  // Shuffle (Fisher-Yates)
  shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Weighted random
  weighted(items) {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = this.float(0, total);
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return item.value;
    }
    return items[items.length - 1].value;
  }

  // Dice roll
  dice(notation) {
    const m = /(\d+)d(\d+)(?:\+(\d+))?/.exec(notation);
    if (!m) throw new Error(`Invalid dice: ${notation}`);
    const [, count, sides, mod] = m;
    let total = 0;
    for (let i = 0; i < parseInt(count); i++) total += this.int(1, parseInt(sides));
    return total + (mod ? parseInt(mod) : 0);
  }

  // String
  string(length, charset = 'abcdefghijklmnopqrstuvwxyz0123456789') {
    return Array.from({ length }, () => charset[this.int(0, charset.length - 1)]).join('');
  }
}
