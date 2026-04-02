# Evolutionary Computation & Genetic Algorithms
> uses: 1 | created: 2026-04-01 | last: 2026-04-01

## Key Concepts

### GA Core Loop
1. Initialize random population
2. Evaluate fitness
3. Select parents (tournament, roulette, rank, SUS)
4. Crossover (recombine parents → offspring)
5. Mutate offspring
6. Replace population
7. Repeat until convergence or budget exhausted

### Encoding Types
- **Binary**: bit strings (OneMax, combinatorial problems)
- **Real-valued**: floating point genes (continuous optimization)
- **Permutation**: ordered sequences (TSP, scheduling)
- **Tree/graph**: variable-structure (genetic programming, NEAT)

### Selection Pressure
- Tournament (k=3 good default) — simple, parallelizable
- Roulette — proportionate, can be dominated by super-fit individuals
- Rank — more uniform pressure, good for multimodal
- SUS — less stochastic variance than roulette

### Crossover Insights
- Single/two-point: good for positional encoding
- Uniform: better for non-positional problems
- Blend (BLX-α): α=0.3-0.5 for real-valued, creates values outside parent range
- Order crossover (OX1): essential for permutation problems — preserves relative order

### Mutation
- Binary: bit-flip, rate ~1/L (L = genome length)
- Real: Gaussian noise (sigma matters more than rate), uniform reset
- Permutation: swap (local), inversion (medium), scramble (disruptive)

### Advanced Features
- **Elitism**: always preserve top-k. Essential — without it, can lose best solution
- **Adaptive mutation**: increase when diversity drops (cv-based), decrease when diverse
- **Island model**: run sub-populations, migrate periodically. Ring topology = gradual mixing, full = fast mixing
- **Speciation**: group similar individuals, fitness sharing prevents any one niche from dominating. Key for multimodal optimization

## CMA-ES (Alternative to GA for continuous optimization)
- Samples from multivariate normal, adapts covariance matrix
- Self-adaptive — learns problem structure (curvature)
- Better than GA for ill-conditioned, non-separable continuous problems
- Quadratic cost in dimensions — doesn't scale to very high-D
- No parameter tuning needed (unlike GA)

## NEAT (NeuroEvolution of Augmenting Topologies)
- Evolves both neural network **topology** AND **weights**
- Innovation numbers track gene history → meaningful crossover
- Speciation protects new innovations from premature elimination
- Starts simple (no hidden nodes) → complexifies as needed
- TensorNEAT (2024): GPU acceleration via tensorization, 500x speedup

## Design Insights from genetic-art Project
- Seedable PRNG (xoshiro128**) is essential for reproducible experiments
- Software polygon renderer: scanline rasterization + alpha compositing works for small images
- Pixel MSE fitness: simple but effective for image approximation
- Blend crossover + Gaussian mutation work well for real-valued polygon optimization
- Population sizes 30-80 sufficient for most benchmark problems
- 100-300 generations enough for convergence on standard benchmarks
- -0 !== 0 in JavaScript strict equality — use Math.abs(x) < epsilon for zero-checks

## Open Questions / Future Exploration
- Implement CMA-ES from scratch (natural next step)
- Build NEAT: evolve network topology + weights
- Neuroevolution: evolve neural-net weights using GA (connect to neural-net project)
- Multi-objective optimization: NSGA-II (non-dominated sorting)
- Genetic programming: evolve programs/expressions as trees
- Differential evolution: another powerful real-valued optimizer
