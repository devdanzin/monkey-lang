---
topic: predictive-coding
uses: 1
created: 2026-04-02
last_used: 2026-04-02
---

# Predictive Coding & Free Energy Principle

## Core Concept
The brain is a prediction machine. Higher layers generate top-down predictions of lower layers. Discrepancies (prediction errors) propagate upward to update the model. Learning = minimizing prediction error = minimizing variational free energy.

## Architecture
```
Layer 3: Abstract concepts (e.g., "face")
  ↓ predictions    ↑ prediction errors
Layer 2: Mid-level features (e.g., "eye", "nose")
  ↓ predictions    ↑ prediction errors  
Layer 1: Low-level features (edges, colors)
  ↓ predictions    ↑ prediction errors
Sensory input
```

Each layer has:
- **Value nodes**: current representation μ_l
- **Error nodes**: prediction error ε_l = μ_l - f(μ_{l+1})
- Where f() is the generative model (top-down)

## Update Rules (local, biologically plausible!)
- **Value update**: dμ_l/dt = ε_l - (∂f/∂μ_l)^T · ε_{l-1}
  - Balance between own prediction error and downstream errors
- **Weight update**: dW_l/dt = ε_{l-1} · μ_l^T (Hebbian-like!)
  - Weights learn to predict lower-layer activity

## Free Energy Principle (Friston)
- Variational Free Energy F ≥ -log p(y) (surprise)
- Minimizing F ≈ minimizing prediction error + model complexity
- Equivalent to variational inference (approximate posterior)
- F = E_q[log q(z) - log p(y,z)] (ELBO formulation)

## Why This Is Interesting
1. **Biologically plausible**: Local learning rules, no backprop needed
2. **Unifying framework**: Perception, learning, attention all as free energy minimization
3. **Active inference**: Actions chosen to minimize expected free energy (exploration + exploitation)
4. **Consciousness connection**: Predictive processing may explain phenomenal experience

## Implementation Idea for neural-net project
Build a `PredictiveCodingNetwork`:
1. Hierarchical layers with value and error nodes
2. Forward pass: top-down predictions + bottom-up errors
3. Iterative inference: settle to equilibrium (like energy-based models)
4. Learning: update weights based on converged error signals
5. Test on: digit recognition, sequence prediction, anomaly detection

## Key Differences from Backpropagation
| Aspect | Backprop | Predictive Coding |
|--------|---------|-------------------|
| Error signal | Global, end-to-end | Local, per-layer |
| Biological plausibility | Low (weight transport problem) | High |
| Learning rule | Chain rule (non-local) | Hebbian (local) |
| Computation | 2 passes (forward + backward) | Iterative convergence |
| Credit assignment | Top-down error propagation | Bottom-up error signals |

## References
- Rao & Ballard (1999): Predictive coding in visual cortex
- Friston (2005): A theory of cortical responses
- Whittington & Bogacz (2017): Approximation of backprop through predictive coding
- Millidge, Tschantz & Buckley (2021): Predictive coding approximates backprop along arbitrary computation graphs
