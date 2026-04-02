/**
 * NEAT — NeuroEvolution of Augmenting Topologies
 * 
 * Evolves both the topology and weights of neural networks.
 * Based on Kenneth O. Stanley's NEAT (2002).
 * 
 * Key concepts:
 * - Connection genes with innovation numbers for tracking structural changes
 * - Speciation to protect innovation through compatibility distance
 * - Crossover aligned by innovation number
 * - Structural mutations: add node, add connection
 */

// --- Innovation Tracking ---

let globalInnovation = 0;
const innovationHistory = new Map(); // "srcNode→dstNode" → innovation number

/**
 * Get or create an innovation number for a connection.
 * Same structural mutation in the same generation gets the same number.
 */
export function getInnovation(srcNode, dstNode) {
  const key = `${srcNode}→${dstNode}`;
  if (innovationHistory.has(key)) return innovationHistory.get(key);
  const num = ++globalInnovation;
  innovationHistory.set(key, num);
  return num;
}

/**
 * Reset innovation tracking (call between generations if desired).
 */
export function resetInnovations() {
  innovationHistory.clear();
}

/**
 * Reset all state (for testing).
 */
export function resetNEAT() {
  globalInnovation = 0;
  innovationHistory.clear();
}

// --- Node Types ---
export const NodeType = {
  INPUT: 'input',
  OUTPUT: 'output',
  HIDDEN: 'hidden',
  BIAS: 'bias',
};

// --- Connection Gene ---

export class ConnectionGene {
  /**
   * @param {number} srcNode - Source node ID
   * @param {number} dstNode - Destination node ID
   * @param {number} weight - Connection weight
   * @param {boolean} enabled - Whether this connection is active
   * @param {number} innovation - Innovation number
   */
  constructor(srcNode, dstNode, weight, enabled, innovation) {
    this.srcNode = srcNode;
    this.dstNode = dstNode;
    this.weight = weight;
    this.enabled = enabled;
    this.innovation = innovation;
  }

  clone() {
    return new ConnectionGene(this.srcNode, this.dstNode, this.weight, this.enabled, this.innovation);
  }
}

// --- Node Gene ---

export class NodeGene {
  /**
   * @param {number} id - Unique node ID
   * @param {string} type - NodeType
   * @param {number} [layer=0] - Topological layer (for sorting during forward pass)
   */
  constructor(id, type, layer = 0) {
    this.id = id;
    this.type = type;
    this.layer = layer;
  }

  clone() {
    return new NodeGene(this.id, this.type, this.layer);
  }
}

// --- Genome ---

export class Genome {
  /**
   * @param {number} numInputs - Number of input nodes (excluding bias)
   * @param {number} numOutputs - Number of output nodes
   */
  constructor(numInputs, numOutputs) {
    this.numInputs = numInputs;
    this.numOutputs = numOutputs;
    this.nodes = [];       // NodeGene[]
    this.connections = [];  // ConnectionGene[]
    this.fitness = 0;
    this.adjustedFitness = 0;
    this.species = -1;
    this._nextNodeId = 0;

    // Create input nodes (layer 0)
    for (let i = 0; i < numInputs; i++) {
      this.nodes.push(new NodeGene(this._nextNodeId++, NodeType.INPUT, 0));
    }

    // Bias node (layer 0)
    this.biasNode = this._nextNodeId;
    this.nodes.push(new NodeGene(this._nextNodeId++, NodeType.BIAS, 0));

    // Output nodes (layer 1)
    for (let i = 0; i < numOutputs; i++) {
      this.nodes.push(new NodeGene(this._nextNodeId++, NodeType.OUTPUT, 1));
    }
  }

  /**
   * Initialize with full connectivity (all inputs → all outputs).
   * @param {Function} [rng=Math.random] - RNG for weight initialization
   */
  initFullConnect(rng = Math.random) {
    const inputIds = this.nodes.filter(n => n.type === NodeType.INPUT || n.type === NodeType.BIAS).map(n => n.id);
    const outputIds = this.nodes.filter(n => n.type === NodeType.OUTPUT).map(n => n.id);

    for (const src of inputIds) {
      for (const dst of outputIds) {
        const weight = (rng() * 2 - 1) * 2; // [-2, 2]
        const innovation = getInnovation(src, dst);
        this.connections.push(new ConnectionGene(src, dst, weight, true, innovation));
      }
    }
  }

  /**
   * Add a new hidden node by splitting an existing connection.
   * The old connection is disabled, and two new connections are created:
   *   src → newNode (weight 1.0) → dst (old weight)
   * @param {Function} [rng=Math.random]
   */
  addNodeMutation(rng = Math.random) {
    const enabled = this.connections.filter(c => c.enabled);
    if (enabled.length === 0) return;

    const conn = enabled[Math.floor(rng() * enabled.length)];
    conn.enabled = false;

    // Determine layer for new node
    const srcNode = this.nodes.find(n => n.id === conn.srcNode);
    const dstNode = this.nodes.find(n => n.id === conn.dstNode);
    const newLayer = (srcNode.layer + dstNode.layer) / 2;

    // Adjust dst layer if needed (ensure forward direction)
    if (newLayer >= dstNode.layer) {
      dstNode.layer = newLayer + 1;
      // Cascade: update all nodes reachable from dst
      this._updateLayers();
    }

    const newNode = new NodeGene(this._nextNodeId++, NodeType.HIDDEN, newLayer);
    this.nodes.push(newNode);

    // src → newNode with weight 1.0
    const innov1 = getInnovation(conn.srcNode, newNode.id);
    this.connections.push(new ConnectionGene(conn.srcNode, newNode.id, 1.0, true, innov1));

    // newNode → dst with old weight
    const innov2 = getInnovation(newNode.id, conn.dstNode);
    this.connections.push(new ConnectionGene(newNode.id, conn.dstNode, conn.weight, true, innov2));
  }

  /**
   * Add a new connection between two random unconnected nodes.
   * Ensures the connection goes forward (src.layer < dst.layer).
   * @param {Function} [rng=Math.random]
   * @param {number} [maxAttempts=20]
   */
  addConnectionMutation(rng = Math.random, maxAttempts = 20) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const src = this.nodes[Math.floor(rng() * this.nodes.length)];
      const dst = this.nodes[Math.floor(rng() * this.nodes.length)];

      // Must go forward
      if (src.layer >= dst.layer) continue;
      // Can't connect to input/bias
      if (dst.type === NodeType.INPUT || dst.type === NodeType.BIAS) continue;
      // Check if connection already exists
      if (this.connections.some(c => c.srcNode === src.id && c.dstNode === dst.id)) continue;

      const weight = (rng() * 2 - 1) * 2;
      const innovation = getInnovation(src.id, dst.id);
      this.connections.push(new ConnectionGene(src.id, dst.id, weight, true, innovation));
      return;
    }
  }

  /**
   * Mutate connection weights.
   * @param {Object} opts
   * @param {number} [opts.perturbRate=0.8] - Chance of perturbing (vs replacing)
   * @param {number} [opts.perturbAmount=0.5] - Max perturbation
   * @param {number} [opts.mutateRate=0.8] - Chance each weight is mutated
   * @param {Function} [rng=Math.random]
   */
  mutateWeights({ perturbRate = 0.8, perturbAmount = 0.5, mutateRate = 0.8 } = {}, rng = Math.random) {
    for (const conn of this.connections) {
      if (rng() < mutateRate) {
        if (rng() < perturbRate) {
          conn.weight += (rng() * 2 - 1) * perturbAmount;
        } else {
          conn.weight = (rng() * 2 - 1) * 2;
        }
      }
    }
  }

  /**
   * Forward pass through the network.
   * Uses topological ordering by node layer.
   * @param {number[]} inputs - Input values (length must match numInputs)
   * @returns {number[]} Output values
   */
  forward(inputs) {
    if (inputs.length !== this.numInputs) {
      throw new Error(`Expected ${this.numInputs} inputs, got ${inputs.length}`);
    }

    const values = new Map();

    // Set input values
    for (let i = 0; i < this.numInputs; i++) {
      values.set(this.nodes[i].id, inputs[i]);
    }
    // Bias node = 1
    values.set(this.biasNode, 1.0);

    // Sort nodes by layer (topological order)
    const sortedNodes = [...this.nodes].sort((a, b) => a.layer - b.layer);

    // Process each non-input node
    for (const node of sortedNodes) {
      if (node.type === NodeType.INPUT || node.type === NodeType.BIAS) continue;

      let sum = 0;
      for (const conn of this.connections) {
        if (conn.dstNode === node.id && conn.enabled) {
          const srcVal = values.get(conn.srcNode) || 0;
          sum += srcVal * conn.weight;
        }
      }
      // Sigmoid activation for all non-input nodes
      values.set(node.id, 1 / (1 + Math.exp(-4.9 * sum))); // NEAT's modified sigmoid
    }

    // Collect outputs
    const outputNodes = this.nodes.filter(n => n.type === NodeType.OUTPUT);
    return outputNodes.map(n => values.get(n.id) || 0);
  }

  /**
   * Update node layers to maintain topological ordering.
   * Uses BFS from input nodes.
   */
  _updateLayers() {
    const inputNodes = this.nodes.filter(n => n.type === NodeType.INPUT || n.type === NodeType.BIAS);
    inputNodes.forEach(n => { n.layer = 0; });

    // Build adjacency from connections
    let changed = true;
    while (changed) {
      changed = false;
      for (const conn of this.connections) {
        if (!conn.enabled) continue;
        const src = this.nodes.find(n => n.id === conn.srcNode);
        const dst = this.nodes.find(n => n.id === conn.dstNode);
        if (src && dst && dst.layer <= src.layer) {
          dst.layer = src.layer + 1;
          changed = true;
        }
      }
    }
  }

  /**
   * Count enabled connections.
   */
  get size() {
    return this.connections.filter(c => c.enabled).length;
  }

  /**
   * Deep clone this genome.
   */
  clone() {
    const g = new Genome(0, 0);
    g.numInputs = this.numInputs;
    g.numOutputs = this.numOutputs;
    g.nodes = this.nodes.map(n => n.clone());
    g.connections = this.connections.map(c => c.clone());
    g.fitness = this.fitness;
    g.adjustedFitness = this.adjustedFitness;
    g.species = this.species;
    g._nextNodeId = this._nextNodeId;
    g.biasNode = this.biasNode;
    return g;
  }
}

// --- Compatibility Distance ---

/**
 * Compute compatibility distance between two genomes.
 * Used for speciation decisions.
 * δ = c1·E/N + c2·D/N + c3·W̄
 * where E=excess, D=disjoint, W̄=avg weight difference of matching genes
 * @param {Genome} g1
 * @param {Genome} g2
 * @param {Object} opts - { c1, c2, c3 }
 * @returns {number}
 */
export function compatibilityDistance(g1, g2, { c1 = 1.0, c2 = 1.0, c3 = 0.4 } = {}) {
  const conns1 = new Map(g1.connections.map(c => [c.innovation, c]));
  const conns2 = new Map(g2.connections.map(c => [c.innovation, c]));

  const maxInnov1 = g1.connections.length > 0 ? Math.max(...g1.connections.map(c => c.innovation)) : 0;
  const maxInnov2 = g2.connections.length > 0 ? Math.max(...g2.connections.map(c => c.innovation)) : 0;
  const maxInnovShared = Math.min(maxInnov1, maxInnov2);

  let disjoint = 0;
  let excess = 0;
  let matchingWeightDiff = 0;
  let matchingCount = 0;

  const allInnovations = new Set([...conns1.keys(), ...conns2.keys()]);
  for (const innov of allInnovations) {
    const in1 = conns1.has(innov);
    const in2 = conns2.has(innov);

    if (in1 && in2) {
      matchingWeightDiff += Math.abs(conns1.get(innov).weight - conns2.get(innov).weight);
      matchingCount++;
    } else if (innov > maxInnovShared) {
      excess++;
    } else {
      disjoint++;
    }
  }

  const N = Math.max(g1.connections.length, g2.connections.length, 1);
  const avgW = matchingCount > 0 ? matchingWeightDiff / matchingCount : 0;

  return (c1 * excess / N) + (c2 * disjoint / N) + (c3 * avgW);
}

// --- Crossover ---

/**
 * Crossover two genomes. Genes are aligned by innovation number.
 * Matching genes randomly inherited. Disjoint/excess from fitter parent.
 * @param {Genome} parent1 - First parent (assumed fitter if equal fitness)
 * @param {Genome} parent2 - Second parent
 * @param {Function} [rng=Math.random]
 * @returns {Genome}
 */
export function crossover(parent1, parent2, rng = Math.random) {
  // Ensure parent1 is the fitter parent
  let p1 = parent1, p2 = parent2;
  if (p2.fitness > p1.fitness) [p1, p2] = [p2, p1];

  const child = p1.clone();
  child.connections = [];
  child.fitness = 0;
  child.adjustedFitness = 0;

  const p2Conns = new Map(p2.connections.map(c => [c.innovation, c]));

  for (const conn1 of p1.connections) {
    if (p2Conns.has(conn1.innovation)) {
      // Matching gene — randomly pick from either parent
      const conn2 = p2Conns.get(conn1.innovation);
      const chosen = rng() < 0.5 ? conn1 : conn2;
      const gene = chosen.clone();
      // If either parent has it disabled, 75% chance child inherits as disabled
      if (!conn1.enabled || !conn2.enabled) {
        gene.enabled = rng() > 0.75;
      }
      child.connections.push(gene);
    } else {
      // Disjoint/excess — inherit from fitter parent (p1)
      child.connections.push(conn1.clone());
    }
  }

  return child;
}
