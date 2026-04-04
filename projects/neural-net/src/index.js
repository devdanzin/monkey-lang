// ===== Neural Network from Scratch =====
// Dense feedforward network with backpropagation

// ===== Matrix operations =====

export class Matrix {
  constructor(rows, cols, data = null) {
    this.rows = rows;
    this.cols = cols;
    this.data = data || new Float64Array(rows * cols);
  }

  get(r, c) { return this.data[r * this.cols + c]; }
  set(r, c, v) { this.data[r * this.cols + c] = v; }

  static zeros(rows, cols) { return new Matrix(rows, cols); }
  
  static random(rows, cols, scale = 1) {
    const m = new Matrix(rows, cols);
    for (let i = 0; i < m.data.length; i++) {
      m.data[i] = (Math.random() * 2 - 1) * scale;
    }
    return m;
  }

  // Xavier/Glorot initialization
  static xavier(rows, cols) {
    const scale = Math.sqrt(2 / (rows + cols));
    return Matrix.random(rows, cols, scale);
  }

  // He initialization
  static he(rows, cols) {
    const scale = Math.sqrt(2 / rows);
    return Matrix.random(rows, cols, scale);
  }

  add(other) {
    const result = new Matrix(this.rows, this.cols);
    if (other instanceof Matrix) {
      if (other.rows === 1 && other.cols === this.cols) {
        // Broadcasting: add row vector to each row
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            result.set(r, c, this.get(r, c) + other.get(0, c));
          }
        }
      } else {
        for (let i = 0; i < this.data.length; i++) result.data[i] = this.data[i] + other.data[i];
      }
    } else {
      for (let i = 0; i < this.data.length; i++) result.data[i] = this.data[i] + other;
    }
    return result;
  }

  sub(other) {
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.data.length; i++) result.data[i] = this.data[i] - other.data[i];
    return result;
  }

  mul(other) {
    // Element-wise (Hadamard)
    if (other instanceof Matrix) {
      const result = new Matrix(this.rows, this.cols);
      for (let i = 0; i < this.data.length; i++) result.data[i] = this.data[i] * other.data[i];
      return result;
    }
    // Scalar
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.data.length; i++) result.data[i] = this.data[i] * other;
    return result;
  }

  dot(other) {
    // Matrix multiplication
    const result = new Matrix(this.rows, other.cols);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < other.cols; c++) {
        let sum = 0;
        for (let k = 0; k < this.cols; k++) {
          sum += this.get(r, k) * other.get(k, c);
        }
        result.set(r, c, sum);
      }
    }
    return result;
  }

  transpose() {
    const result = new Matrix(this.cols, this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        result.set(c, r, this.get(r, c));
      }
    }
    return result;
  }

  map(fn) {
    const result = new Matrix(this.rows, this.cols);
    for (let i = 0; i < this.data.length; i++) result.data[i] = fn(this.data[i]);
    return result;
  }

  // Sum columns → 1×cols vector
  sumRows() {
    const result = new Matrix(1, this.cols);
    for (let c = 0; c < this.cols; c++) {
      let sum = 0;
      for (let r = 0; r < this.rows; r++) sum += this.get(r, c);
      result.set(0, c, sum);
    }
    return result;
  }

  static fromArray(arr) {
    // arr is [[...], [...]] or [a, b, c] (column vector)
    if (Array.isArray(arr[0])) {
      const rows = arr.length, cols = arr[0].length;
      const m = new Matrix(rows, cols);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          m.set(r, c, arr[r][c]);
      return m;
    }
    const m = new Matrix(arr.length, 1);
    for (let i = 0; i < arr.length; i++) m.set(i, 0, arr[i]);
    return m;
  }

  toArray() {
    if (this.cols === 1) return [...this.data];
    const result = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) row.push(this.get(r, c));
      result.push(row);
    }
    return result;
  }

  clone() {
    return new Matrix(this.rows, this.cols, new Float64Array(this.data));
  }
}

// ===== Activation functions =====

export const activations = {
  sigmoid: {
    forward: x => 1 / (1 + Math.exp(-x)),
    backward: y => y * (1 - y), // derivative in terms of output
  },
  relu: {
    forward: x => Math.max(0, x),
    backward: y => y > 0 ? 1 : 0,
  },
  tanh: {
    forward: x => Math.tanh(x),
    backward: y => 1 - y * y,
  },
  linear: {
    forward: x => x,
    backward: () => 1,
  },
};

// ===== Loss functions =====

export const losses = {
  mse: {
    forward: (predicted, target) => {
      let sum = 0;
      for (let i = 0; i < predicted.data.length; i++) {
        const d = predicted.data[i] - target.data[i];
        sum += d * d;
      }
      return sum / predicted.data.length;
    },
    backward: (predicted, target) => {
      return predicted.sub(target).mul(2 / predicted.data.length);
    },
  },
  crossEntropy: {
    forward: (predicted, target) => {
      let sum = 0;
      const eps = 1e-15;
      for (let i = 0; i < predicted.data.length; i++) {
        const p = Math.max(eps, Math.min(1 - eps, predicted.data[i]));
        const t = target.data[i];
        sum -= t * Math.log(p) + (1 - t) * Math.log(1 - p);
      }
      return sum / predicted.rows;
    },
    backward: (predicted, target) => {
      const eps = 1e-15;
      const result = new Matrix(predicted.rows, predicted.cols);
      for (let i = 0; i < predicted.data.length; i++) {
        const p = Math.max(eps, Math.min(1 - eps, predicted.data[i]));
        const t = target.data[i];
        result.data[i] = (-t / p + (1 - t) / (1 - p)) / predicted.rows;
      }
      return result;
    },
  },
};

// ===== Dense Layer =====

export class DenseLayer {
  constructor(inputSize, outputSize, activation = 'sigmoid') {
    this.weights = Matrix.xavier(inputSize, outputSize);
    this.bias = Matrix.zeros(1, outputSize);
    this.activation = activations[activation];
    this.activationName = activation;
    
    // Cache for backprop
    this.input = null;
    this.z = null;     // pre-activation
    this.output = null; // post-activation
  }

  forward(input) {
    this.input = input;
    this.z = input.dot(this.weights).add(this.bias);
    this.output = this.z.map(this.activation.forward);
    return this.output;
  }

  backward(gradOutput, learningRate) {
    // gradOutput is ∂L/∂output
    // ∂L/∂z = ∂L/∂output * activation'(z)
    const gradZ = gradOutput.mul(this.output.map(this.activation.backward));
    
    // ∂L/∂weights = input^T · gradZ
    const gradWeights = this.input.transpose().dot(gradZ);
    
    // ∂L/∂bias = sum of gradZ rows
    const gradBias = gradZ.sumRows();
    
    // ∂L/∂input = gradZ · weights^T
    const gradInput = gradZ.dot(this.weights.transpose());
    
    // Update weights
    this.weights = this.weights.sub(gradWeights.mul(learningRate));
    this.bias = this.bias.sub(gradBias.mul(learningRate));
    
    return gradInput;
  }
}

// ===== Network =====

export class NeuralNetwork {
  constructor(layers = []) {
    this.layers = layers;
    this._lossObj = losses.mse;
    // Make loss callable as setter: net.loss('mse')
    // But also accessible as property: net._lossObj
    this.loss = (name) => {
      if (typeof name === 'string') this._lossObj = losses[name];
      else this._lossObj = name;
      return this;
    };
  }

  addLayer(inputSize, outputSize, activation = 'sigmoid') {
    this.layers.push(new DenseLayer(inputSize, outputSize, activation));
  }

  // Alias for addLayer
  dense(inputSize, outputSize, activation = 'sigmoid') {
    return this.addLayer(inputSize, outputSize, activation);
  }

  setLoss(lossName) {
    this._lossObj = losses[lossName];
  }

  forward(input) {
    let output = input;
    for (const layer of this.layers) {
      output = layer.forward(output);
    }
    return output;
  }

  backward(predicted, target, learningRate) {
    let grad = this._lossObj.backward(predicted, target);
    for (let i = this.layers.length - 1; i >= 0; i--) {
      grad = this.layers[i].backward(grad, learningRate);
    }
  }

  train(inputs, targets, { epochs = 1000, learningRate = 0.1, verbose = false } = {}) {
    const inputMatrix = inputs instanceof Matrix ? inputs : Matrix.fromArray(inputs);
    const targetMatrix = targets instanceof Matrix ? targets : Matrix.fromArray(targets);
    
    const history = [];
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      const output = this.forward(inputMatrix);
      const loss = this._lossObj.forward(output, targetMatrix);
      
      this.backward(output, targetMatrix, learningRate);
      
      if (verbose && epoch % (epochs / 10) === 0) {
        console.log(`Epoch ${epoch}: loss = ${loss.toFixed(6)}`);
      }
      history.push(loss);
    }
    
    return history;
  }

  predict(input) {
    const inputMatrix = input instanceof Matrix ? input : Matrix.fromArray(input);
    return this.forward(inputMatrix);
  }

  toJSON() {
    return {
      layers: this.layers.map(l => ({
        weights: Array.from(l.weights.data),
        biases: Array.from(l.bias.data),
        rows: l.weights.rows,
        cols: l.weights.cols,
        biasRows: l.bias.rows,
        biasCols: l.bias.cols,
        activation: l.activationName || 'sigmoid',
      }))
    };
  }

  static fromJSON(json) {
    const net = new NeuralNetwork();
    for (const ld of json.layers) {
      const layer = new DenseLayer(ld.rows, ld.cols, ld.activation);
      layer.weights.data = Float64Array.from(ld.weights);
      layer.bias.data = Float64Array.from(ld.biases);
      net.layers.push(layer);
    }
    return net;
  }
}

// ===== Convenience builder =====

export function createNetwork(layerSizes, activationFn = 'sigmoid') {
  const net = new NeuralNetwork();
  for (let i = 0; i < layerSizes.length - 1; i++) {
    const act = i === layerSizes.length - 2 ? 'sigmoid' : activationFn;
    net.addLayer(layerSizes[i], layerSizes[i + 1], act);
  }
  return net;
}

// Alias for backward compatibility
export const Network = NeuralNetwork;


// Individual function exports for convenience
export const sigmoid = activations.sigmoid;
export const relu = activations.relu;
export const tanh = activations.tanh;
export const softmax = activations.softmax;
export const mse = losses.mse;
export const crossEntropy = losses.crossEntropy;

// Add compute alias to loss functions
for (const key of Object.keys(losses)) {
  if (losses[key].forward) losses[key].compute = losses[key].forward;
}

// Add gradient alias to loss functions
for (const key of Object.keys(losses)) {
  if (losses[key].backward) losses[key].gradient = losses[key].backward;
}

// Add get/set methods to Matrix
Matrix.prototype.get = function(row, col) { return this.data[row * this.cols + col]; };
Matrix.prototype.set = function(row, col, val) { this.data[row * this.cols + col] = val; };
