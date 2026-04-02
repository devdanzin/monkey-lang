import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RNG, Individual, Population,
  tournamentSelect, rouletteSelect, rankSelect, susSelect,
  singlePointCrossover, twoPointCrossover, uniformCrossover,
  blendCrossover, orderCrossover,
  bitFlipMutation, gaussianMutation, uniformMutation,
  swapMutation, inversionMutation, scrambleMutation
} from '../src/index.js';

// ─── RNG ────────────────────────────────────────────────────────────────

describe('RNG', () => {
  it('produces deterministic sequences with same seed', () => {
    const a = new RNG(42);
    const b = new RNG(42);
    for (let i = 0; i < 100; i++) {
      assert.equal(a.random(), b.random());
    }
  });

  it('random() returns values in [0, 1)', () => {
    const rng = new RNG(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.random();
      assert.ok(v >= 0 && v < 1, `Got ${v}`);
    }
  });

  it('randInt returns values in [min, max]', () => {
    const rng = new RNG(2);
    for (let i = 0; i < 200; i++) {
      const v = rng.randInt(3, 7);
      assert.ok(v >= 3 && v <= 7, `Got ${v}`);
    }
  });

  it('randFloat returns values in [min, max)', () => {
    const rng = new RNG(3);
    for (let i = 0; i < 200; i++) {
      const v = rng.randFloat(-1, 1);
      assert.ok(v >= -1 && v < 1, `Got ${v}`);
    }
  });

  it('chance(0) is always false, chance(1) always true', () => {
    const rng = new RNG(4);
    for (let i = 0; i < 100; i++) {
      assert.equal(rng.chance(0), false);
      assert.equal(rng.chance(1), true);
    }
  });

  it('pick returns elements from array', () => {
    const rng = new RNG(5);
    const arr = [10, 20, 30];
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
      seen.add(rng.pick(arr));
    }
    assert.ok(seen.has(10) && seen.has(20) && seen.has(30));
  });

  it('shuffle produces a permutation', () => {
    const rng = new RNG(6);
    const arr = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle([...arr]);
    assert.equal(shuffled.length, arr.length);
    assert.deepEqual([...shuffled].sort(), arr);
  });

  it('gaussian produces values centered around 0', () => {
    const rng = new RNG(7);
    let sum = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) sum += rng.gaussian();
    const mean = sum / n;
    assert.ok(Math.abs(mean) < 0.1, `Mean ${mean} too far from 0`);
  });
});

// ─── Individual ─────────────────────────────────────────────────────────

describe('Individual', () => {
  it('stores genes and fitness', () => {
    const ind = new Individual([1, 0, 1], 3);
    assert.deepEqual(ind.genes, [1, 0, 1]);
    assert.equal(ind.fitness, 3);
    assert.equal(ind.length, 3);
  });

  it('clone creates an independent copy', () => {
    const ind = new Individual([1, 2, 3], 5);
    const c = ind.clone();
    assert.deepEqual(c.genes, ind.genes);
    assert.equal(c.fitness, ind.fitness);
    c.genes[0] = 99;
    assert.notEqual(ind.genes[0], 99);
  });

  it('randomBinary creates binary individuals', () => {
    const rng = new RNG(10);
    const ind = Individual.randomBinary(20, rng);
    assert.equal(ind.length, 20);
    assert.ok(ind.genes.every(g => g === 0 || g === 1));
  });

  it('randomReal creates real-valued individuals in range', () => {
    const rng = new RNG(11);
    const ind = Individual.randomReal(10, -5, 5, rng);
    assert.equal(ind.length, 10);
    assert.ok(ind.genes.every(g => g >= -5 && g < 5));
  });

  it('randomPermutation creates valid permutations', () => {
    const rng = new RNG(12);
    const ind = Individual.randomPermutation(8, rng);
    assert.equal(ind.length, 8);
    assert.deepEqual([...ind.genes].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('toString includes fitness info', () => {
    const ind = new Individual([1, 0], 42);
    assert.ok(ind.toString().includes('42'));
  });
});

// ─── Selection ──────────────────────────────────────────────────────────

describe('Selection', () => {
  function makePop() {
    return [
      new Individual([0], 1),
      new Individual([1], 5),
      new Individual([2], 10),
      new Individual([3], 3),
      new Individual([4], 8),
    ];
  }

  it('tournament selection prefers higher fitness', () => {
    const rng = new RNG(20);
    const pop = makePop();
    const counts = {};
    for (let i = 0; i < 1000; i++) {
      const sel = tournamentSelect(pop, 3, rng);
      counts[sel.fitness] = (counts[sel.fitness] || 0) + 1;
    }
    // Fitness 10 should be selected most often
    assert.ok(counts[10] > counts[1], 'Best should be selected more than worst');
  });

  it('roulette selection returns valid individuals', () => {
    const rng = new RNG(21);
    const pop = makePop();
    for (let i = 0; i < 100; i++) {
      const sel = rouletteSelect(pop, rng);
      assert.ok(pop.includes(sel));
    }
  });

  it('roulette handles all-zero fitness', () => {
    const rng = new RNG(22);
    const pop = [new Individual([0], 0), new Individual([1], 0)];
    const sel = rouletteSelect(pop, rng);
    assert.ok(pop.includes(sel));
  });

  it('rank selection returns valid individuals', () => {
    const rng = new RNG(23);
    const pop = makePop();
    for (let i = 0; i < 100; i++) {
      const sel = rankSelect(pop, rng);
      assert.ok(pop.includes(sel));
    }
  });

  it('SUS selects correct number of individuals', () => {
    const rng = new RNG(24);
    const pop = makePop();
    const selected = susSelect(pop, 4, rng);
    assert.equal(selected.length, 4);
    for (const s of selected) assert.ok(pop.includes(s));
  });
});

// ─── Crossover ──────────────────────────────────────────────────────────

describe('Crossover', () => {
  it('single-point crossover produces valid offspring', () => {
    const rng = new RNG(30);
    const p1 = new Individual([1, 1, 1, 1, 1]);
    const p2 = new Individual([0, 0, 0, 0, 0]);
    const [c1, c2] = singlePointCrossover(p1, p2, rng);
    assert.equal(c1.length, 5);
    assert.equal(c2.length, 5);
    // Each child should have genes from both parents
    assert.ok(c1.genes.every(g => g === 0 || g === 1));
  });

  it('two-point crossover preserves gene values', () => {
    const rng = new RNG(31);
    const p1 = new Individual([1, 2, 3, 4, 5]);
    const p2 = new Individual([6, 7, 8, 9, 10]);
    const [c1, c2] = twoPointCrossover(p1, p2, rng);
    // All genes should be from original parents
    const allGenes = new Set([...p1.genes, ...p2.genes]);
    assert.ok(c1.genes.every(g => allGenes.has(g)));
    assert.ok(c2.genes.every(g => allGenes.has(g)));
  });

  it('uniform crossover mixes genes', () => {
    const rng = new RNG(32);
    const p1 = new Individual(Array(20).fill(1));
    const p2 = new Individual(Array(20).fill(0));
    const [c1] = uniformCrossover(p1, p2, rng);
    // Should have mix of 0s and 1s (very unlikely to be all same)
    const sum = c1.genes.reduce((a, b) => a + b, 0);
    assert.ok(sum > 0 && sum < 20, `Expected mix, got sum=${sum}`);
  });

  it('blend crossover produces real values', () => {
    const rng = new RNG(33);
    const p1 = new Individual([0, 0, 0]);
    const p2 = new Individual([10, 10, 10]);
    const [c1, c2] = blendCrossover(p1, p2, rng, 0.5);
    // Should be in expanded range [-5, 15]
    assert.ok(c1.genes.every(g => g >= -5 && g <= 15));
  });

  it('order crossover produces valid permutations', () => {
    const rng = new RNG(34);
    const p1 = new Individual([0, 1, 2, 3, 4, 5, 6, 7]);
    const p2 = new Individual([7, 6, 5, 4, 3, 2, 1, 0]);
    const [c1, c2] = orderCrossover(p1, p2, rng);
    assert.deepEqual([...c1.genes].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual([...c2.genes].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

// ─── Mutation ───────────────────────────────────────────────────────────

describe('Mutation', () => {
  it('bitFlip flips some bits', () => {
    const rng = new RNG(40);
    const ind = new Individual(Array(100).fill(0));
    const mutated = bitFlipMutation(ind, 0.5, rng);
    const flipped = mutated.genes.filter(g => g === 1).length;
    assert.ok(flipped > 10 && flipped < 90, `Expected ~50 flips, got ${flipped}`);
  });

  it('bitFlip with rate=0 changes nothing', () => {
    const rng = new RNG(41);
    const ind = new Individual([0, 1, 0, 1]);
    const mutated = bitFlipMutation(ind, 0, rng);
    assert.deepEqual(mutated.genes, ind.genes);
  });

  it('gaussian mutation perturbs values', () => {
    const rng = new RNG(42);
    const ind = new Individual([5, 5, 5, 5, 5]);
    const mutated = gaussianMutation(ind, 1.0, 0.1, rng);
    // All should be close to 5 but not exactly 5
    assert.ok(mutated.genes.some(g => g !== 5));
    assert.ok(mutated.genes.every(g => Math.abs(g - 5) < 2));
  });

  it('gaussian mutation respects clamp bounds', () => {
    const rng = new RNG(43);
    const ind = new Individual([0, 0, 0]);
    const mutated = gaussianMutation(ind, 1.0, 100, rng, -1, 1);
    assert.ok(mutated.genes.every(g => g >= -1 && g <= 1));
  });

  it('uniform mutation stays in range', () => {
    const rng = new RNG(44);
    const ind = new Individual([50, 50, 50]);
    const mutated = uniformMutation(ind, 1.0, 0, 10, rng);
    assert.ok(mutated.genes.every(g => g >= 0 && g < 10));
  });

  it('swap mutation produces valid permutation', () => {
    const rng = new RNG(45);
    const ind = new Individual([0, 1, 2, 3, 4]);
    const mutated = swapMutation(ind, 1.0, rng);
    assert.deepEqual([...mutated.genes].sort(), [0, 1, 2, 3, 4]);
  });

  it('inversion mutation produces valid permutation', () => {
    const rng = new RNG(46);
    const ind = new Individual([0, 1, 2, 3, 4, 5]);
    const mutated = inversionMutation(ind, 1.0, rng);
    assert.deepEqual([...mutated.genes].sort(), [0, 1, 2, 3, 4, 5]);
  });

  it('scramble mutation produces valid permutation', () => {
    const rng = new RNG(47);
    const ind = new Individual([0, 1, 2, 3, 4, 5]);
    const mutated = scrambleMutation(ind, 1.0, rng);
    assert.deepEqual([...mutated.genes].sort(), [0, 1, 2, 3, 4, 5]);
  });
});

// ─── Population ─────────────────────────────────────────────────────────

describe('Population', () => {
  it('initializes with correct size', () => {
    const rng = new RNG(50);
    const pop = new Population({
      size: 20,
      createIndividual: () => Individual.randomBinary(10, rng),
      fitness: (genes) => genes.reduce((a, b) => a + b, 0),
      rng
    });
    assert.equal(pop.individuals.length, 20);
  });

  it('evaluates fitness for all individuals', () => {
    const rng = new RNG(51);
    const pop = new Population({
      size: 10,
      createIndividual: () => Individual.randomBinary(5, rng),
      fitness: (genes) => genes.reduce((a, b) => a + b, 0),
      rng
    });
    pop.evaluate();
    assert.ok(pop.individuals.every(i => i.fitness !== null));
  });

  it('getBest returns highest fitness individual', () => {
    const rng = new RNG(52);
    const pop = new Population({
      size: 10,
      createIndividual: () => Individual.randomBinary(10, rng),
      fitness: (genes) => genes.reduce((a, b) => a + b, 0),
      rng
    });
    pop.evaluate();
    const best = pop.getBest();
    const maxFitness = Math.max(...pop.individuals.map(i => i.fitness));
    assert.equal(best.fitness, maxFitness);
  });

  it('getStats returns correct statistics', () => {
    const rng = new RNG(53);
    const pop = new Population({
      size: 5,
      createIndividual: () => new Individual([1]),
      fitness: () => 0,
      rng
    });
    // Manually set fitnesses
    pop.individuals[0].fitness = 1;
    pop.individuals[1].fitness = 2;
    pop.individuals[2].fitness = 3;
    pop.individuals[3].fitness = 4;
    pop.individuals[4].fitness = 5;
    const stats = pop.getStats();
    assert.equal(stats.best, 5);
    assert.equal(stats.worst, 1);
    assert.equal(stats.avg, 3);
  });

  it('evolve increases generation count', () => {
    const rng = new RNG(54);
    const pop = new Population({
      size: 20,
      createIndividual: () => Individual.randomBinary(10, rng),
      fitness: (genes) => genes.reduce((a, b) => a + b, 0),
      rng
    });
    assert.equal(pop.generation, 0);
    pop.evolve();
    assert.equal(pop.generation, 1);
  });

  it('elitism preserves best individual', () => {
    const rng = new RNG(55);
    const pop = new Population({
      size: 20,
      createIndividual: () => Individual.randomBinary(10, rng),
      fitness: (genes) => genes.reduce((a, b) => a + b, 0),
      elitism: 2,
      rng
    });
    pop.evaluate();
    const bestBefore = pop.getBest().fitness;
    pop.evolve();
    pop.evaluate();
    const bestAfter = pop.getBest().fitness;
    assert.ok(bestAfter >= bestBefore, 'Elitism should preserve best');
  });

  it('run completes specified generations', () => {
    const rng = new RNG(56);
    const pop = new Population({
      size: 20,
      createIndividual: () => Individual.randomBinary(10, rng),
      fitness: (genes) => genes.reduce((a, b) => a + b, 0),
      rng
    });
    const result = pop.run(50);
    assert.equal(result.generations, 50);
    assert.equal(result.history.length, 50);
    assert.ok(result.bestEver !== null);
  });

  it('OneMax converges toward all-ones', () => {
    const rng = new RNG(57);
    const pop = new Population({
      size: 50,
      createIndividual: () => Individual.randomBinary(20, rng),
      fitness: (genes) => genes.reduce((a, b) => a + b, 0),
      mutation: { rate: 0.05 },
      rng
    });
    const result = pop.run(100);
    // Should get close to 20 (all ones)
    assert.ok(result.bestEver.fitness >= 16, `Expected >=16, got ${result.bestEver.fitness}`);
  });

  it('tracks history with stats per generation', () => {
    const rng = new RNG(58);
    const pop = new Population({
      size: 10,
      createIndividual: () => Individual.randomBinary(5, rng),
      fitness: (genes) => genes.reduce((a, b) => a + b, 0),
      rng
    });
    pop.run(5);
    assert.equal(pop.history.length, 5);
    for (const h of pop.history) {
      assert.ok('best' in h);
      assert.ok('avg' in h);
      assert.ok('worst' in h);
      assert.ok('generation' in h);
    }
  });

  it('callback fires each generation', () => {
    const rng = new RNG(59);
    let calls = 0;
    const pop = new Population({
      size: 10,
      createIndividual: () => Individual.randomBinary(5, rng),
      fitness: (genes) => genes.reduce((a, b) => a + b, 0),
      rng
    });
    pop.run(10, () => { calls++; });
    assert.equal(calls, 10);
  });

  it('custom selection and crossover work', () => {
    const rng = new RNG(60);
    const pop = new Population({
      size: 30,
      createIndividual: () => Individual.randomBinary(10, rng),
      fitness: (genes) => genes.reduce((a, b) => a + b, 0),
      selection: {
        method: (pop, rng) => tournamentSelect(pop, 5, rng)
      },
      crossover: {
        method: (p1, p2, rng) => uniformCrossover(p1, p2, rng),
        rate: 0.9
      },
      mutation: {
        method: (ind, rate, rng) => bitFlipMutation(ind, rate, rng),
        rate: 0.02
      },
      rng
    });
    const result = pop.run(50);
    assert.ok(result.bestEver.fitness >= 7);
  });

  it('works with real-valued individuals and gaussian mutation', () => {
    const rng = new RNG(61);
    // Minimize (x-3)^2 + (y-7)^2 → maximize negative of that
    const pop = new Population({
      size: 50,
      createIndividual: () => Individual.randomReal(2, -10, 10, rng),
      fitness: (genes) => {
        const [x, y] = genes;
        return -((x - 3) ** 2 + (y - 7) ** 2);
      },
      crossover: {
        method: (p1, p2, rng) => blendCrossover(p1, p2, rng, 0.3),
        rate: 0.8
      },
      mutation: {
        method: (ind, rate, rng) => gaussianMutation(ind, rate, 1.0, rng, -10, 10),
        rate: 0.3
      },
      elitism: 2,
      rng
    });
    const result = pop.run(200);
    const [x, y] = result.bestEver.genes;
    assert.ok(Math.abs(x - 3) < 2, `x=${x}, expected ~3`);
    assert.ok(Math.abs(y - 7) < 2, `y=${y}, expected ~7`);
  });
});
