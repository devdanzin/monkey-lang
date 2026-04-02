import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RNG, Individual, Population,
  oneMax, rastrigin, schwefel, sphere, ackley, rosenbrock,
  tspFitness, randomDistanceMatrix, euclideanDistanceMatrix,
  tournamentSelect, blendCrossover, gaussianMutation,
  orderCrossover, swapMutation, inversionMutation
} from '../src/index.js';

// ─── Unit tests for fitness functions ───────────────────────────────────

describe('Fitness functions', () => {
  describe('oneMax', () => {
    it('returns sum of binary genes', () => {
      assert.equal(oneMax([1, 1, 1, 0, 0]), 3);
      assert.equal(oneMax([0, 0, 0, 0]), 0);
      assert.equal(oneMax([1, 1, 1, 1]), 4);
    });
  });

  describe('rastrigin', () => {
    it('global optimum at origin is 0 (negated)', () => {
      assert.ok(Math.abs(rastrigin([0, 0, 0])) < 1e-10);
    });

    it('non-zero inputs give negative fitness', () => {
      assert.ok(rastrigin([1, 1]) < 0);
      assert.ok(rastrigin([0.5, -0.5]) < 0);
    });

    it('origin is better than other points', () => {
      assert.ok(rastrigin([0, 0]) > rastrigin([1, 1]));
      assert.ok(rastrigin([0, 0]) > rastrigin([3, -2]));
    });
  });

  describe('schwefel', () => {
    it('optimal near 420.9687 per dimension', () => {
      const opt = 420.9687;
      const atOpt = schwefel([opt, opt]);
      const atZero = schwefel([0, 0]);
      assert.ok(atOpt > atZero, 'Optimum should have higher fitness');
    });

    it('returns finite values', () => {
      assert.ok(isFinite(schwefel([100, -200, 300])));
    });
  });

  describe('sphere', () => {
    it('global optimum at origin = 0', () => {
      assert.ok(Math.abs(sphere([0, 0, 0])) < 1e-10);
    });

    it('farther from origin = lower fitness', () => {
      assert.ok(sphere([0, 0]) > sphere([1, 1]));
      assert.ok(sphere([1, 1]) > sphere([5, 5]));
    });
  });

  describe('ackley', () => {
    it('global optimum at origin ≈ 0', () => {
      const val = ackley([0, 0]);
      assert.ok(Math.abs(val) < 1e-10, `Expected ~0, got ${val}`);
    });

    it('non-zero inputs give negative fitness', () => {
      assert.ok(ackley([1, 1]) < 0);
    });
  });

  describe('rosenbrock', () => {
    it('global optimum at (1,1,...) = 0', () => {
      assert.ok(Math.abs(rosenbrock([1, 1, 1])) < 1e-10);
    });

    it('non-optimal points give negative fitness', () => {
      assert.ok(rosenbrock([0, 0]) < 0);
      assert.ok(rosenbrock([2, 4]) < 0);
    });
  });

  describe('TSP', () => {
    it('tspFitness computes correct tour length', () => {
      // 3 cities: triangle with sides 1, 1, 1
      const dist = [
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 0]
      ];
      const fitness = tspFitness(dist);
      assert.equal(fitness([0, 1, 2]), -3); // 1+1+1 = 3, negated
      assert.equal(fitness([2, 1, 0]), -3);
    });

    it('randomDistanceMatrix creates symmetric matrix', () => {
      const rng = new RNG(100);
      const m = randomDistanceMatrix(5, rng);
      assert.equal(m.length, 5);
      for (let i = 0; i < 5; i++) {
        assert.equal(m[i][i], 0);
        for (let j = 0; j < 5; j++) {
          assert.equal(m[i][j], m[j][i]);
        }
      }
    });

    it('euclideanDistanceMatrix computes correctly', () => {
      const cities = [[0, 0], [3, 4], [6, 0]];
      const m = euclideanDistanceMatrix(cities);
      assert.ok(Math.abs(m[0][1] - 5) < 1e-10); // 3-4-5 triangle
      assert.ok(Math.abs(m[0][2] - 6) < 1e-10);
      assert.ok(Math.abs(m[1][2] - 5) < 1e-10);
    });
  });
});

// ─── Integration: GA solving classic problems ───────────────────────────

describe('GA solving classic problems', () => {
  it('solves OneMax (20 bits)', () => {
    const rng = new RNG(200);
    const pop = new Population({
      size: 50,
      createIndividual: () => Individual.randomBinary(20, rng),
      fitness: oneMax,
      mutation: { rate: 0.05 },
      elitism: 2,
      rng
    });
    const result = pop.run(100);
    assert.ok(result.bestEver.fitness >= 18, `Got ${result.bestEver.fitness}`);
  });

  it('optimizes Sphere function', () => {
    const rng = new RNG(201);
    const pop = new Population({
      size: 80,
      createIndividual: () => Individual.randomReal(3, -5, 5, rng),
      fitness: sphere,
      crossover: {
        method: (p1, p2, rng) => blendCrossover(p1, p2, rng, 0.3),
        rate: 0.8
      },
      mutation: {
        method: (ind, rate, rng) => gaussianMutation(ind, rate, 0.5, rng, -5, 5),
        rate: 0.3
      },
      elitism: 2,
      rng
    });
    const result = pop.run(200);
    // Should be close to 0 (optimal)
    assert.ok(result.bestEver.fitness > -1, `Got ${result.bestEver.fitness}`);
  });

  it('optimizes Rastrigin (2D)', () => {
    const rng = new RNG(202);
    const pop = new Population({
      size: 100,
      createIndividual: () => Individual.randomReal(2, -5.12, 5.12, rng),
      fitness: rastrigin,
      crossover: {
        method: (p1, p2, rng) => blendCrossover(p1, p2, rng, 0.2),
        rate: 0.8
      },
      mutation: {
        method: (ind, rate, rng) => gaussianMutation(ind, rate, 0.3, rng, -5.12, 5.12),
        rate: 0.3
      },
      elitism: 3,
      rng
    });
    const result = pop.run(300);
    // Rastrigin is hard — just check we got reasonably close
    assert.ok(result.bestEver.fitness > -5, `Got ${result.bestEver.fitness}`);
  });

  it('solves small TSP (8 cities)', () => {
    const rng = new RNG(203);
    // Create 8 cities in a rough circle
    const cities = Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * 2 * Math.PI;
      return [50 + 40 * Math.cos(angle), 50 + 40 * Math.sin(angle)];
    });
    const dist = euclideanDistanceMatrix(cities);
    const fitness = tspFitness(dist);

    const pop = new Population({
      size: 60,
      createIndividual: () => Individual.randomPermutation(8, rng),
      fitness,
      selection: {
        method: (pop, rng) => tournamentSelect(pop, 5, rng)
      },
      crossover: {
        method: (p1, p2, rng) => orderCrossover(p1, p2, rng),
        rate: 0.9
      },
      mutation: {
        method: (ind, rate, rng) => {
          let m = inversionMutation(ind, rate, rng);
          m = swapMutation(m, rate, rng);
          return m;
        },
        rate: 0.3
      },
      elitism: 2,
      rng
    });
    const result = pop.run(200);

    // Optimal tour for a regular octagon inscribed in circle of radius 40:
    // each edge ≈ 30.6, total ≈ 245
    const tourLen = -result.bestEver.fitness;
    assert.ok(tourLen < 280, `Tour too long: ${tourLen}`);
  });

  it('Ackley function converges', () => {
    const rng = new RNG(204);
    const pop = new Population({
      size: 80,
      createIndividual: () => Individual.randomReal(2, -5, 5, rng),
      fitness: ackley,
      crossover: {
        method: (p1, p2, rng) => blendCrossover(p1, p2, rng, 0.3),
        rate: 0.8
      },
      mutation: {
        method: (ind, rate, rng) => gaussianMutation(ind, rate, 0.3, rng, -5, 5),
        rate: 0.3
      },
      elitism: 2,
      rng
    });
    const result = pop.run(200);
    // Ackley at origin = 0, should get close
    assert.ok(result.bestEver.fitness > -2, `Got ${result.bestEver.fitness}`);
  });
});
