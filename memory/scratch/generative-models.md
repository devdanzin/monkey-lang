---
topic: generative-models
uses: 1
created: 2026-04-02
last_used: 2026-04-02
---

# Generative Models in Neural-Net Library

## Implemented Models

### 1. Predictive Coding Network (predictive-coding.js)
- **Type**: Hierarchical, local learning
- **Key**: Top-down predictions, bottom-up errors
- **Learning**: Hebbian (local, no backprop)
- **Use case**: Unsupervised representation learning, anomaly detection
- **Strengths**: Biologically plausible, no global error signal
- **Weakness**: Slow convergence (iterative inference), smaller capacity

### 2. Restricted Boltzmann Machine (rbm.js)
- **Type**: Energy-based, undirected
- **Key**: Binary visible/hidden units, no intra-layer connections
- **Learning**: Contrastive Divergence (CD-k)
- **Use case**: Feature extraction, generative sampling, pretraining
- **Strengths**: Can be stacked (Deep Belief Networks), free energy is useful
- **Weakness**: Training is approximate (CD is biased), mode collapse risk

### 3. Variational Autoencoder (vae.js)
- **Type**: Latent variable, directed
- **Key**: Encoder→latent→decoder, reparameterization trick
- **Learning**: Backpropagation (reconstruction + KL divergence)
- **Use case**: Generation, interpolation, disentangled representations (β-VAE)
- **Strengths**: Clean latent space, smooth interpolation, principled loss
- **Weakness**: Blurry reconstructions (compared to GANs), mode covering

## Architecture Comparison

| Feature | PC Network | RBM | VAE |
|---------|-----------|-----|-----|
| Directed | Yes (generative) | No (undirected) | Yes (directed) |
| Backprop needed | No | No (CD) | Yes |
| Bio-plausible | Very | Somewhat | No |
| Smooth latent | No | No | Yes |
| Free energy | Prediction error | Explicit | ELBO |

## Connection to Information Geometry
- NaturalGradient optimizer uses Fisher Information Matrix (diagonal approx)
- KFAC uses Kronecker-factored Fisher (per-layer)
- Both connect the manifold of probability distributions to optimization
- VAE's KL divergence IS a natural gradient concept (information geometry)

## Test Coverage
- Predictive Coding: 28 tests (layer, network, integration)
- RBM: 13 tests (construction, training, free energy, features, generation)
- VAE: 11 tests (forward, training, generation, interpolation, β-VAE)
- Natural Gradient: 11 tests (diagonal Fisher, KFAC, matrix inversion)
- Optimizer comparison: 6 tests

## Potential Next Steps
- Deep Belief Network (stack RBMs)
- GAN improvements (existing basic GAN in gan.js)
- Normalizing flows
- Energy-based models with MCMC sampling
- Contrastive learning (SimCLR-like)
