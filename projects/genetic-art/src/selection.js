/**
 * Selection operators — choose parents from a population.
 */

/**
 * Tournament selection: pick `k` random individuals, return the best.
 * @param {Individual[]} pop — population
 * @param {number} k — tournament size (default 3)
 * @param {RNG} rng
 * @returns {Individual}
 */
export function tournamentSelect(pop, k, rng) {
  let best = null;
  for (let i = 0; i < k; i++) {
    const candidate = pop[rng.randInt(0, pop.length - 1)];
    if (best === null || candidate.fitness > best.fitness) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Roulette wheel selection (fitness-proportionate).
 * Requires all fitnesses to be non-negative.
 * @param {Individual[]} pop
 * @param {RNG} rng
 * @returns {Individual}
 */
export function rouletteSelect(pop, rng) {
  const totalFitness = pop.reduce((sum, ind) => sum + ind.fitness, 0);
  if (totalFitness === 0) {
    // All zero fitness — pick random
    return pop[rng.randInt(0, pop.length - 1)];
  }
  let spin = rng.random() * totalFitness;
  for (const ind of pop) {
    spin -= ind.fitness;
    if (spin <= 0) return ind;
  }
  return pop[pop.length - 1]; // fallback
}

/**
 * Rank-based selection: rank individuals by fitness, probability proportional to rank.
 * @param {Individual[]} pop
 * @param {RNG} rng
 * @returns {Individual}
 */
export function rankSelect(pop, rng) {
  const sorted = [...pop].sort((a, b) => a.fitness - b.fitness);
  const n = sorted.length;
  const totalRank = (n * (n + 1)) / 2;
  let spin = rng.random() * totalRank;
  for (let i = 0; i < n; i++) {
    spin -= (i + 1);
    if (spin <= 0) return sorted[i];
  }
  return sorted[n - 1];
}

/**
 * Stochastic Universal Sampling (SUS): select multiple individuals in one sweep.
 * @param {Individual[]} pop
 * @param {number} count — number to select
 * @param {RNG} rng
 * @returns {Individual[]}
 */
export function susSelect(pop, count, rng) {
  const totalFitness = pop.reduce((sum, ind) => sum + ind.fitness, 0);
  if (totalFitness === 0) {
    return Array.from({ length: count }, () => pop[rng.randInt(0, pop.length - 1)]);
  }
  const step = totalFitness / count;
  let start = rng.random() * step;
  const selected = [];
  let cumulative = 0;
  let i = 0;
  for (let s = 0; s < count; s++) {
    const pointer = start + s * step;
    while (cumulative + pop[i].fitness < pointer && i < pop.length - 1) {
      cumulative += pop[i].fitness;
      i++;
    }
    selected.push(pop[i]);
  }
  return selected;
}
