import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { NEATPopulation, xorFitness, cartPoleFitness } from '../src/neat-population.js';

describe('NEAT Population', () => {
  describe('NEATPopulation', () => {
    it('should initialize with correct population size', () => {
      const neat = new NEATPopulation(2, 1, { populationSize: 30 });
      assert.equal(neat.population.length, 30);
      assert.equal(neat.generation, 0);
      assert.equal(neat.numInputs, 2);
      assert.equal(neat.numOutputs, 1);
    });

    it('should have initial species', () => {
      const neat = new NEATPopulation(2, 1, { populationSize: 30 });
      assert.ok(neat.species.length >= 1);
    });

    it('should evolve and maintain population size', () => {
      const neat = new NEATPopulation(2, 1, { populationSize: 30 });
      // Set random fitness
      for (const g of neat.population) g.fitness = Math.random() * 10;
      const stats = neat.evolve();
      assert.equal(neat.population.length, 30);
      assert.equal(neat.generation, 1);
      assert.ok(stats.bestFitness >= 0);
    });

    it('should track best genome ever', () => {
      const neat = new NEATPopulation(2, 1, { populationSize: 30 });
      for (const g of neat.population) g.fitness = Math.random() * 10;
      neat.evolve();
      assert.ok(neat.bestGenome !== null);
      assert.ok(neat.bestFitnessEver > 0);
    });

    it('should record history', () => {
      const neat = new NEATPopulation(2, 1, { populationSize: 30 });
      for (let gen = 0; gen < 5; gen++) {
        for (const g of neat.population) g.fitness = Math.random() * 10;
        neat.evolve();
      }
      assert.equal(neat.history.length, 5);
      assert.ok(neat.history[0].bestFitness >= 0);
      assert.ok(neat.history[0].species >= 1);
    });
  });

  describe('run() with XOR', () => {
    it('should improve XOR fitness over generations', () => {
      const neat = new NEATPopulation(2, 1, {
        populationSize: 100,
        addNodeRate: 0.05,
        addConnectionRate: 0.1,
      });

      const result = neat.run(xorFitness, {
        generations: 50,
        targetFitness: 3.8,
      });

      // Should have improved from random
      assert.ok(result.fitness > 2.5,
        `XOR fitness should be > 2.5, got ${result.fitness.toFixed(3)}`);
    });

    it('should call onGeneration callback', () => {
      const neat = new NEATPopulation(2, 1, { populationSize: 20 });
      const callbacks = [];
      neat.run(xorFitness, {
        generations: 5,
        onGeneration: (stats) => callbacks.push(stats),
      });
      assert.equal(callbacks.length, 5);
      assert.ok(callbacks[0].generation === 0);
    });
  });

  describe('Cart-Pole', () => {
    it('should compute cart-pole fitness', () => {
      const neat = new NEATPopulation(4, 1, { populationSize: 10 });
      const fitness = cartPoleFitness(neat.population[0]);
      assert.ok(fitness >= 0 && fitness <= 500);
    });

    it('should improve cart-pole fitness over generations', () => {
      const neat = new NEATPopulation(4, 1, {
        populationSize: 100,
        addNodeRate: 0.03,
        addConnectionRate: 0.05,
      });

      const result = neat.run(cartPoleFitness, {
        generations: 30,
      });

      // Some improvement expected
      assert.ok(result.fitness > 10,
        `Cart-pole fitness should be > 10, got ${result.fitness}`);
    });
  });

  describe('Genome complexity', () => {
    it('should grow complexity through structural mutations', () => {
      const neat = new NEATPopulation(2, 1, {
        populationSize: 50,
        addNodeRate: 0.1,
        addConnectionRate: 0.15,
      });

      const initialComplexity = neat.population.reduce((s, g) => s + g.size, 0) / neat.population.length;
      
      neat.run(xorFitness, { generations: 20 });
      
      const finalComplexity = neat.population.reduce((s, g) => s + g.size, 0) / neat.population.length;
      // With high structural mutation rates, complexity should grow
      assert.ok(finalComplexity >= initialComplexity,
        `Complexity should grow: ${initialComplexity.toFixed(1)} → ${finalComplexity.toFixed(1)}`);
    });
  });

  describe('Edge cases', () => {
    it('should handle very small population', () => {
      const neat = new NEATPopulation(2, 1, { populationSize: 5 });
      for (const g of neat.population) g.fitness = Math.random();
      neat.evolve();
      assert.equal(neat.population.length, 5);
    });

    it('should handle single output', () => {
      const neat = new NEATPopulation(1, 1, { populationSize: 10 });
      for (const g of neat.population) {
        const out = g.forward([0.5]);
        assert.equal(out.length, 1);
        g.fitness = out[0];
      }
      neat.evolve();
      assert.equal(neat.population.length, 10);
    });

    it('should handle multiple outputs', () => {
      const neat = new NEATPopulation(3, 3, { populationSize: 10 });
      for (const g of neat.population) {
        const out = g.forward([0.1, 0.5, 0.9]);
        assert.equal(out.length, 3);
        g.fitness = out.reduce((a, b) => a + b, 0);
      }
      neat.evolve();
      assert.equal(neat.population.length, 10);
    });
  });
});
