/**
 * NEAT Species — grouping genomes by structural similarity.
 * 
 * Species protect innovation by allowing novel topologies time to optimize
 * before competing with the general population.
 */

import { Genome, compatibilityDistance, crossover, resetInnovations } from './neat.js';

// --- Species ---

export class Species {
  /**
   * @param {Genome} representative - The genome that defines this species
   * @param {number} id - Species ID
   */
  constructor(representative, id) {
    this.id = id;
    this.representative = representative;
    this.members = [representative];
    this.bestFitness = 0;
    this.avgFitness = 0;
    this.staleness = 0; // Generations without fitness improvement
    this.age = 0;
  }

  /**
   * Check if a genome belongs to this species.
   * @param {Genome} genome
   * @param {number} threshold - Compatibility distance threshold
   * @param {Object} coeffs - { c1, c2, c3 }
   * @returns {boolean}
   */
  isCompatible(genome, threshold, coeffs) {
    return compatibilityDistance(this.representative, genome, coeffs) < threshold;
  }

  /**
   * Add a genome to this species.
   */
  addMember(genome) {
    this.members.push(genome);
    genome.species = this.id;
  }

  /**
   * Compute adjusted fitness for all members (fitness sharing).
   * Each member's fitness is divided by species size.
   */
  computeAdjustedFitness() {
    const n = this.members.length;
    for (const member of this.members) {
      member.adjustedFitness = member.fitness / n;
    }
    this.avgFitness = this.members.reduce((s, m) => s + m.adjustedFitness, 0) / n;
  }

  /**
   * Sort members by fitness (descending).
   */
  sortByFitness() {
    this.members.sort((a, b) => b.fitness - a.fitness);
  }

  /**
   * Update staleness tracking.
   */
  updateStaleness() {
    this.age++;
    const best = Math.max(...this.members.map(m => m.fitness));
    if (best > this.bestFitness) {
      this.bestFitness = best;
      this.staleness = 0;
    } else {
      this.staleness++;
    }
  }

  /**
   * Select a random member for reproduction (tournament selection).
   * @param {Function} [rng=Math.random]
   */
  selectParent(rng = Math.random) {
    // Tournament selection (k=3)
    const k = Math.min(3, this.members.length);
    let best = this.members[Math.floor(rng() * this.members.length)];
    for (let i = 1; i < k; i++) {
      const candidate = this.members[Math.floor(rng() * this.members.length)];
      if (candidate.fitness > best.fitness) best = candidate;
    }
    return best;
  }

  /**
   * Produce offspring for next generation.
   * @param {number} count - Number of offspring to produce
   * @param {Object} opts - Mutation rates
   * @param {Function} [rng=Math.random]
   * @returns {Genome[]}
   */
  reproduce(count, opts = {}, rng = Math.random) {
    const {
      crossoverRate = 0.75,
      addNodeRate = 0.03,
      addConnectionRate = 0.05,
      weightMutationRate = 0.8,
    } = opts;

    this.sortByFitness();
    const offspring = [];

    // Always keep the best member (elitism)
    if (count > 0) {
      offspring.push(this.members[0].clone());
      count--;
    }

    for (let i = 0; i < count; i++) {
      let child;

      if (rng() < crossoverRate && this.members.length > 1) {
        const p1 = this.selectParent(rng);
        const p2 = this.selectParent(rng);
        child = crossover(p1, p2, rng);
      } else {
        child = this.selectParent(rng).clone();
      }

      // Structural mutations
      if (rng() < addNodeRate) child.addNodeMutation(rng);
      if (rng() < addConnectionRate) child.addConnectionMutation(rng);

      // Weight mutations
      if (rng() < weightMutationRate) child.mutateWeights({}, rng);

      offspring.push(child);
    }

    return offspring;
  }
}

// --- Speciation Manager ---

let nextSpeciesId = 0;

/**
 * Assign genomes to species based on compatibility distance.
 * @param {Genome[]} population - All genomes
 * @param {Species[]} existingSpecies - Species from previous generation
 * @param {Object} opts
 * @returns {Species[]} Updated species list
 */
export function speciate(population, existingSpecies, opts = {}) {
  const {
    compatibilityThreshold = 3.0,
    c1 = 1.0,
    c2 = 1.0,
    c3 = 0.4,
  } = opts;

  const coeffs = { c1, c2, c3 };

  // Clear existing species members
  for (const sp of existingSpecies) {
    sp.members = [];
  }

  // Assign each genome to a species
  for (const genome of population) {
    let assigned = false;

    for (const sp of existingSpecies) {
      if (sp.isCompatible(genome, compatibilityThreshold, coeffs)) {
        sp.addMember(genome);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      const sp = new Species(genome, nextSpeciesId++);
      sp.addMember(genome);
      existingSpecies.push(sp);
    }
  }

  // Remove empty species
  const activeSpecies = existingSpecies.filter(sp => sp.members.length > 0);

  // Update representatives (random member from new population)
  for (const sp of activeSpecies) {
    const rng = Math.random;
    sp.representative = sp.members[Math.floor(rng() * sp.members.length)];
  }

  return activeSpecies;
}

/**
 * Reset species ID counter (for testing).
 */
export function resetSpeciesCounter() {
  nextSpeciesId = 0;
}

/**
 * Run one generation of NEAT.
 * @param {Species[]} species - Current species
 * @param {number} populationSize - Target population size
 * @param {Object} opts - Mutation and speciation parameters
 * @param {Function} [rng=Math.random]
 * @returns {{ population: Genome[], species: Species[] }}
 */
export function nextGeneration(species, populationSize, opts = {}, rng = Math.random) {
  const {
    staleThreshold = 15,
    survivalRate = 0.5,
  } = opts;

  // Update staleness and compute adjusted fitness
  for (const sp of species) {
    sp.updateStaleness();
    sp.computeAdjustedFitness();
  }

  // Remove stale species (except the best one)
  const bestSpecies = species.reduce((best, sp) =>
    sp.bestFitness > best.bestFitness ? sp : best, species[0]);

  const activeSpecies = species.filter(sp =>
    sp.staleness < staleThreshold || sp === bestSpecies
  );

  // Compute total adjusted fitness
  const totalAdjFitness = activeSpecies.reduce((s, sp) =>
    s + sp.members.reduce((s2, m) => s2 + m.adjustedFitness, 0), 0);

  // Allocate offspring per species
  const newPopulation = [];
  for (const sp of activeSpecies) {
    const spAdjFitness = sp.members.reduce((s, m) => s + m.adjustedFitness, 0);
    const quota = totalAdjFitness > 0
      ? Math.floor((spAdjFitness / totalAdjFitness) * populationSize)
      : Math.floor(populationSize / activeSpecies.length);

    // Cull bottom performers
    sp.sortByFitness();
    const survivors = Math.max(1, Math.ceil(sp.members.length * survivalRate));
    sp.members = sp.members.slice(0, survivors);

    const offspring = sp.reproduce(Math.max(1, quota), opts, rng);
    newPopulation.push(...offspring);
  }

  // Fill remaining slots (rounding can leave gaps)
  while (newPopulation.length < populationSize) {
    const sp = activeSpecies[Math.floor(rng() * activeSpecies.length)];
    const child = sp.selectParent(rng).clone();
    child.mutateWeights({}, rng);
    newPopulation.push(child);
  }

  // Trim if over
  while (newPopulation.length > populationSize) {
    newPopulation.pop();
  }

  // Reset innovations for new generation
  resetInnovations();

  // Re-speciate
  const newSpecies = speciate(newPopulation, activeSpecies, opts);

  return { population: newPopulation, species: newSpecies };
}
