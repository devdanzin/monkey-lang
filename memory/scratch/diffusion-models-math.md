# Diffusion Models Math
uses: 1
created: 2026-04-01
updated: 2026-04-01

## Core Concept
Two-phase generative model: forward (add noise) → reverse (denoise to generate).

## Forward Process
Gradually add Gaussian noise to data over T timesteps:
- q(x_t | x_{t-1}) = N(x_t; √(1-β_t)·x_{t-1}, β_t·I)
- β_t = noise schedule (variance at step t)
- After many steps, x_T ≈ N(0, I) — pure noise

Closed-form marginal: q(x_t | x_0) = N(x_t; √(ᾱ_t)·x_0, (1-ᾱ_t)·I)
- Where ᾱ_t = ∏_{s=1}^{t} (1-β_s) = cumulative signal retention

## Reverse Process (Learned)
p_θ(x_{t-1} | x_t) = N(x_{t-1}; μ_θ(x_t, t), σ_t²·I)
- Neural network predicts μ_θ (or equivalently, the noise ε_θ)
- Training objective: minimize ||ε - ε_θ(x_t, t)||²
- This is equivalent to denoising score matching

## Score Function
∇_x log p(x) — gradient of log probability density.
- Points "uphill" toward higher-probability regions
- Network approximates s_θ(x, t) ≈ ∇_x log p_t(x)
- Score matching: train by minimizing E[||s_θ(x_t, t) - ∇_x log q(x_t|x_0)||²]
- Since ∇_x log q(x_t|x_0) = -(x_t - √ᾱ_t·x_0)/((1-ᾱ_t)) = -ε/√(1-ᾱ_t)
  → Predicting ε is equivalent to predicting the score

## SDE Formulation (Continuous Time)
Forward SDE: dx = f(x,t)dt + g(t)dw
- f = drift coefficient, g = diffusion coefficient, w = Brownian motion
- VP-SDE: f(x,t) = -½β(t)x, g(t) = √β(t)
- VE-SDE: f(x,t) = 0, g(t) = √(dσ²(t)/dt)

Reverse SDE: dx = [f(x,t) - g²(t)∇_x log p_t(x)]dt + g(t)dw̄
- w̄ = reverse Brownian motion
- The score function ∇_x log p_t(x) is the key learned quantity

## Probability Flow ODE (deterministic)
dx = [f(x,t) - ½g²(t)∇_x log p_t(x)]dt
- Same marginals as the SDE but deterministic — enables exact likelihood computation
- Basis for DDIM-style fast sampling

## Key Insight for Implementation
1. Sample x_0 from data
2. Sample t ~ Uniform(0, T), ε ~ N(0, I)
3. Compute x_t = √ᾱ_t·x_0 + √(1-ᾱ_t)·ε
4. Train: minimize ||ε - ε_θ(x_t, t)||²
5. To generate: start from x_T ~ N(0,I), iteratively denoise

## Connection to Neural Net Library
Could implement:
- Simple 1D/2D diffusion model using existing Dense layers
- Noise schedule (linear, cosine)
- DDPM sampling loop
- Score function estimation via MLP
