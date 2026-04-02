/**
 * Advanced GA features: adaptive mutation, island model, speciation.
 */

import { Individual } from './individual.js';
import { Population } from './population.js';

/**
 * Adaptive mutation rate — adjusts based on population diversity.
 * When diversity is low (population converging), increase mutation.
 * When diversity is high, decrease mutation.
 * 
 * @param {Population} pop
 * @param {number} baseRate — baseline mutation rate
 * @param {number} [minRate=0.001]
 * @param {number} [maxRate=0.5]
 * @returns {number} adapted rate
 */
export function adaptiveMutationRate(pop, baseRate, minRate = 0.001, maxRate = 0.5) {
  const stats = pop.getStats();
  if (stats.std === 0) return maxRate; // all same fitness → max mutation
  // Coefficient of variation
  const cv = stats.avg !== 0 ? stats.std / Math.abs(stats.avg) : 1;
  // Lower cv → less diversity → higher mutation
  const factor = Math.max(0.1, 1 - cv);
  const rate = baseRate * (1 + factor * 2);
  return Math.min(maxRate, Math.max(minRate, rate));
}

/**
 * Island model — run multiple sub-populations with periodic migration.
 * 
 * @param {Object} config
 * @param {number} config.numIslands — number of sub-populations
 * @param {number} config.islandSize — individuals per island
 * @param {Function} config.createIndividual
 * @param {Function} config.fitness
 * @param {Object} [config.selection]
 * @param {Object} [config.crossover]
 * @param {Object} [config.mutation]
 * @param {number} [config.elitism=1]
 * @param {number} config.migrationInterval — generations between migrations
 * @param {number} config.migrationRate — fraction of population to migrate
 * @param {string} [config.topology='ring'] — 'ring' or 'full'
 * @param {RNG} config.rng
 */
export class IslandModel {
  constructor(config) {
    this.config = config;
    this.rng = config.rng;
    this.generation = 0;
    this.bestEver = null;
    this.history = [];

    // Create islands
    this.islands = [];
    for (let i = 0; i < config.numIslands; i++) {
      this.islands.push(new Population({
        size: config.islandSize,
        createIndividual: config.createIndividual,
        fitness: config.fitness,
        selection: config.selection,
        crossover: config.crossover,
        mutation: config.mutation,
        elitism: config.elitism ?? 1,
        rng: config.rng
      }));
    }
  }

  /** Migrate individuals between islands */
  migrate() {
    const rate = this.config.migrationRate;
    const n = Math.max(1, Math.floor(this.config.islandSize * rate));

    if (this.config.topology === 'full') {
      // Full topology: each island sends to every other
      for (let i = 0; i < this.islands.length; i++) {
        for (let j = 0; j < this.islands.length; j++) {
          if (i === j) continue;
          this._migrateBetween(this.islands[i], this.islands[j], n);
        }
      }
    } else {
      // Ring topology (default)
      for (let i = 0; i < this.islands.length; i++) {
        const next = (i + 1) % this.islands.length;
        this._migrateBetween(this.islands[i], this.islands[next], n);
      }
    }
  }

  _migrateBetween(source, dest, n) {
    // Sort source by fitness, take top n
    const sorted = [...source.individuals].sort((a, b) => b.fitness - a.fitness);
    const migrants = sorted.slice(0, n).map(ind => ind.clone());
    
    // Replace worst in destination
    const destSorted = [...dest.individuals]
      .map((ind, idx) => ({ ind, idx }))
      .sort((a, b) => a.ind.fitness - b.ind.fitness);
    
    for (let i = 0; i < Math.min(n, destSorted.length); i++) {
      dest.individuals[destSorted[i].idx] = migrants[i];
    }
  }

  /** Evolve all islands for one generation */
  evolve() {
    for (const island of this.islands) {
      island.evolve();
    }

    // Check for migration
    if (this.config.migrationInterval > 0 &&
        this.generation > 0 &&
        this.generation % this.config.migrationInterval === 0) {
      this.migrate();
    }

    // Track best across all islands
    for (const island of this.islands) {
      const best = island.getBest();
      if (!this.bestEver || best.fitness > this.bestEver.fitness) {
        this.bestEver = best.clone();
      }
    }

    // Collect stats
    const allFitnesses = this.islands.flatMap(isl => 
      isl.individuals.map(ind => ind.fitness)
    );
    const best = Math.max(...allFitnesses);
    const avg = allFitnesses.reduce((a, b) => a + b, 0) / allFitnesses.length;
    const worst = Math.min(...allFitnesses);

    this.history.push({
      generation: this.generation,
      best, avg, worst,
      islandBests: this.islands.map(isl => isl.getBest().fitness)
    });

    this.generation++;
  }

  /**
   * Run for multiple generations.
   * @param {number} generations
   * @param {Function} [callback]
   * @returns {{ bestEver, history, generations }}
   */
  run(generations, callback) {
    for (let g = 0; g < generations; g++) {
      this.evolve();
      if (callback) {
        callback(this.generation, this.history[this.history.length - 1], this.bestEver);
      }
    }
    return {
      bestEver: this.bestEver,
      history: this.history,
      generations: this.generation
    };
  }
}

/**
 * Species — a group of similar individuals.
 */
class Species {
  constructor(representative) {
    this.representative = representative;
    this.members = [representative];
    this.bestFitness = representative.fitness ?? -Infinity;
    this.stagnation = 0;
  }

  addMember(ind) {
    this.members.push(ind);
    if (ind.fitness !== null && ind.fitness > this.bestFitness) {
      this.bestFitness = ind.fitness;
      this.stagnation = 0;
    }
  }

  clear() {
    // Keep representative, clear members for new generation
    this.representative = this.members.length > 0 
      ? this.members.reduce((best, m) => 
          (m.fitness ?? -Infinity) > (best.fitness ?? -Infinity) ? m : best)
      : this.representative;
    this.members = [];
    this.stagnation++;
  }
}

/**
 * Speciated population — individuals are grouped by genetic distance.
 * Inspired by NEAT's speciation, but generalized for any encoding.
 * 
 * @param {Object} config
 * @param {number} config.size
 * @param {Function} config.createIndividual
 * @param {Function} config.fitness
 * @param {Function} config.distance — (genes1, genes2) => number
 * @param {number} config.distanceThreshold — species compatibility threshold
 * @param {Object} [config.selection]
 * @param {Object} [config.crossover]
 * @param {Object} [config.mutation]
 * @param {number} [config.elitism=1]
 * @param {number} [config.stagnationLimit=15] — remove species after this many gen without improvement
 * @param {RNG} config.rng
 */
export class SpeciatedPopulation {
  constructor(config) {
    this.config = config;
    this.rng = config.rng;
    this.generation = 0;
    this.bestEver = null;
    this.history = [];
    this.species = [];

    // Initialize population
    this.individuals = [];
    for (let i = 0; i < config.size; i++) {
      this.individuals.push(config.createIndividual());
    }
  }

  /** Assign individuals to species based on distance function */
  speciate() {
    // Clear existing species members
    for (const sp of this.species) {
      sp.clear();
    }

    for (const ind of this.individuals) {
      let placed = false;
      for (const sp of this.species) {
        const dist = this.config.distance(ind.genes, sp.representative.genes);
        if (dist < this.config.distanceThreshold) {
          sp.addMember(ind);
          placed = true;
          break;
        }
      }
      if (!placed) {
        this.species.push(new Species(ind));
      }
    }

    // Remove empty species and stagnant ones
    const limit = this.config.stagnationLimit ?? 15;
    this.species = this.species.filter(sp => 
      sp.members.length > 0 && sp.stagnation < limit
    );

    // Safety: if all species removed, create one from best individual
    if (this.species.length === 0) {
      const best = this.individuals.reduce((b, i) =>
        (i.fitness ?? -Infinity) > (b.fitness ?? -Infinity) ? i : b
      );
      this.species.push(new Species(best));
      for (const ind of this.individuals) {
        this.species[0].addMember(ind);
      }
    }
  }

  /** Evaluate all individuals */
  evaluate() {
    for (const ind of this.individuals) {
      if (ind.fitness === null) {
        ind.fitness = this.config.fitness(ind.genes);
      }
    }
    const best = this.individuals.reduce((b, i) =>
      i.fitness > b.fitness ? i : b
    );
    if (!this.bestEver || best.fitness > this.bestEver.fitness) {
      this.bestEver = best.clone();
    }
  }

  /** One generation of speciated evolution */
  evolve() {
    this.evaluate();
    this.speciate();

    // Explicit fitness sharing: divide fitness by species size
    for (const sp of this.species) {
      for (const m of sp.members) {
        m._sharedFitness = m.fitness / sp.members.length;
      }
    }

    // Allocate offspring per species proportional to total shared fitness
    const totalShared = this.species.reduce((sum, sp) =>
      sum + sp.members.reduce((s, m) => s + m._sharedFitness, 0), 0
    );

    const newPop = [];
    for (const sp of this.species) {
      const spShared = sp.members.reduce((s, m) => s + m._sharedFitness, 0);
      let quota = totalShared > 0
        ? Math.round((spShared / totalShared) * this.config.size)
        : Math.floor(this.config.size / this.species.length);
      quota = Math.max(1, quota);

      // Elitism: keep best from species
      const sorted = [...sp.members].sort((a, b) => b.fitness - a.fitness);
      if (sorted.length > 0) newPop.push(sorted[0].clone());

      const selectFn = this.config.selection?.method ??
        ((pop, rng) => {
          const { tournamentSelect } = require('./selection.js');
          return tournamentSelect(pop, 3, rng);
        });

      // Dynamic import workaround — use inline tournament
      const select = (members) => {
        let best = null;
        for (let i = 0; i < 3; i++) {
          const c = members[this.rng.randInt(0, members.length - 1)];
          if (!best || c.fitness > best.fitness) best = c;
        }
        return best;
      };

      const crossFn = this.config.crossover?.method;
      const mutateFn = this.config.mutation?.method;
      const crossRate = this.config.crossover?.rate ?? 0.8;
      const mutRate = this.config.mutation?.rate ?? 0.01;

      while (newPop.filter(i => true).length < this.config.size && quota > 1) {
        const p1 = select(sp.members);
        const p2 = select(sp.members);
        let child;
        if (crossFn && this.rng.chance(crossRate)) {
          [child] = crossFn(p1, p2, this.rng);
        } else {
          child = p1.clone();
        }
        if (mutateFn) {
          child = mutateFn(child, mutRate, this.rng);
        }
        newPop.push(child);
        quota--;
      }
    }

    // Trim or pad to exact size
    while (newPop.length > this.config.size) newPop.pop();
    while (newPop.length < this.config.size) {
      newPop.push(this.config.createIndividual());
    }

    this.individuals = newPop;

    const fitnesses = this.individuals.filter(i => i.fitness !== null).map(i => i.fitness);
    if (fitnesses.length > 0) {
      this.history.push({
        generation: this.generation,
        best: Math.max(...fitnesses),
        avg: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
        worst: Math.min(...fitnesses),
        numSpecies: this.species.length
      });
    }

    this.generation++;
  }

  run(generations, callback) {
    for (let g = 0; g < generations; g++) {
      this.evolve();
      if (callback) {
        callback(this.generation, this.history[this.history.length - 1], this.bestEver);
      }
    }
    this.evaluate();
    return {
      bestEver: this.bestEver,
      history: this.history,
      generations: this.generation,
      numSpecies: this.species.length
    };
  }
}
