/**
 * Individual — a candidate solution in the genetic algorithm.
 * 
 * An individual has:
 * - genes: array of values (the genotype)
 * - fitness: computed fitness score (null until evaluated)
 */

export class Individual {
  /**
   * @param {Array} genes — the genotype
   * @param {number|null} [fitness] — pre-computed fitness (null = unevaluated)
   */
  constructor(genes, fitness = null) {
    this.genes = genes;
    this.fitness = fitness;
  }

  /** Number of genes */
  get length() {
    return this.genes.length;
  }

  /** Deep clone this individual */
  clone() {
    return new Individual(
      this.genes.map(g => (Array.isArray(g) ? [...g] : g)),
      this.fitness
    );
  }

  /** Create a random binary individual */
  static randomBinary(length, rng) {
    const genes = Array.from({ length }, () => (rng.random() < 0.5 ? 0 : 1));
    return new Individual(genes);
  }

  /** Create a random real-valued individual in [min, max) per gene */
  static randomReal(length, min, max, rng) {
    const genes = Array.from({ length }, () => rng.randFloat(min, max));
    return new Individual(genes);
  }

  /** Create a random permutation individual (0..length-1) */
  static randomPermutation(length, rng) {
    const genes = Array.from({ length }, (_, i) => i);
    rng.shuffle(genes);
    return new Individual(genes);
  }

  toString() {
    return `Individual(fitness=${this.fitness}, genes=[${this.genes.slice(0, 8).join(',')}${this.genes.length > 8 ? ',...' : ''}])`;
  }
}
