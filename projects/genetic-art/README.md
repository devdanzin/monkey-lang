# 🧬 genetic-art

A from-scratch genetic algorithm library in JavaScript, with a polygon art evolver that evolves images through evolution.

## Features

### Core GA Engine
- **Seedable PRNG** (xoshiro128**) for reproducible experiments
- **Individual** — binary, real-valued, or permutation-encoded genomes
- **Population** — configurable evolution with callbacks and history tracking

### Selection Operators
- Tournament selection
- Roulette wheel (fitness-proportionate)
- Rank-based selection
- Stochastic Universal Sampling (SUS)

### Crossover Operators
- Single-point, two-point, uniform crossover
- Blend crossover (BLX-α) for real-valued genes
- Order crossover (OX1) for permutations

### Mutation Operators
- Bit-flip (binary), Gaussian, uniform (real-valued)
- Swap, inversion, scramble (permutations)

### Fitness Functions
- **Benchmarks:** OneMax, Rastrigin, Schwefel, Sphere, Ackley, Rosenbrock
- **TSP:** Traveling Salesman with distance matrices

### Advanced Features
- Adaptive mutation rate (diversity-based)
- Island model with migration (ring/full topology)
- Speciated population with fitness sharing (NEAT-inspired)

### Polygon Art Evolver
- Encode semi-transparent polygons as gene arrays
- Software renderer with alpha compositing (no Canvas dependency for core)
- Pixel-level MSE fitness function
- HTML demo with real-time visualization

## Quick Start

```javascript
import { RNG, Individual, Population, oneMax } from './src/index.js';

const rng = new RNG(42);
const pop = new Population({
  size: 50,
  createIndividual: () => Individual.randomBinary(20, rng),
  fitness: oneMax,
  mutation: { rate: 0.05 },
  rng
});

const result = pop.run(100, (gen, stats) => {
  console.log(`Gen ${gen}: best=${stats.best} avg=${stats.avg.toFixed(1)}`);
});

console.log(`Best: ${result.bestEver}`);
```

## Tests

```bash
npm test  # 94 tests across core, fitness, advanced, and polygon art
```

## Demo

Open `examples/demo.html` in a browser to see polygon art evolution in real-time.

## Architecture

```
src/
  rng.js          — Seedable PRNG
  individual.js   — Genome representation
  selection.js    — Parent selection operators
  crossover.js    — Recombination operators
  mutation.js     — Variation operators
  population.js   — Evolution engine
  fitness.js      — Benchmark fitness functions
  advanced.js     — Island model, speciation, adaptive mutation
  polygon-art.js  — Polygon encoding, rendering, fitness
  index.js        — Public API
test/
  ga-core.test.js     — Core GA tests
  fitness.test.js     — Fitness function tests
  advanced.test.js    — Advanced feature tests
  polygon-art.test.js — Polygon art tests
examples/
  demo.html       — Interactive browser demo
```

## License

MIT
