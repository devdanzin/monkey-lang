/**
 * Tiny Genetic Algorithm
 * 
 * Evolutionary optimization:
 * - Population of chromosomes
 * - Fitness evaluation
 * - Selection: tournament, roulette
 * - Crossover: single-point, two-point, uniform
 * - Mutation
 * - Elitism
 * - Configurable parameters
 */

class GA {
  constructor(options) {
    this.populationSize = options.populationSize || 100;
    this.chromosomeLength = options.chromosomeLength || 10;
    this.mutationRate = options.mutationRate || 0.01;
    this.crossoverRate = options.crossoverRate || 0.7;
    this.elitism = options.elitism || 2;
    this.fitness = options.fitness;
    this.genePool = options.genePool || [0, 1]; // binary by default
    this.selection = options.selection || 'tournament';
    this.crossover = options.crossover || 'single';
    this.population = [];
    this.generation = 0;
    this.bestEver = null;
    this.bestFitness = -Infinity;
    this.history = [];
  }

  init() {
    this.population = [];
    for (let i = 0; i < this.populationSize; i++) {
      const chrom = [];
      for (let j = 0; j < this.chromosomeLength; j++) {
        chrom.push(this.genePool[Math.floor(Math.random() * this.genePool.length)]);
      }
      this.population.push(chrom);
    }
    this.generation = 0;
    return this;
  }

  evaluate() {
    return this.population.map(chrom => ({
      chromosome: chrom,
      fitness: this.fitness(chrom),
    })).sort((a, b) => b.fitness - a.fitness);
  }

  step() {
    const evaluated = this.evaluate();
    
    // Track best
    if (evaluated[0].fitness > this.bestFitness) {
      this.bestFitness = evaluated[0].fitness;
      this.bestEver = [...evaluated[0].chromosome];
    }
    
    this.history.push({
      generation: this.generation,
      best: evaluated[0].fitness,
      avg: evaluated.reduce((s, e) => s + e.fitness, 0) / evaluated.length,
      worst: evaluated[evaluated.length - 1].fitness,
    });

    const newPop = [];
    
    // Elitism
    for (let i = 0; i < this.elitism && i < evaluated.length; i++) {
      newPop.push([...evaluated[i].chromosome]);
    }

    // Fill rest
    while (newPop.length < this.populationSize) {
      const parent1 = this._select(evaluated);
      const parent2 = this._select(evaluated);
      
      let [child1, child2] = Math.random() < this.crossoverRate
        ? this._crossover(parent1, parent2)
        : [[...parent1], [...parent2]];
      
      this._mutate(child1);
      this._mutate(child2);
      
      newPop.push(child1);
      if (newPop.length < this.populationSize) newPop.push(child2);
    }

    this.population = newPop;
    this.generation++;
    return evaluated[0];
  }

  run(generations) {
    this.init();
    let best = null;
    for (let i = 0; i < generations; i++) {
      best = this.step();
    }
    return { best: this.bestEver, fitness: this.bestFitness, generations: this.generation };
  }

  _select(evaluated) {
    if (this.selection === 'tournament') {
      const size = Math.min(3, evaluated.length);
      let best = evaluated[Math.floor(Math.random() * evaluated.length)];
      for (let i = 1; i < size; i++) {
        const candidate = evaluated[Math.floor(Math.random() * evaluated.length)];
        if (candidate.fitness > best.fitness) best = candidate;
      }
      return best.chromosome;
    }
    // Roulette
    const totalFitness = evaluated.reduce((s, e) => s + Math.max(0, e.fitness), 0);
    let r = Math.random() * totalFitness;
    for (const e of evaluated) {
      r -= Math.max(0, e.fitness);
      if (r <= 0) return e.chromosome;
    }
    return evaluated[0].chromosome;
  }

  _crossover(p1, p2) {
    const len = p1.length;
    if (this.crossover === 'single') {
      const point = Math.floor(Math.random() * len);
      return [
        [...p1.slice(0, point), ...p2.slice(point)],
        [...p2.slice(0, point), ...p1.slice(point)],
      ];
    }
    if (this.crossover === 'two') {
      let a = Math.floor(Math.random() * len);
      let b = Math.floor(Math.random() * len);
      if (a > b) [a, b] = [b, a];
      return [
        [...p1.slice(0, a), ...p2.slice(a, b), ...p1.slice(b)],
        [...p2.slice(0, a), ...p1.slice(a, b), ...p2.slice(b)],
      ];
    }
    // Uniform
    const c1 = [], c2 = [];
    for (let i = 0; i < len; i++) {
      if (Math.random() < 0.5) { c1.push(p1[i]); c2.push(p2[i]); }
      else { c1.push(p2[i]); c2.push(p1[i]); }
    }
    return [c1, c2];
  }

  _mutate(chrom) {
    for (let i = 0; i < chrom.length; i++) {
      if (Math.random() < this.mutationRate) {
        chrom[i] = this.genePool[Math.floor(Math.random() * this.genePool.length)];
      }
    }
  }
}

module.exports = { GA };
