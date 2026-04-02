import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { Genome, resetNEAT } from '../src/neat.js';
import { Species, speciate, nextGeneration, resetSpeciesCounter } from '../src/neat-species.js';

describe('NEAT Speciation', () => {
  beforeEach(() => {
    resetNEAT();
    resetSpeciesCounter();
  });

  describe('Species', () => {
    it('should create a species with a representative', () => {
      const g = new Genome(2, 1);
      g.initFullConnect(() => 0.5);
      const sp = new Species(g, 0);
      assert.equal(sp.members.length, 1);
      assert.equal(sp.representative, g);
    });

    it('should check compatibility', () => {
      const g1 = new Genome(2, 1);
      g1.initFullConnect(() => 0.5);
      const sp = new Species(g1, 0);

      // Clone should be compatible
      const g2 = g1.clone();
      assert.ok(sp.isCompatible(g2, 3.0, { c1: 1, c2: 1, c3: 0.4 }));

      // Very different genome should not be compatible (with tight threshold)
      const g3 = new Genome(2, 1);
      g3.initFullConnect(() => 0.5);
      for (let i = 0; i < 10; i++) g3.addNodeMutation(Math.random);
      assert.ok(!sp.isCompatible(g3, 0.1, { c1: 1, c2: 1, c3: 0.4 }));
    });

    it('should compute adjusted fitness', () => {
      const g1 = new Genome(2, 1);
      g1.initFullConnect(() => 0.5);
      g1.fitness = 10;
      const g2 = g1.clone();
      g2.fitness = 20;

      const sp = new Species(g1, 0);
      sp.addMember(g2);
      sp.computeAdjustedFitness();

      // Adjusted = fitness / species_size
      assert.equal(g1.adjustedFitness, 5);
      assert.equal(g2.adjustedFitness, 10);
    });

    it('should select parents via tournament', () => {
      const g1 = new Genome(2, 1);
      g1.initFullConnect(() => 0.5);
      g1.fitness = 100;
      const g2 = g1.clone();
      g2.fitness = 1;

      const sp = new Species(g1, 0);
      sp.addMember(g2);

      // Select many times — fitter member should win more often
      let g1Count = 0;
      for (let i = 0; i < 100; i++) {
        const parent = sp.selectParent(Math.random);
        if (parent === g1) g1Count++;
      }
      assert.ok(g1Count > 50, `Fitter parent should be selected more often, got ${g1Count}/100`);
    });

    it('should reproduce offspring', () => {
      const g1 = new Genome(2, 1);
      g1.initFullConnect(() => 0.5);
      g1.fitness = 10;
      const g2 = g1.clone();
      g2.fitness = 8;

      const sp = new Species(g1, 0);
      sp.addMember(g2);
      sp.sortByFitness();

      const offspring = sp.reproduce(5, {}, Math.random);
      assert.equal(offspring.length, 5);
      // First should be elite (clone of best)
      assert.equal(offspring[0].connections.length, g1.connections.length);
    });

    it('should track staleness', () => {
      const g = new Genome(2, 1);
      g.initFullConnect(() => 0.5);
      g.fitness = 10;
      const sp = new Species(g, 0);

      sp.updateStaleness();
      assert.equal(sp.staleness, 0);
      assert.equal(sp.bestFitness, 10);
      assert.equal(sp.age, 1);

      // No improvement
      sp.updateStaleness();
      assert.equal(sp.staleness, 1);
      assert.equal(sp.age, 2);

      // Improvement
      sp.members[0].fitness = 20;
      sp.updateStaleness();
      assert.equal(sp.staleness, 0);
      assert.equal(sp.bestFitness, 20);
    });
  });

  describe('speciate()', () => {
    it('should assign similar genomes to same species', () => {
      const genomes = [];
      for (let i = 0; i < 10; i++) {
        const g = new Genome(2, 1);
        g.initFullConnect(() => 0.5);
        g.mutateWeights({}, Math.random);
        genomes.push(g);
      }

      const species = speciate(genomes, [], { compatibilityThreshold: 10.0 });
      assert.ok(species.length >= 1);
      // With high threshold, most should be in same species
      assert.ok(species[0].members.length > 5, `Expected most in one species, got ${species[0].members.length}`);
    });

    it('should create multiple species for diverse genomes', () => {
      const genomes = [];
      for (let i = 0; i < 20; i++) {
        const g = new Genome(2, 1);
        g.initFullConnect(() => 0.5);
        // Add many structural mutations to create diversity
        for (let j = 0; j < i * 2; j++) {
          g.addNodeMutation(Math.random);
          g.addConnectionMutation(Math.random);
        }
        genomes.push(g);
      }

      const species = speciate(genomes, [], { compatibilityThreshold: 0.5 });
      assert.ok(species.length > 1, `Expected multiple species, got ${species.length}`);
    });
  });

  describe('nextGeneration()', () => {
    it('should produce correct population size', () => {
      const popSize = 20;
      const genomes = [];
      for (let i = 0; i < popSize; i++) {
        const g = new Genome(2, 1);
        g.initFullConnect(Math.random);
        g.fitness = Math.random() * 10;
        genomes.push(g);
      }

      let species = speciate(genomes, [], { compatibilityThreshold: 5.0 });
      const result = nextGeneration(species, popSize, {}, Math.random);

      assert.equal(result.population.length, popSize);
      assert.ok(result.species.length > 0);
    });

    it('should maintain species across generations', () => {
      const popSize = 30;
      const genomes = [];
      for (let i = 0; i < popSize; i++) {
        const g = new Genome(2, 1);
        g.initFullConnect(Math.random);
        g.fitness = Math.random() * 10;
        genomes.push(g);
      }

      let species = speciate(genomes, [], { compatibilityThreshold: 5.0 });

      // Run 3 generations
      for (let gen = 0; gen < 3; gen++) {
        const result = nextGeneration(species, popSize, {}, Math.random);
        // Assign some fitness
        for (const g of result.population) {
          g.fitness = Math.random() * 10;
        }
        species = result.species;
      }

      assert.ok(species.length > 0);
      const totalMembers = species.reduce((s, sp) => s + sp.members.length, 0);
      assert.equal(totalMembers, popSize);
    });

    it('should evolve XOR-like behavior over generations', () => {
      const popSize = 50;
      const numGenerations = 30;
      
      // XOR fitness function
      function xorFitness(genome) {
        const cases = [[0,0,0], [0,1,1], [1,0,1], [1,1,0]];
        let error = 0;
        for (const [a, b, expected] of cases) {
          const output = genome.forward([a, b])[0];
          error += (output - expected) ** 2;
        }
        return 4 - error; // Max fitness = 4
      }

      // Initialize population
      let genomes = [];
      for (let i = 0; i < popSize; i++) {
        const g = new Genome(2, 1);
        g.initFullConnect(Math.random);
        g.fitness = xorFitness(g);
        genomes.push(g);
      }

      let species = speciate(genomes, [], { compatibilityThreshold: 3.0 });
      let bestFitness = Math.max(...genomes.map(g => g.fitness));

      for (let gen = 0; gen < numGenerations; gen++) {
        const result = nextGeneration(species, popSize, {
          addNodeRate: 0.05,
          addConnectionRate: 0.1,
          weightMutationRate: 0.9,
        }, Math.random);

        for (const g of result.population) {
          g.fitness = xorFitness(g);
        }

        const genBest = Math.max(...result.population.map(g => g.fitness));
        if (genBest > bestFitness) bestFitness = genBest;
        species = result.species;
      }

      // After 30 generations, fitness should have improved from random
      assert.ok(bestFitness > 2.5, `Best fitness should be > 2.5, got ${bestFitness.toFixed(3)}`);
    });
  });
});
