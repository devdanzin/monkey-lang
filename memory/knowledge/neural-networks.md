# Neural Networks

Learned from: building a neural network library from scratch in JS (108 tests)

## Key Concepts

- **Backpropagation is just the chain rule applied recursively.** Each layer stores its input during forward pass, then uses it during backward pass to compute gradients. The gradient flows backward through the computational graph.
- **RNN/LSTM:** RNNs suffer from vanishing gradients over long sequences because the same weight matrix is multiplied repeatedly. LSTM solves this with gating: forget gate (what to discard), input gate (what to add), output gate (what to expose). The cell state acts as a gradient highway.
- **GANs (Generative Adversarial Networks):** Two networks trained in opposition — generator tries to fool discriminator, discriminator tries to detect fakes. Training is notoriously unstable; the two networks need to improve at roughly the same pace.
- **Batch Normalization:** Normalize activations within each mini-batch to zero mean, unit variance. Then apply learned scale (gamma) and shift (beta). Reduces internal covariate shift, allows higher learning rates, acts as mild regularization.
- **Dropout:** Randomly zero out neurons during training (each with probability p). Forces network to learn redundant representations. At inference, scale outputs by (1-p) or use inverted dropout during training.

## Patterns

- **Optimizer hierarchy:** SGD → SGD+Momentum → RMSProp → Adam. Adam combines momentum (first moment) with RMSProp (second moment). It's the default choice for most tasks, but SGD+momentum can generalize better with proper tuning.
- **Weight initialization matters enormously:**
  - Xavier/Glorot: `std = sqrt(2 / (fan_in + fan_out))` — good for tanh/sigmoid
  - He/Kaiming: `std = sqrt(2 / fan_in)` — good for ReLU
  - Wrong init = dead neurons or exploding gradients from epoch 1
- **Gradient clipping:** Cap gradient norm to prevent explosion, especially in RNNs. Two flavors: clip by value (simple but distorts direction) and clip by norm (preserves direction, preferred).
- **Learning rate schedulers:** Step decay, exponential decay, cosine annealing, warmup+decay, cyclical LR, reduce-on-plateau, one-cycle. Cosine annealing is a good default; warmup helps with large batch sizes.
- **Model serialization:** Save weights + architecture config as JSON. Need to handle typed arrays, nested structures, optimizer state (for resuming training).

## Pitfalls

- **GAN mode collapse:** Generator finds one output that fools the discriminator and stops exploring. Mitigations: minibatch discrimination, feature matching, Wasserstein loss.
- **Dying ReLU:** Neurons with large negative bias never activate and never get gradient updates. Use Leaky ReLU or careful initialization.
- **Batch norm at inference:** Must use running statistics (tracked during training), not batch statistics. Getting this wrong causes train/test discrepancy.
- **Learning rate too high:** Loss oscillates or diverges. Too low: converges painfully slowly or gets stuck. The LR is the most important hyperparameter.
- **Numerical stability in softmax/cross-entropy:** Subtract max value before exp() to prevent overflow. Compute log-softmax directly instead of log(softmax(x)) to avoid log(0).

## Open Questions

- Transformers / self-attention — the architecture that ate the world. Would be the natural next step.
- Neural architecture search — can a network design itself?
- Quantization-aware training for deployment on constrained devices
