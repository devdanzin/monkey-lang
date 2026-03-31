// Fenwick Tree (Binary Indexed Tree) — prefix sums in O(log n)

export class FenwickTree {
  constructor(n) { this._n = n; this._tree = new Float64Array(n + 1); }

  static from(arr) {
    const ft = new FenwickTree(arr.length);
    for (let i = 0; i < arr.length; i++) ft.update(i, arr[i]);
    return ft;
  }

  // Add delta to index i
  update(i, delta) { for (i += 1; i <= this._n; i += i & (-i)) this._tree[i] += delta; }

  // Set index i to value
  set(i, value) { this.update(i, value - this.get(i)); }

  // Prefix sum [0, i]
  prefixSum(i) { let sum = 0; for (i += 1; i > 0; i -= i & (-i)) sum += this._tree[i]; return sum; }

  // Range sum [lo, hi]
  rangeSum(lo, hi) { return lo === 0 ? this.prefixSum(hi) : this.prefixSum(hi) - this.prefixSum(lo - 1); }

  // Get single element
  get(i) { return this.rangeSum(i, i); }

  get size() { return this._n; }
}

// 2D Fenwick Tree
export class FenwickTree2D {
  constructor(rows, cols) {
    this._rows = rows; this._cols = cols;
    this._tree = Array.from({ length: rows + 1 }, () => new Float64Array(cols + 1));
  }

  update(r, c, delta) {
    for (let i = r + 1; i <= this._rows; i += i & (-i))
      for (let j = c + 1; j <= this._cols; j += j & (-j))
        this._tree[i][j] += delta;
  }

  prefixSum(r, c) {
    let sum = 0;
    for (let i = r + 1; i > 0; i -= i & (-i))
      for (let j = c + 1; j > 0; j -= j & (-j))
        sum += this._tree[i][j];
    return sum;
  }
}
