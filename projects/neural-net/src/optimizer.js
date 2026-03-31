// optimizer.js — Optimizer implementations (SGD, SGD+Momentum, Adam, RMSProp)

import { Matrix } from './matrix.js';

/**
 * SGD optimizer (vanilla stochastic gradient descent)
 */
export class SGD {
  constructor(lr = 0.01) {
    this.lr = lr;
    this.name = 'sgd';
  }

  init(layer) {} // No state needed

  update(param, grad) {
    return param.sub(grad.mul(this.lr));
  }
}

/**
 * SGD with momentum
 */
export class MomentumSGD {
  constructor(lr = 0.01, momentum = 0.9) {
    this.lr = lr;
    this.momentum = momentum;
    this.name = 'momentum';
    this._velocities = new Map();
  }

  init(layer) {}

  _getVelocity(key, grad) {
    if (!this._velocities.has(key)) {
      this._velocities.set(key, Matrix.zeros(grad.rows, grad.cols));
    }
    return this._velocities.get(key);
  }

  update(param, grad, key = '') {
    const v = this._getVelocity(key, grad);
    const newV = v.mul(this.momentum).add(grad.mul(this.lr));
    this._velocities.set(key, newV);
    return param.sub(newV);
  }
}

/**
 * Adam optimizer (Adaptive Moment Estimation)
 * Kingma & Ba, 2014
 */
export class Adam {
  constructor(lr = 0.001, beta1 = 0.9, beta2 = 0.999, epsilon = 1e-8) {
    this.lr = lr;
    this.beta1 = beta1;
    this.beta2 = beta2;
    this.epsilon = epsilon;
    this.name = 'adam';
    this.t = 0;
    this._m = new Map(); // First moment (mean)
    this._v = new Map(); // Second moment (variance)
  }

  init(layer) {}

  _getState(key, grad) {
    if (!this._m.has(key)) {
      this._m.set(key, Matrix.zeros(grad.rows, grad.cols));
      this._v.set(key, Matrix.zeros(grad.rows, grad.cols));
    }
    return { m: this._m.get(key), v: this._v.get(key) };
  }

  step() {
    this.t++;
  }

  update(param, grad, key = '') {
    const { m, v } = this._getState(key, grad);

    // Update biased first moment estimate
    const newM = m.mul(this.beta1).add(grad.mul(1 - this.beta1));
    // Update biased second raw moment estimate  
    const newV = v.mul(this.beta2).add(grad.mul(grad).mul(1 - this.beta2));
    
    this._m.set(key, newM);
    this._v.set(key, newV);

    // Compute bias-corrected first moment estimate
    const bc1 = 1 - Math.pow(this.beta1, this.t);
    const bc2 = 1 - Math.pow(this.beta2, this.t);
    const mHat = newM.mul(1.0 / bc1);
    const vHat = newV.mul(1.0 / bc2);

    // Update parameters
    const eps = this.epsilon;
    return param.sub(mHat.mul(this.lr).mul(vHat.map(x => 1.0 / (Math.sqrt(x) + eps))));
  }
}

/**
 * RMSProp optimizer
 * Hinton, 2012
 */
export class RMSProp {
  constructor(lr = 0.001, decay = 0.99, epsilon = 1e-8) {
    this.lr = lr;
    this.decay = decay;
    this.epsilon = epsilon;
    this.name = 'rmsprop';
    this._cache = new Map();
  }

  init(layer) {}

  _getCache(key, grad) {
    if (!this._cache.has(key)) {
      this._cache.set(key, Matrix.zeros(grad.rows, grad.cols));
    }
    return this._cache.get(key);
  }

  step() {}

  update(param, grad, key = '') {
    const cache = this._getCache(key, grad);
    const newCache = cache.mul(this.decay).add(grad.mul(grad).mul(1 - this.decay));
    this._cache.set(key, newCache);
    const eps = this.epsilon;
    return param.sub(grad.mul(this.lr).mul(newCache.map(x => 1.0 / (Math.sqrt(x) + eps))));
  }
}

/**
 * Create an optimizer by name
 */
export function createOptimizer(name, options = {}) {
  switch (name) {
    case 'sgd': return new SGD(options.lr || 0.01);
    case 'momentum': return new MomentumSGD(options.lr || 0.01, options.momentum || 0.9);
    case 'adam': return new Adam(options.lr || 0.001, options.beta1, options.beta2, options.epsilon);
    case 'rmsprop': return new RMSProp(options.lr || 0.001, options.decay, options.epsilon);
    default: throw new Error(`Unknown optimizer: ${name}`);
  }
}
