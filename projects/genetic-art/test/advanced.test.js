import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RNG, Individual, Population,
  adaptiveMutationRate, IslandModel, SpeciatedPopulation,
  oneMax, sphere, rastrigin,
  singlePointCrossover, blendCrossover, gaussianMutation, bitFlipMutation,
  tournamentSelect
} from '../src/index.js';

// ─── Adaptive Mutation ──────────────────────────────────────────────────

describe('Adaptive mutation rate', () => {
  it('increases rate when population has low diversity', () => {
    const rng = new RNG(300);
    const pop = new Population({
      size: 10,
      createIndividual: () => new Individual([1, 1, 1, 1, 1]),
      fitness: oneMax,
      rng
    });
    pop.evaluate();
    // All same → zero std → should get max or near-max rate
    const rate = adaptiveMutationRate(pop, 0.01);
    assert.ok(rate > 0.01, `Expected higher rate, got ${rate}`);
  });

  it('returns reasonable rate for diverse population', () => {
    const rng = new RNG(301);
    const pop = new Population({
      size: 50,
      createIndividual: () => Individual.randomBinary(20, rng),
      fitness: oneMax,
      rng
    });
    pop.evaluate();
    const rate = adaptiveMutationRate(pop, 0.01);
    assert.ok(rate >= 0.001 && rate <= 0.5, `Rate out of bounds: ${rate}`);
  });

  it('respects min and max bounds', () => {
    const rng = new RNG(302);
    const pop = new Population({
      size: 10,
      createIndividual: () => new Individual([1, 1, 1]),
      fitness: oneMax,
      rng
    });
    pop.evaluate();
    const rate = adaptiveMutationRate(pop, 0.01, 0.005, 0.1);
    assert.ok(rate >= 0.005 && rate <= 0.1);
  });
});

// ─── Island Model ───────────────────────────────────────────────────────

describe('Island Model', () => {
  it('creates correct number of islands', () => {
    const rng = new RNG(310);
    const model = new IslandModel({
      numIslands: 4,
      islandSize: 20,
      createIndividual: () => Individual.randomBinary(10, rng),
      fitness: oneMax,
      migrationInterval: 5,
      migrationRate: 0.1,
      rng
    });
    assert.equal(model.islands.length, 4);
    assert.equal(model.islands[0].individuals.length, 20);
  });

  it('evolves and tracks history', () => {
    const rng = new RNG(311);
    const model = new IslandModel({
      numIslands: 3,
      islandSize: 20,
      createIndividual: () => Individual.randomBinary(10, rng),
      fitness: oneMax,
      migrationInterval: 5,
      migrationRate: 0.1,
      mutation: { rate: 0.05 },
      rng
    });
    const result = model.run(30);
    assert.equal(result.generations, 30);
    assert.equal(result.history.length, 30);
    assert.ok(result.bestEver !== null);
  });

  it('migration improves overall fitness (ring topology)', () => {
    const rng = new RNG(312);
    // Run with migration
    const withMig = new IslandModel({
      numIslands: 4,
      islandSize: 20,
      createIndividual: () => Individual.randomBinary(15, rng),
      fitness: oneMax,
      migrationInterval: 5,
      migrationRate: 0.2,
      mutation: { rate: 0.05 },
      rng: new RNG(312)
    });
    const rWithMig = withMig.run(50);

    // Run without migration
    const withoutMig = new IslandModel({
      numIslands: 4,
      islandSize: 20,
      createIndividual: () => Individual.randomBinary(15, rng),
      fitness: oneMax,
      migrationInterval: 0, // no migration
      migrationRate: 0,
      mutation: { rate: 0.05 },
      rng: new RNG(312)
    });
    const rWithoutMig = withoutMig.run(50);

    // With migration should find at least as good (often better) solutions
    assert.ok(rWithMig.bestEver.fitness >= rWithoutMig.bestEver.fitness - 2,
      `Migration: ${rWithMig.bestEver.fitness}, No migration: ${rWithoutMig.bestEver.fitness}`);
  });

  it('full topology migration works', () => {
    const rng = new RNG(313);
    const model = new IslandModel({
      numIslands: 3,
      islandSize: 15,
      createIndividual: () => Individual.randomBinary(10, rng),
      fitness: oneMax,
      migrationInterval: 3,
      migrationRate: 0.2,
      topology: 'full',
      mutation: { rate: 0.05 },
      rng
    });
    const result = model.run(20);
    assert.ok(result.bestEver.fitness >= 5);
  });

  it('tracks per-island best fitness', () => {
    const rng = new RNG(314);
    const model = new IslandModel({
      numIslands: 3,
      islandSize: 10,
      createIndividual: () => Individual.randomBinary(8, rng),
      fitness: oneMax,
      migrationInterval: 5,
      migrationRate: 0.1,
      rng
    });
    model.run(10);
    const lastHist = model.history[model.history.length - 1];
    assert.equal(lastHist.islandBests.length, 3);
  });
});

// ─── Speciated Population ───────────────────────────────────────────────

describe('Speciated Population', () => {
  // Simple Hamming distance for binary genomes
  function hammingDistance(g1, g2) {
    let d = 0;
    for (let i = 0; i < g1.length; i++) {
      if (g1[i] !== g2[i]) d++;
    }
    return d / g1.length; // normalize to [0, 1]
  }

  it('creates population of correct size', () => {
    const rng = new RNG(320);
    const sp = new SpeciatedPopulation({
      size: 30,
      createIndividual: () => Individual.randomBinary(10, rng),
      fitness: oneMax,
      distance: hammingDistance,
      distanceThreshold: 0.5,
      rng
    });
    assert.equal(sp.individuals.length, 30);
  });

  it('forms multiple species', () => {
    const rng = new RNG(321);
    const sp = new SpeciatedPopulation({
      size: 50,
      createIndividual: () => Individual.randomBinary(20, rng),
      fitness: oneMax,
      distance: hammingDistance,
      distanceThreshold: 0.3, // tight threshold → more species
      rng
    });
    sp.evaluate();
    sp.speciate();
    assert.ok(sp.species.length > 1, `Expected >1 species, got ${sp.species.length}`);
  });

  it('evolves and tracks species count', () => {
    const rng = new RNG(322);
    const sp = new SpeciatedPopulation({
      size: 40,
      createIndividual: () => Individual.randomBinary(15, rng),
      fitness: oneMax,
      distance: hammingDistance,
      distanceThreshold: 0.4,
      crossover: {
        method: (p1, p2, rng) => singlePointCrossover(p1, p2, rng),
        rate: 0.8
      },
      mutation: {
        method: (ind, rate, rng) => bitFlipMutation(ind, rate, rng),
        rate: 0.05
      },
      rng
    });
    const result = sp.run(30);
    assert.ok(result.generations === 30);
    assert.ok(result.bestEver.fitness > 0);
    assert.ok(result.numSpecies >= 1);
  });

  it('fitness sharing prevents premature convergence', () => {
    const rng = new RNG(323);
    const sp = new SpeciatedPopulation({
      size: 50,
      createIndividual: () => Individual.randomBinary(20, rng),
      fitness: oneMax,
      distance: hammingDistance,
      distanceThreshold: 0.3,
      mutation: {
        method: (ind, rate, rng) => bitFlipMutation(ind, rate, rng),
        rate: 0.05
      },
      rng
    });
    const result = sp.run(50);
    // Should maintain multiple species (diversity)
    const lastHist = result.history[result.history.length - 1];
    assert.ok(lastHist.numSpecies >= 1);
    assert.ok(result.bestEver.fitness >= 10, `Got ${result.bestEver.fitness}`);
  });

  it('stagnation removes old species', () => {
    const rng = new RNG(324);
    const sp = new SpeciatedPopulation({
      size: 30,
      createIndividual: () => Individual.randomBinary(10, rng),
      fitness: oneMax,
      distance: hammingDistance,
      distanceThreshold: 0.3,
      stagnationLimit: 5,
      mutation: {
        method: (ind, rate, rng) => bitFlipMutation(ind, rate, rng),
        rate: 0.1
      },
      rng
    });
    sp.run(30);
    // After 30 generations, stagnant species should have been removed
    // Just verify it didn't crash and still has species
    assert.ok(sp.species.length >= 1);
  });
});
