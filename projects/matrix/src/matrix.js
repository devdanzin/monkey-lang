// Matrix math — create, operations, decompositions

export class Matrix {
  constructor(rows, cols, data) {
    this.rows = rows;
    this.cols = cols;
    this.data = data || new Float64Array(rows * cols);
  }

  static zeros(r, c) { return new Matrix(r, c); }
  static ones(r, c) { const m = new Matrix(r, c); m.data.fill(1); return m; }
  static identity(n) { const m = new Matrix(n, n); for (let i = 0; i < n; i++) m.set(i, i, 1); return m; }
  static from(arr) { const r = arr.length, c = arr[0].length; const m = new Matrix(r, c); for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) m.set(i, j, arr[i][j]); return m; }

  get(i, j) { return this.data[i * this.cols + j]; }
  set(i, j, v) { this.data[i * this.cols + j] = v; return this; }

  add(other) { const m = new Matrix(this.rows, this.cols); for (let i = 0; i < this.data.length; i++) m.data[i] = this.data[i] + other.data[i]; return m; }
  sub(other) { const m = new Matrix(this.rows, this.cols); for (let i = 0; i < this.data.length; i++) m.data[i] = this.data[i] - other.data[i]; return m; }
  scale(s) { const m = new Matrix(this.rows, this.cols); for (let i = 0; i < this.data.length; i++) m.data[i] = this.data[i] * s; return m; }

  mul(other) {
    const m = new Matrix(this.rows, other.cols);
    for (let i = 0; i < this.rows; i++)
      for (let j = 0; j < other.cols; j++) {
        let sum = 0;
        for (let k = 0; k < this.cols; k++) sum += this.get(i, k) * other.get(k, j);
        m.set(i, j, sum);
      }
    return m;
  }

  transpose() {
    const m = new Matrix(this.cols, this.rows);
    for (let i = 0; i < this.rows; i++)
      for (let j = 0; j < this.cols; j++) m.set(j, i, this.get(i, j));
    return m;
  }

  determinant() {
    if (this.rows !== this.cols) throw new Error('Not square');
    const n = this.rows;
    if (n === 1) return this.get(0, 0);
    if (n === 2) return this.get(0,0)*this.get(1,1) - this.get(0,1)*this.get(1,0);
    let det = 0;
    for (let j = 0; j < n; j++) {
      det += (j % 2 === 0 ? 1 : -1) * this.get(0, j) * this.minor(0, j).determinant();
    }
    return det;
  }

  minor(row, col) {
    const m = new Matrix(this.rows - 1, this.cols - 1);
    let mi = 0;
    for (let i = 0; i < this.rows; i++) {
      if (i === row) continue;
      let mj = 0;
      for (let j = 0; j < this.cols; j++) {
        if (j === col) continue;
        m.set(mi, mj++, this.get(i, j));
      }
      mi++;
    }
    return m;
  }

  trace() { let s = 0; for (let i = 0; i < Math.min(this.rows, this.cols); i++) s += this.get(i, i); return s; }

  equals(other, eps = 1e-10) {
    if (this.rows !== other.rows || this.cols !== other.cols) return false;
    for (let i = 0; i < this.data.length; i++) if (Math.abs(this.data[i] - other.data[i]) > eps) return false;
    return true;
  }

  toArray() { const r = []; for (let i = 0; i < this.rows; i++) { const row = []; for (let j = 0; j < this.cols; j++) row.push(this.get(i, j)); r.push(row); } return r; }
  clone() { const m = new Matrix(this.rows, this.cols); m.data.set(this.data); return m; }
}
