/**
 * NEAT Population — high-level API for running NEAT evolution.
 * 
 * Usage:
 *   const neat = new NEATPopulation(2, 1, { populationSize: 150 });
 *   for (let gen = 0; gen < 100; gen++) {
 *     for (const genome of neat.population) {
 *       genome.fitness = evaluateFitness(genome);
 *     }
 *     neat.evolve();
 *   }
 *   const best = neat.bestGenome;
 */

import { Genome, resetNEAT } from './neat.js';
import { Species, speciate, nextGeneration, resetSpeciesCounter } from './neat-species.js';

export class NEATPopulation {
  /**
   * @param {number} numInputs - Number of input nodes
   * @param {number} numOutputs - Number of output nodes
   * @param {Object} opts - Configuration
   */
  constructor(numInputs, numOutputs, opts = {}) {
    this.numInputs = numInputs;
    this.numOutputs = numOutputs;
    this.populationSize = opts.populationSize || 150;
    this.generation = 0;

    this.config = {
      compatibilityThreshold: opts.compatibilityThreshold || 3.0,
      c1: opts.c1 || 1.0,
      c2: opts.c2 || 1.0,
      c3: opts.c3 || 0.4,
      addNodeRate: opts.addNodeRate || 0.03,
      addConnectionRate: opts.addConnectionRate || 0.05,
      weightMutationRate: opts.weightMutationRate || 0.8,
      crossoverRate: opts.crossoverRate || 0.75,
      staleThreshold: opts.staleThreshold || 15,
      survivalRate: opts.survivalRate || 0.5,
    };

    // Initialize population
    resetNEAT();
    resetSpeciesCounter();
    this.population = [];
    for (let i = 0; i < this.populationSize; i++) {
      const g = new Genome(numInputs, numOutputs);
      g.initFullConnect(Math.random);
      this.population.push(g);
    }

    // Initial speciation
    this.species = speciate(this.population, [], this.config);
    this.bestGenome = null;
    this.bestFitnessEver = -Infinity;
    this.history = [];
  }

  /**
   * Evolve one generation.
   * Call after setting fitness on all genomes.
   * @returns {{ generation, bestFitness, avgFitness, species, complexity }}
   */
  evolve() {
    // Find best genome
    let best = this.population[0];
    let totalFitness = 0;
    for (const g of this.population) {
      totalFitness += g.fitness;
      if (g.fitness > best.fitness) best = g;
    }

    if (best.fitness > this.bestFitnessEver) {
      this.bestFitnessEver = best.fitness;
      this.bestGenome = best.clone();
    }

    const avgFitness = totalFitness / this.population.length;
    const avgComplexity = this.population.reduce((s, g) => s + g.size, 0) / this.population.length;

    const stats = {
      generation: this.generation,
      bestFitness: best.fitness,
      avgFitness,
      species: this.species.length,
      complexity: avgComplexity,
    };
    this.history.push(stats);

    // Evolve
    const result = nextGeneration(this.species, this.populationSize, this.config, Math.random);
    this.population = result.population;
    this.species = result.species;
    this.generation++;

    return stats;
  }

  /**
   * Run evolution with a fitness function.
   * @param {Function} fitnessFunction - (genome) => number
   * @param {Object} opts
   * @param {number} [opts.generations=100] - Max generations
   * @param {number} [opts.targetFitness=Infinity] - Stop when reached
   * @param {Function} [opts.onGeneration] - Callback per generation
   * @returns {{ genome: Genome, generation: number, fitness: number, solved: boolean }}
   */
  run(fitnessFunction, opts = {}) {
    const { generations = 100, targetFitness = Infinity, onGeneration } = opts;

    for (let gen = 0; gen < generations; gen++) {
      // Evaluate fitness
      for (const genome of this.population) {
        genome.fitness = fitnessFunction(genome);
      }

      const stats = this.evolve();

      if (onGeneration) onGeneration(stats);

      if (this.bestFitnessEver >= targetFitness) {
        return {
          genome: this.bestGenome,
          generation: gen,
          fitness: this.bestFitnessEver,
          solved: true,
        };
      }
    }

    return {
      genome: this.bestGenome,
      generation: generations,
      fitness: this.bestFitnessEver,
      solved: this.bestFitnessEver >= targetFitness,
    };
  }
}

// --- Built-in Fitness Functions ---

/**
 * XOR fitness function for testing.
 * Perfect fitness = 4.0
 */
export function xorFitness(genome) {
  const cases = [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]];
  let totalError = 0;
  for (const [a, b, expected] of cases) {
    const output = genome.forward([a, b])[0];
    totalError += (output - expected) ** 2;
  }
  return 4 - totalError; // Max = 4
}

/**
 * Cart-pole balancing fitness function.
 * Simple physics simulation. Fitness = number of timesteps balanced.
 */
export function cartPoleFitness(genome) {
  let x = 0;          // Cart position
  let xDot = 0;       // Cart velocity
  let theta = 0.05;   // Pole angle (slight offset)
  let thetaDot = 0;   // Pole angular velocity

  const gravity = 9.8;
  const cartMass = 1.0;
  const poleMass = 0.1;
  const totalMass = cartMass + poleMass;
  const poleLength = 0.5;
  const forceMag = 10.0;
  const dt = 0.02;
  const maxSteps = 500;

  for (let step = 0; step < maxSteps; step++) {
    // Network decides force direction
    const output = genome.forward([x, xDot, theta, thetaDot]);
    const force = output[0] > 0.5 ? forceMag : -forceMag;

    // Physics update (Euler integration)
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const temp = (force + poleMass * poleLength * thetaDot ** 2 * sinTheta) / totalMass;
    const thetaAcc = (gravity * sinTheta - cosTheta * temp) /
      (poleLength * (4 / 3 - poleMass * cosTheta ** 2 / totalMass));
    const xAcc = temp - poleMass * poleLength * thetaAcc * cosTheta / totalMass;

    x += xDot * dt;
    xDot += xAcc * dt;
    theta += thetaDot * dt;
    thetaDot += thetaAcc * dt;

    // Failure conditions
    if (Math.abs(x) > 2.4 || Math.abs(theta) > 0.2095) {
      return step;
    }
  }

  return maxSteps;
}
