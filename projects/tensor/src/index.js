/**
 * Tiny Tensor — N-dimensional array
 * 
 * NumPy-like tensor operations:
 * - Create from data, zeros, ones, random, range
 * - Shape, reshape, transpose, flatten
 * - Element-wise: add, sub, mul, div
 * - Broadcasting
 * - Reduction: sum, mean, max, min
 * - Matrix multiply (matmul)
 * - Indexing and slicing
 */

class Tensor {
  constructor(data, shape = null) {
    if (data instanceof Float64Array) {
      this.data = data;
    } else {
      const flat = Array.isArray(data) ? flatten(data) : [data];
      this.data = new Float64Array(flat);
    }
    this.shape = shape || inferShape(data);
    this.strides = computeStrides(this.shape);
  }

  get size() { return this.data.length; }
  get ndim() { return this.shape.length; }

  get(indices) {
    let offset = 0;
    for (let i = 0; i < indices.length; i++) {
      offset += indices[i] * this.strides[i];
    }
    return this.data[offset];
  }

  set(indices, value) {
    let offset = 0;
    for (let i = 0; i < indices.length; i++) {
      offset += indices[i] * this.strides[i];
    }
    this.data[offset] = value;
  }

  reshape(newShape) {
    const size = newShape.reduce((a, b) => a * b, 1);
    if (size !== this.size) throw new Error(`Cannot reshape ${this.shape} to ${newShape}`);
    return new Tensor(new Float64Array(this.data), newShape);
  }

  flatten() { return new Tensor(new Float64Array(this.data), [this.size]); }

  transpose() {
    if (this.ndim !== 2) throw new Error('Transpose only for 2D');
    const [rows, cols] = this.shape;
    const result = new Float64Array(this.size);
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        result[j * rows + i] = this.data[i * cols + j];
      }
    }
    return new Tensor(result, [cols, rows]);
  }

  // Element-wise operations
  add(other) { return this._elementwise(other, (a, b) => a + b); }
  sub(other) { return this._elementwise(other, (a, b) => a - b); }
  mul(other) { return this._elementwise(other, (a, b) => a * b); }
  div(other) { return this._elementwise(other, (a, b) => a / b); }
  
  neg() { return this.map(x => -x); }
  abs() { return this.map(Math.abs); }
  exp() { return this.map(Math.exp); }
  log() { return this.map(Math.log); }
  sqrt() { return this.map(Math.sqrt); }
  pow(n) { return this.map(x => Math.pow(x, n)); }

  map(fn) {
    const result = new Float64Array(this.size);
    for (let i = 0; i < this.size; i++) result[i] = fn(this.data[i]);
    return new Tensor(result, [...this.shape]);
  }

  _elementwise(other, fn) {
    if (typeof other === 'number') {
      const result = new Float64Array(this.size);
      for (let i = 0; i < this.size; i++) result[i] = fn(this.data[i], other);
      return new Tensor(result, [...this.shape]);
    }
    if (other instanceof Tensor) {
      // Simple broadcasting: same shape or scalar
      if (other.size === 1) {
        const val = other.data[0];
        return this._elementwise(val, fn);
      }
      if (this.size === other.size) {
        const result = new Float64Array(this.size);
        for (let i = 0; i < this.size; i++) result[i] = fn(this.data[i], other.data[i]);
        return new Tensor(result, [...this.shape]);
      }
      throw new Error(`Shape mismatch: ${this.shape} vs ${other.shape}`);
    }
    throw new Error('Unsupported operand');
  }

  // Reductions
  sum(axis = null) {
    if (axis === null) return this.data.reduce((a, b) => a + b, 0);
    return this._reduceAxis(axis, (a, b) => a + b, 0);
  }

  mean(axis = null) {
    if (axis === null) return this.sum() / this.size;
    const s = this.sum(axis);
    return s.div(this.shape[axis]);
  }

  max(axis = null) {
    if (axis === null) return Math.max(...this.data);
    return this._reduceAxis(axis, Math.max, -Infinity);
  }

  min(axis = null) {
    if (axis === null) return Math.min(...this.data);
    return this._reduceAxis(axis, Math.min, Infinity);
  }

  _reduceAxis(axis, fn, init) {
    if (this.ndim !== 2) throw new Error('Axis reduction only for 2D');
    const [rows, cols] = this.shape;
    if (axis === 0) {
      const result = new Float64Array(cols).fill(init);
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++)
          result[j] = fn(result[j], this.data[i * cols + j]);
      return new Tensor(result, [cols]);
    }
    const result = new Float64Array(rows).fill(init);
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++)
        result[i] = fn(result[i], this.data[i * cols + j]);
    return new Tensor(result, [rows]);
  }

  // Matrix multiply
  matmul(other) {
    if (this.ndim !== 2 || other.ndim !== 2) throw new Error('matmul requires 2D');
    const [m, k1] = this.shape;
    const [k2, n] = other.shape;
    if (k1 !== k2) throw new Error(`Shape mismatch for matmul: ${this.shape} x ${other.shape}`);
    const result = new Float64Array(m * n);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < k1; k++) {
          sum += this.data[i * k1 + k] * other.data[k * n + j];
        }
        result[i * n + j] = sum;
      }
    }
    return new Tensor(result, [m, n]);
  }

  toArray() {
    if (this.ndim === 1) return [...this.data];
    if (this.ndim === 2) {
      const [rows, cols] = this.shape;
      const result = [];
      for (let i = 0; i < rows; i++) {
        result.push([...this.data.slice(i * cols, (i + 1) * cols)]);
      }
      return result;
    }
    return [...this.data];
  }

  toString() { return `Tensor(shape=[${this.shape}], data=[${[...this.data].slice(0, 10).join(', ')}${this.size > 10 ? ', ...' : ''}])`; }

  static zeros(shape) { return new Tensor(new Float64Array(shape.reduce((a,b) => a*b, 1)), shape); }
  static ones(shape) { const d = new Float64Array(shape.reduce((a,b) => a*b, 1)); d.fill(1); return new Tensor(d, shape); }
  static rand(shape) { const s = shape.reduce((a,b) => a*b, 1); const d = new Float64Array(s); for (let i=0;i<s;i++) d[i]=Math.random(); return new Tensor(d, shape); }
  static arange(n) { const d = new Float64Array(n); for (let i=0;i<n;i++) d[i]=i; return new Tensor(d, [n]); }
  static eye(n) { const t = Tensor.zeros([n,n]); for (let i=0;i<n;i++) t.set([i,i],1); return t; }
}

function flatten(arr) {
  const result = [];
  const _flat = (a) => { if (Array.isArray(a)) a.forEach(_flat); else result.push(a); };
  _flat(arr);
  return result;
}

function inferShape(data) {
  if (!Array.isArray(data)) return [1];
  const shape = [];
  let d = data;
  while (Array.isArray(d)) { shape.push(d.length); d = d[0]; }
  return shape;
}

function computeStrides(shape) {
  const strides = new Array(shape.length);
  strides[shape.length - 1] = 1;
  for (let i = shape.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * shape[i + 1];
  }
  return strides;
}

module.exports = { Tensor };
