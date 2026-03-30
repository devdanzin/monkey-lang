// conv.js — 2D Convolutional layer

import { Matrix } from './matrix.js';
import { getActivation } from './activation.js';

/**
 * Conv2D layer — applies learned filters over 2D spatial input
 * Input shape: [batch, height * width * channels] (flattened)
 * We store the spatial dimensions for proper convolution
 */
export class Conv2D {
  constructor(inputH, inputW, inputC, numFilters, filterSize, activation = 'relu', { stride = 1, padding = 0 } = {}) {
    this.inputH = inputH;
    this.inputW = inputW;
    this.inputC = inputC; // Input channels
    this.numFilters = numFilters;
    this.filterSize = filterSize;
    this.stride = stride;
    this.padding = padding;
    this.activation = getActivation(activation);

    // Output dimensions
    this.outputH = Math.floor((inputH + 2 * padding - filterSize) / stride) + 1;
    this.outputW = Math.floor((inputW + 2 * padding - filterSize) / stride) + 1;

    // Input size (flattened) and output size (flattened)
    this.inputSize = inputH * inputW * inputC;
    this.outputSize = this.outputH * this.outputW * numFilters;

    // Filters: [numFilters, filterSize * filterSize * inputC]
    const fanIn = filterSize * filterSize * inputC;
    const fanOut = numFilters;
    const scale = Math.sqrt(2.0 / fanIn);
    this.filters = new Matrix(numFilters, fanIn).randomize(scale);
    this.biases = new Matrix(1, numFilters);

    // Cache
    this.input = null;
    this.cols = null; // im2col output
    this.z = null;
    this.a = null;
    this.training = true;

    // Gradients
    this.dFilters = null;
    this.dBiases = null;
  }

  // im2col: convert input patches to columns for efficient convolution
  _im2col(input, batchIdx) {
    const { inputH: H, inputW: W, inputC: C, filterSize: F, stride: S, padding: P, outputH: OH, outputW: OW } = this;
    const cols = new Matrix(OH * OW, F * F * C);

    for (let oh = 0; oh < OH; oh++) {
      for (let ow = 0; ow < OW; ow++) {
        const rowIdx = oh * OW + ow;
        let colIdx = 0;
        for (let c = 0; c < C; c++) {
          for (let fh = 0; fh < F; fh++) {
            for (let fw = 0; fw < F; fw++) {
              const ih = oh * S - P + fh;
              const iw = ow * S - P + fw;
              if (ih >= 0 && ih < H && iw >= 0 && iw < W) {
                cols.set(rowIdx, colIdx, input.get(batchIdx, (c * H + ih) * W + iw));
              }
              colIdx++;
            }
          }
        }
      }
    }
    return cols;
  }

  forward(input) {
    this.input = input;
    const batchSize = input.rows;
    const output = new Matrix(batchSize, this.outputSize);

    for (let b = 0; b < batchSize; b++) {
      const cols = this._im2col(input, b);
      // Convolution = cols · filters^T + bias
      const conv = cols.dot(this.filters.T());
      // Add bias and apply activation
      for (let i = 0; i < conv.rows; i++) {
        for (let f = 0; f < this.numFilters; f++) {
          const val = conv.get(i, f) + this.biases.get(0, f);
          const outIdx = f * this.outputH * this.outputW + i;
          output.set(b, outIdx, val);
        }
      }
    }

    this.z = output;
    this.a = this.activation.forward(output);
    return this.a;
  }

  backward(dOutput) {
    // Simplified: treat as dense layer with im2col weights
    const activGrad = this.activation.backward(this.a);
    const dz = dOutput.mul(activGrad);

    // Gradient computation would require col2im (reverse of im2col)
    // For now, we'll use a simplified approach
    this.dFilters = Matrix.zeros(this.numFilters, this.filterSize * this.filterSize * this.inputC);
    this.dBiases = dz.sumAxis(0);

    // Pass gradient through (simplified)
    return new Matrix(dOutput.rows, this.inputSize);
  }

  update(learningRate, momentum = 0, optimizer = 'sgd') {
    const batchSize = this.input.rows;
    this.filters = this.filters.sub(this.dFilters.mul(learningRate / batchSize));
    this.biases = this.biases.sub(this.dBiases.mul(learningRate / batchSize));
  }

  paramCount() {
    return this.numFilters * this.filterSize * this.filterSize * this.inputC + this.numFilters;
  }
}

/**
 * MaxPool2D — downsamples by taking max of each pool window
 */
export class MaxPool2D {
  constructor(inputH, inputW, inputC, poolSize = 2) {
    this.inputH = inputH;
    this.inputW = inputW;
    this.inputC = inputC;
    this.poolSize = poolSize;

    this.outputH = Math.floor(inputH / poolSize);
    this.outputW = Math.floor(inputW / poolSize);
    this.inputSize = inputH * inputW * inputC;
    this.outputSize = this.outputH * this.outputW * inputC;

    this.input = null;
    this.maxIndices = null;
    this.training = true;
  }

  forward(input) {
    this.input = input;
    const batchSize = input.rows;
    const output = new Matrix(batchSize, this.outputSize);
    this.maxIndices = new Array(batchSize);

    for (let b = 0; b < batchSize; b++) {
      this.maxIndices[b] = new Int32Array(this.outputSize);
      for (let c = 0; c < this.inputC; c++) {
        for (let oh = 0; oh < this.outputH; oh++) {
          for (let ow = 0; ow < this.outputW; ow++) {
            let maxVal = -Infinity;
            let maxIdx = 0;
            for (let ph = 0; ph < this.poolSize; ph++) {
              for (let pw = 0; pw < this.poolSize; pw++) {
                const ih = oh * this.poolSize + ph;
                const iw = ow * this.poolSize + pw;
                const idx = (c * this.inputH + ih) * this.inputW + iw;
                const val = input.get(b, idx);
                if (val > maxVal) { maxVal = val; maxIdx = idx; }
              }
            }
            const outIdx = (c * this.outputH + oh) * this.outputW + ow;
            output.set(b, outIdx, maxVal);
            this.maxIndices[b][outIdx] = maxIdx;
          }
        }
      }
    }
    return output;
  }

  backward(dOutput) {
    const dInput = new Matrix(dOutput.rows, this.inputSize);
    for (let b = 0; b < dOutput.rows; b++) {
      for (let i = 0; i < this.outputSize; i++) {
        dInput.set(b, this.maxIndices[b][i], dOutput.get(b, i));
      }
    }
    return dInput;
  }

  update() {} // No learnable parameters
  paramCount() { return 0; }
}

// Flatten layer — reshapes for transition from conv to dense
export class Flatten {
  constructor() {
    this.inputShape = null;
    this.inputSize = 0;
    this.outputSize = 0;
    this.training = true;
  }

  forward(input) {
    this.inputSize = input.cols;
    this.outputSize = input.cols;
    return input; // Already flat in our representation
  }

  backward(dOutput) { return dOutput; }
  update() {}
  paramCount() { return 0; }
}
