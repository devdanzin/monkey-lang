/**
 * Mutation operators — introduce variation into individuals.
 */

import { Individual } from './individual.js';

/**
 * Bit-flip mutation: flip each bit with given probability.
 * @param {Individual} ind
 * @param {number} rate — per-gene mutation rate
 * @param {RNG} rng
 * @returns {Individual}
 */
export function bitFlipMutation(ind, rate, rng) {
  const genes = [...ind.genes];
  for (let i = 0; i < genes.length; i++) {
    if (rng.chance(rate)) {
      genes[i] = genes[i] === 0 ? 1 : 0;
    }
  }
  return new Individual(genes);
}

/**
 * Gaussian mutation: add Gaussian noise to each gene.
 * @param {Individual} ind
 * @param {number} rate — per-gene mutation rate
 * @param {number} sigma — standard deviation of the noise
 * @param {RNG} rng
 * @param {number} [min=-Infinity] — clamp minimum
 * @param {number} [max=Infinity] — clamp maximum
 * @returns {Individual}
 */
export function gaussianMutation(ind, rate, sigma, rng, min = -Infinity, max = Infinity) {
  const genes = [...ind.genes];
  for (let i = 0; i < genes.length; i++) {
    if (rng.chance(rate)) {
      genes[i] = Math.min(max, Math.max(min, genes[i] + rng.gaussian() * sigma));
    }
  }
  return new Individual(genes);
}

/**
 * Uniform mutation: replace gene with random value in [min, max).
 * @param {Individual} ind
 * @param {number} rate
 * @param {number} min
 * @param {number} max
 * @param {RNG} rng
 * @returns {Individual}
 */
export function uniformMutation(ind, rate, min, max, rng) {
  const genes = [...ind.genes];
  for (let i = 0; i < genes.length; i++) {
    if (rng.chance(rate)) {
      genes[i] = rng.randFloat(min, max);
    }
  }
  return new Individual(genes);
}

/**
 * Swap mutation: swap two random genes (for permutations).
 * @param {Individual} ind
 * @param {number} rate — probability of performing the swap
 * @param {RNG} rng
 * @returns {Individual}
 */
export function swapMutation(ind, rate, rng) {
  if (!rng.chance(rate)) return ind.clone();
  const genes = [...ind.genes];
  const i = rng.randInt(0, genes.length - 1);
  let j = rng.randInt(0, genes.length - 2);
  if (j >= i) j++;
  [genes[i], genes[j]] = [genes[j], genes[i]];
  return new Individual(genes);
}

/**
 * Inversion mutation: reverse a random sub-segment (for permutations).
 * @param {Individual} ind
 * @param {number} rate
 * @param {RNG} rng
 * @returns {Individual}
 */
export function inversionMutation(ind, rate, rng) {
  if (!rng.chance(rate)) return ind.clone();
  const genes = [...ind.genes];
  let a = rng.randInt(0, genes.length - 1);
  let b = rng.randInt(0, genes.length - 1);
  if (a > b) [a, b] = [b, a];
  while (a < b) {
    [genes[a], genes[b]] = [genes[b], genes[a]];
    a++; b--;
  }
  return new Individual(genes);
}

/**
 * Scramble mutation: randomly reorder a sub-segment.
 * @param {Individual} ind
 * @param {number} rate
 * @param {RNG} rng
 * @returns {Individual}
 */
export function scrambleMutation(ind, rate, rng) {
  if (!rng.chance(rate)) return ind.clone();
  const genes = [...ind.genes];
  let a = rng.randInt(0, genes.length - 1);
  let b = rng.randInt(0, genes.length - 1);
  if (a > b) [a, b] = [b, a];
  // Fisher-Yates on sub-segment
  for (let i = b; i > a; i--) {
    const j = rng.randInt(a, i);
    [genes[i], genes[j]] = [genes[j], genes[i]];
  }
  return new Individual(genes);
}
