/**
 * Classic optimization fitness functions for benchmarking GAs.
 */

/**
 * OneMax — maximize sum of binary string.
 * Optimal: all ones, fitness = length.
 * @param {number[]} genes — binary array
 * @returns {number}
 */
export function oneMax(genes) {
  return genes.reduce((sum, g) => sum + g, 0);
}

/**
 * Rastrigin function (minimization).
 * Global minimum at origin, fitness = 0.
 * Many local minima make this hard for GAs.
 * We negate it for maximization: higher = better.
 * @param {number[]} genes — real-valued
 * @returns {number} negative Rastrigin value
 */
export function rastrigin(genes) {
  const A = 10;
  const n = genes.length;
  let sum = A * n;
  for (const x of genes) {
    sum += x * x - A * Math.cos(2 * Math.PI * x);
  }
  return -sum; // negate for maximization
}

/**
 * Schwefel function (minimization, negated for maximization).
 * Global minimum at ~420.9687 in each dimension.
 * Deceptive — global minimum far from next-best local minima.
 * @param {number[]} genes — real-valued, typically in [-500, 500]
 * @returns {number}
 */
export function schwefel(genes) {
  const n = genes.length;
  let sum = 418.9829 * n;
  for (const x of genes) {
    sum -= x * Math.sin(Math.sqrt(Math.abs(x)));
  }
  return -sum; // negate for maximization
}

/**
 * Sphere function (minimization, negated).
 * Simple unimodal function. Global minimum at origin.
 * @param {number[]} genes
 * @returns {number}
 */
export function sphere(genes) {
  return -genes.reduce((sum, x) => sum + x * x, 0);
}

/**
 * Ackley function (minimization, negated).
 * Multimodal with a large nearly-flat outer region.
 * Global minimum at origin = 0.
 * @param {number[]} genes
 * @returns {number}
 */
export function ackley(genes) {
  const n = genes.length;
  const sumSq = genes.reduce((s, x) => s + x * x, 0);
  const sumCos = genes.reduce((s, x) => s + Math.cos(2 * Math.PI * x), 0);
  const val = -20 * Math.exp(-0.2 * Math.sqrt(sumSq / n))
            - Math.exp(sumCos / n)
            + 20 + Math.E;
  return -val;
}

/**
 * Rosenbrock function (minimization, negated).
 * "Banana" function. Global minimum at (1, 1, ..., 1) = 0.
 * @param {number[]} genes
 * @returns {number}
 */
export function rosenbrock(genes) {
  let sum = 0;
  for (let i = 0; i < genes.length - 1; i++) {
    sum += 100 * (genes[i + 1] - genes[i] ** 2) ** 2 + (1 - genes[i]) ** 2;
  }
  return -sum;
}

/**
 * Traveling Salesman Problem (TSP) fitness.
 * Given a distance matrix, returns negative tour length (higher = shorter tour = better).
 * @param {number[][]} distMatrix — n×n distance matrix
 * @returns {Function} fitness function for permutation-encoded individuals
 */
export function tspFitness(distMatrix) {
  return (genes) => {
    let dist = 0;
    for (let i = 0; i < genes.length - 1; i++) {
      dist += distMatrix[genes[i]][genes[i + 1]];
    }
    // Return to start
    dist += distMatrix[genes[genes.length - 1]][genes[0]];
    return -dist; // negate: shorter tour = higher fitness
  };
}

/**
 * Create a random symmetric distance matrix for TSP.
 * @param {number} n — number of cities
 * @param {RNG} rng
 * @param {number} [maxDist=100]
 * @returns {number[][]}
 */
export function randomDistanceMatrix(n, rng, maxDist = 100) {
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = rng.randFloat(1, maxDist);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }
  return matrix;
}

/**
 * Create a Euclidean distance matrix from 2D city coordinates.
 * @param {Array<[number, number]>} cities — array of [x, y] coordinates
 * @returns {number[][]}
 */
export function euclideanDistanceMatrix(cities) {
  const n = cities.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = cities[i][0] - cities[j][0];
      const dy = cities[i][1] - cities[j][1];
      const d = Math.sqrt(dx * dx + dy * dy);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }
  return matrix;
}
