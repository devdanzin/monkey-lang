// matrix.js — Matrix math

export class Matrix {
  constructor(rows, cols, data) {
    this.rows = rows;
    this.cols = cols;
    this.data = data || new Float64Array(rows * cols);
  }

  static from2D(arr) {
    const rows = arr.length, cols = arr[0].length;
    const m = new Matrix(rows, cols);
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) m.set(i, j, arr[i][j]);
    return m;
  }

  static identity(n) {
    const m = new Matrix(n, n);
    for (let i = 0; i < n; i++) m.set(i, i, 1);
    return m;
  }

  static zeros(rows, cols) { return new Matrix(rows, cols); }

  get(i, j) { return this.data[i * this.cols + j]; }
  set(i, j, val) { this.data[i * this.cols + j] = val; }

  clone() { return new Matrix(this.rows, this.cols, new Float64Array(this.data)); }

  add(other) {
    const m = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.data.length; i++) m.data[i] = this.data[i] + other.data[i];
    return m;
  }

  subtract(other) {
    const m = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.data.length; i++) m.data[i] = this.data[i] - other.data[i];
    return m;
  }

  scale(scalar) {
    const m = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.data.length; i++) m.data[i] = this.data[i] * scalar;
    return m;
  }

  multiply(other) {
    if (this.cols !== other.rows) throw new Error('Incompatible dimensions');
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
    if (n === 2) return this.get(0, 0) * this.get(1, 1) - this.get(0, 1) * this.get(1, 0);
    
    // LU decomposition approach
    const { L, U } = this.lu();
    let det = 1;
    for (let i = 0; i < n; i++) det *= U.get(i, i);
    return det;
  }

  lu() {
    const n = this.rows;
    const L = Matrix.identity(n);
    const U = this.clone();
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const factor = U.get(j, i) / U.get(i, i);
        L.set(j, i, factor);
        for (let k = i; k < n; k++) {
          U.set(j, k, U.get(j, k) - factor * U.get(i, k));
        }
      }
    }
    return { L, U };
  }

  inverse() {
    const n = this.rows;
    if (this.rows !== this.cols) throw new Error('Not square');
    
    // Augment with identity
    const aug = new Matrix(n, 2 * n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) aug.set(i, j, this.get(i, j));
      aug.set(i, n + i, 1);
    }
    
    // Gauss-Jordan
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let j = i + 1; j < n; j++) if (Math.abs(aug.get(j, i)) > Math.abs(aug.get(maxRow, i))) maxRow = j;
      if (maxRow !== i) for (let j = 0; j < 2 * n; j++) { const t = aug.get(i, j); aug.set(i, j, aug.get(maxRow, j)); aug.set(maxRow, j, t); }
      
      const pivot = aug.get(i, i);
      if (Math.abs(pivot) < 1e-12) throw new Error('Singular matrix');
      for (let j = 0; j < 2 * n; j++) aug.set(i, j, aug.get(i, j) / pivot);
      
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const factor = aug.get(j, i);
        for (let k = 0; k < 2 * n; k++) aug.set(j, k, aug.get(j, k) - factor * aug.get(i, k));
      }
    }
    
    const inv = new Matrix(n, n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) inv.set(i, j, aug.get(i, n + j));
    return inv;
  }

  solve(b) {
    // Solve Ax = b using LU
    const { L, U } = this.lu();
    const n = this.rows;
    
    // Forward substitution: Ly = b
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      y[i] = b[i];
      for (let j = 0; j < i; j++) y[i] -= L.get(i, j) * y[j];
    }
    
    // Back substitution: Ux = y
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = y[i];
      for (let j = i + 1; j < n; j++) x[i] -= U.get(i, j) * x[j];
      x[i] /= U.get(i, i);
    }
    
    return [...x];
  }

  trace() {
    let sum = 0;
    for (let i = 0; i < Math.min(this.rows, this.cols); i++) sum += this.get(i, i);
    return sum;
  }

  equals(other, eps = 1e-10) {
    if (this.rows !== other.rows || this.cols !== other.cols) return false;
    for (let i = 0; i < this.data.length; i++) if (Math.abs(this.data[i] - other.data[i]) > eps) return false;
    return true;
  }

  to2D() {
    const arr = [];
    for (let i = 0; i < this.rows; i++) {
      arr.push([]);
      for (let j = 0; j < this.cols; j++) arr[i].push(this.get(i, j));
    }
    return arr;
  }
}

// ===== Rotation matrices =====
export function rotation2D(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return Matrix.from2D([[c, -s], [s, c]]);
}

export function rotationX(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return Matrix.from2D([[1, 0, 0], [0, c, -s], [0, s, c]]);
}
