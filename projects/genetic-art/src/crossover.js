/**
 * Crossover operators — combine two parents to produce offspring.
 */

import { Individual } from './individual.js';

/**
 * Single-point crossover: pick a random point, swap tails.
 * @param {Individual} p1
 * @param {Individual} p2
 * @param {RNG} rng
 * @returns {[Individual, Individual]}
 */
export function singlePointCrossover(p1, p2, rng) {
  const len = Math.min(p1.length, p2.length);
  const point = rng.randInt(1, len - 1);
  const c1 = [...p1.genes.slice(0, point), ...p2.genes.slice(point)];
  const c2 = [...p2.genes.slice(0, point), ...p1.genes.slice(point)];
  return [new Individual(c1), new Individual(c2)];
}

/**
 * Two-point crossover: pick two random points, swap the middle segment.
 * @param {Individual} p1
 * @param {Individual} p2
 * @param {RNG} rng
 * @returns {[Individual, Individual]}
 */
export function twoPointCrossover(p1, p2, rng) {
  const len = Math.min(p1.length, p2.length);
  let a = rng.randInt(0, len - 1);
  let b = rng.randInt(0, len - 1);
  if (a > b) [a, b] = [b, a];
  const c1 = [...p1.genes];
  const c2 = [...p2.genes];
  for (let i = a; i <= b; i++) {
    c1[i] = p2.genes[i];
    c2[i] = p1.genes[i];
  }
  return [new Individual(c1), new Individual(c2)];
}

/**
 * Uniform crossover: each gene independently from either parent.
 * @param {Individual} p1
 * @param {Individual} p2
 * @param {RNG} rng
 * @param {number} [bias=0.5] — probability of taking gene from p1
 * @returns {[Individual, Individual]}
 */
export function uniformCrossover(p1, p2, rng, bias = 0.5) {
  const len = Math.min(p1.length, p2.length);
  const c1 = new Array(len);
  const c2 = new Array(len);
  for (let i = 0; i < len; i++) {
    if (rng.random() < bias) {
      c1[i] = p1.genes[i];
      c2[i] = p2.genes[i];
    } else {
      c1[i] = p2.genes[i];
      c2[i] = p1.genes[i];
    }
  }
  return [new Individual(c1), new Individual(c2)];
}

/**
 * Blend crossover (BLX-α): for real-valued genes.
 * Each gene is sampled uniformly from [min-α*range, max+α*range].
 * @param {Individual} p1
 * @param {Individual} p2
 * @param {RNG} rng
 * @param {number} [alpha=0.5]
 * @returns {[Individual, Individual]}
 */
export function blendCrossover(p1, p2, rng, alpha = 0.5) {
  const len = Math.min(p1.length, p2.length);
  const c1 = new Array(len);
  const c2 = new Array(len);
  for (let i = 0; i < len; i++) {
    const lo = Math.min(p1.genes[i], p2.genes[i]);
    const hi = Math.max(p1.genes[i], p2.genes[i]);
    const range = hi - lo;
    const newLo = lo - alpha * range;
    const newHi = hi + alpha * range;
    c1[i] = rng.randFloat(newLo, newHi);
    c2[i] = rng.randFloat(newLo, newHi);
  }
  return [new Individual(c1), new Individual(c2)];
}

/**
 * Order crossover (OX1): for permutation-based encodings (e.g., TSP).
 * Preserves a segment from p1, fills rest with p2's order.
 * @param {Individual} p1
 * @param {Individual} p2
 * @param {RNG} rng
 * @returns {[Individual, Individual]}
 */
export function orderCrossover(p1, p2, rng) {
  const len = p1.length;
  let a = rng.randInt(0, len - 1);
  let b = rng.randInt(0, len - 1);
  if (a > b) [a, b] = [b, a];

  function ox(parent1, parent2) {
    const child = new Array(len).fill(-1);
    // Copy segment from parent1
    for (let i = a; i <= b; i++) {
      child[i] = parent1.genes[i];
    }
    // Fill rest from parent2 in order
    const inChild = new Set(child.filter(x => x !== -1));
    let pos = (b + 1) % len;
    let p2pos = (b + 1) % len;
    while (inChild.size < len) {
      const gene = parent2.genes[p2pos];
      if (!inChild.has(gene)) {
        child[pos] = gene;
        inChild.add(gene);
        pos = (pos + 1) % len;
      }
      p2pos = (p2pos + 1) % len;
    }
    return new Individual(child);
  }

  return [ox(p1, p2), ox(p2, p1)];
}
