# GAN Implementation Notes
uses: 1
created: 2026-03-31

## What I Learned

A minimal GAN is feasible with the existing neural-net library:
- Generator: Dense layers, noise → data
- Discriminator: Dense layers, data → real/fake probability
- Training: Manual alternating updates (can't use net.train() directly)

## Implementation Plan

1. Don't use the high-level `Network.train()` — need manual forward/backward/update
2. Generator: latentDim → hidden → outputDim (sigmoid to stay 0-1)
3. Discriminator: inputDim → hidden → 1 (sigmoid for probability)
4. Training loop:
   - Forward real data through D, compute loss (label=1)
   - Forward fake data through D, compute loss (label=0)
   - Update D weights
   - Forward noise through G, then through D (frozen), compute loss (label=1)
   - Backprop through both, update only G weights
5. The tricky part: backpropagating through D to get gradients for G

## Key Challenge

The current `backward()` returns gradient w.r.t. input — I need this to flow from D back into G. The architecture supports this:
- D.backward(dLoss) returns dInput
- That dInput becomes G's dOutput
- G.backward(dInput) computes weight gradients
- Only call G.update(), not D.update()

## Target

Simple 2D data distribution (e.g., circle or ring) — visualizable and fast to train.
