---
topic: information-geometry
uses: 1
created: 2026-04-02
last_used: 2026-04-02
---

# Information Geometry & Natural Gradient Descent

## Core Idea
Standard gradient descent treats parameter space as flat Euclidean. But neural networks define a manifold of probability distributions. The Fisher Information Matrix (FIM) is the Riemannian metric on this manifold — it measures how sensitive output distributions are to parameter changes.

**Natural Gradient**: ∇̃L = F⁻¹ · ∇L
- Where F is the Fisher Information Matrix
- This gives parameterization-invariant updates
- Equivalent to steepest descent in KL-divergence sense

## Fisher Information Matrix
- F_ij = E[∂log p(y|θ)/∂θ_i · ∂log p(y|θ)/∂θ_j]
- For neural nets: measures how output distribution changes with weights
- Empirical estimate: average over minibatch of outer products of gradients
- **Problem**: O(n²) for n parameters — impractical for large nets

## K-FAC Approximation (Kronecker-Factored Approximate Curvature)
- Block-diagonal approximation: one block per layer
- Each block factored as Kronecker product: F_l ≈ A_l ⊗ G_l
  - A_l: input activation covariance
  - G_l: output gradient covariance
- Inversion reduces from O(n³) to O(n_in³ + n_out³) per layer
- Practical for moderate-sized networks

## Why It Matters
- Faster convergence, especially in deep nets
- Avoids plateaus in loss landscape
- Invariant to reparameterization (changing activation functions, etc.)
- Connects gradient descent to information theory

## Potential Implementation in neural-net project
1. Compute empirical FIM per layer (accumulate A_l and G_l during forward/backward)
2. K-FAC: store running averages of A and G
3. Update rule: Δθ_l = (A_l⁻¹ ⊗ G_l⁻¹) · vec(∂L/∂W_l)
4. Damping: add λI to prevent singular matrices
5. Could implement as `NaturalGradient` optimizer

## Key Papers
- Amari (1998): Natural gradient works efficiently in learning
- Martens & Grosse (2015): Optimizing neural networks with Kronecker-factored approximate curvature
- Amari (2019): Information Geometry and Its Applications to Machine Learning (review at AISTATS)

## Connection to Other Methods
- Adam ≈ diagonal FIM approximation (per-parameter scaling)
- K-FAC ≈ block-diagonal FIM (per-layer)
- Full natural gradient = exact FIM (impractical for large nets)
- Mirror descent generalizes natural gradient to Bregman divergences
