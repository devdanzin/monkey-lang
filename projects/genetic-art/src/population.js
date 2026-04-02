/**
 * Population — manages a collection of individuals through evolution.
 */

import { Individual } from './individual.js';
import { tournamentSelect } from './selection.js';
import { singlePointCrossover } from './crossover.js';
import { bitFlipMutation, gaussianMutation } from './mutation.js';

export class Population {
  /**
   * @param {Object} config
   * @param {number} config.size — population size
   * @param {Function} config.createIndividual — () => Individual
   * @param {Function} config.fitness — (genes) => number
   * @param {Object} [config.selection] — { method, params }
   * @param {Object} [config.crossover] — { method, rate, params }
   * @param {Object} [config.mutation] — { method, rate, params }
   * @param {number} [config.elitism=1] — number of elite individuals to preserve
   * @param {RNG} config.rng
   */
  constructor(config) {
    this.config = config;
    this.rng = config.rng;
    this.generation = 0;
    this.individuals = [];
    this.bestEver = null;
    this.history = []; // { generation, bestFitness, avgFitness, worstFitness }

    // Initialize population
    for (let i = 0; i < config.size; i++) {
      this.individuals.push(config.createIndividual());
    }
  }

  /** Evaluate all individuals */
  evaluate() {
    for (const ind of this.individuals) {
      if (ind.fitness === null) {
        ind.fitness = this.config.fitness(ind.genes);
      }
    }
    // Update best ever
    const best = this.getBest();
    if (!this.bestEver || best.fitness > this.bestEver.fitness) {
      this.bestEver = best.clone();
    }
  }

  /** Get the best individual in current population */
  getBest() {
    return this.individuals.reduce((best, ind) =>
      ind.fitness > best.fitness ? ind : best
    );
  }

  /** Get population statistics */
  getStats() {
    const fitnesses = this.individuals.map(i => i.fitness);
    const best = Math.max(...fitnesses);
    const worst = Math.min(...fitnesses);
    const avg = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    const variance = fitnesses.reduce((s, f) => s + (f - avg) ** 2, 0) / fitnesses.length;
    return { best, worst, avg, variance, std: Math.sqrt(variance) };
  }

  /** Perform one generation of evolution */
  evolve() {
    this.evaluate();

    const stats = this.getStats();
    this.history.push({
      generation: this.generation,
      ...stats
    });

    const elitism = this.config.elitism ?? 1;
    const crossoverRate = this.config.crossover?.rate ?? 0.8;
    const mutationRate = this.config.mutation?.rate ?? 0.01;
    const selectFn = this.config.selection?.method ?? ((pop, rng) => tournamentSelect(pop, 3, rng));
    const crossFn = this.config.crossover?.method ?? ((p1, p2, rng) => singlePointCrossover(p1, p2, rng));
    const mutateFn = this.config.mutation?.method ??
      ((ind, rate, rng) => bitFlipMutation(ind, rate, rng));

    // Sort by fitness (descending)
    const sorted = [...this.individuals].sort((a, b) => b.fitness - a.fitness);

    // New population
    const newPop = [];

    // Elitism: carry over top individuals
    for (let i = 0; i < Math.min(elitism, sorted.length); i++) {
      newPop.push(sorted[i].clone());
    }

    // Fill rest with offspring
    while (newPop.length < this.config.size) {
      const p1 = selectFn(this.individuals, this.rng);
      const p2 = selectFn(this.individuals, this.rng);

      let offspring;
      if (this.rng.chance(crossoverRate)) {
        const [c1, c2] = crossFn(p1, p2, this.rng);
        offspring = [c1, c2];
      } else {
        offspring = [p1.clone(), p2.clone()];
      }

      for (const child of offspring) {
        if (newPop.length < this.config.size) {
          const mutated = mutateFn(child, mutationRate, this.rng);
          newPop.push(mutated);
        }
      }
    }

    this.individuals = newPop;
    this.generation++;
  }

  /**
   * Run evolution for multiple generations.
   * @param {number} generations
   * @param {Function} [callback] — (generation, stats, bestEver) => void
   * @returns {{ bestEver, history, generations }}
   */
  run(generations, callback) {
    for (let g = 0; g < generations; g++) {
      this.evolve();
      if (callback) {
        callback(this.generation, this.history[this.history.length - 1], this.bestEver);
      }
    }
    // Final evaluation
    this.evaluate();
    return {
      bestEver: this.bestEver,
      history: this.history,
      generations: this.generation
    };
  }
}
