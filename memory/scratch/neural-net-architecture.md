---
uses: 1
created: 2026-04-04
topics: neural-network, modular-architecture, backpropagation, gradient-normalization, barrel-exports
---

# Neural Net Architecture — Lessons from 435-Test Modular System

## Architecture Overview

Built a from-scratch neural network library in Node.js (ESM, zero deps) with:
- 35+ source files, 37 test files, 435 tests
- Core: Matrix (Float64Array), activations, layers (Dense, Conv2D, RNN/LSTM/GRU, Transformer, etc.)
- Training: optimizers (SGD, Adam, RMSProp, AdamW), schedulers, callbacks, gradient accumulation
- High-level: Autoencoder, VAE, GAN, MicroGPT, predictive coding, DQN

## Key Architecture Decision: Barrel File vs Monolith

**Problem:** Started as a monolithic index.js (~400 lines) with inline Matrix, activations, DenseLayer, NeuralNetwork. Then added 30+ modular files (matrix.js, layer.js, activation.js, etc.) with richer implementations. Tests imported from index.js but expected modular features.

**Solution:** Rewrote index.js as a barrel file:
- Re-exports everything from modular files
- Keeps backward-compatible DenseLayer for old tests  
- Unified NeuralNetwork class bridges both worlds

**Lesson:** When evolving from monolith to modular, make the original entry point a thin barrel early. Don't maintain two parallel implementations.

## Gradient Normalization: The Double-Division Bug

**Bug:** Loss backward was dividing by `predicted.data.length` (rows × cols), and Dense.update was also dividing by `batchSize`. Double normalization → gradients too small → XOR wouldn't converge.

**Fix:** Loss backward divides by `cols` only (per-sample normalization), Dense.update divides by `rows` (batch normalization). Together they produce the correct `1/(rows×cols)` scaling.

**Lesson:** When composing loss + layer update, be explicit about who normalizes what. Convention: loss returns per-sample gradient, layer handles batch averaging.

## Mini-Batch Shuffling Matters for Early Stopping

**Bug:** EarlyStopping tests failed because loss monotonically decreased without plateauing.

**Root cause:** Sequential (non-shuffled) mini-batching produces very stable loss curves. Adam on easy tasks can keep improving indefinitely with stable batches.

**Fix:** Added Fisher-Yates shuffle of training indices each epoch. The stochastic noise from different batch compositions causes the loss to fluctuate enough that EarlyStopping can detect plateaus.

**Lesson:** Always shuffle mini-batches. It's not just for better generalization — it's necessary for loss-based stopping criteria to work.

## Gradient Accumulation LR Scaling

**Bug:** Was dividing lr by total number of micro-batches instead of `accumSteps`.

**Key insight:** Gradient accumulation simulates a larger batch by accumulating gradients over N steps. The lr should be divided by `accumSteps` (the simulation factor), not by the total number of batches processed.

## Activation Function Dual Interface

**Problem:** Some tests call `sigmoid.forward(0.5)` (scalar), others call `sigmoid.forward(matrix)`.

**Solution:** Wrap matrix-level activations with a dual interface:
```javascript
function wrapActivation(act) {
  return {
    forward(x) {
      if (x instanceof Matrix) return act.forward(x);
      return act.forward(Matrix.fromArray([[x]])).get(0, 0);
    },
    backward(y) { /* same pattern */ }
  };
}
```

**Lesson:** When building a library, decide early whether primitives operate on scalars or tensors. If both are needed, make the tensor version canonical and wrap for scalar convenience.

## Test Architecture (435 tests)

Good patterns that emerged:
- **Isolated unit tests** per module (matrix.test.js, activation.test.js)
- **Integration tests** that combine modules (conv + dense, transformer pipeline)
- **Convergence tests** (XOR, MNIST-mini, sequence prediction)
- **Numerical gradient checking** for backprop correctness
- **Serialization roundtrip** tests
- **Callback integration** tests (early stopping, loss history)

The convergence tests are inherently probabilistic — use generous epoch counts and test for "loss decreased" rather than specific thresholds.
