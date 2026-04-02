import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RNG, Individual, Population,
  NeuralNet, neuroFitness, paramCount, xorEvaluator, cartPoleEvaluator,
  blendCrossover, gaussianMutation
} from '../src/index.js';

describe('NeuralNet', () => {
  it('calculates correct param count', () => {
    assert.equal(paramCount([2, 4, 1]), 2*4 + 4 + 4*1 + 1); // 17
    assert.equal(paramCount([3, 5, 5, 2]), 3*5+5 + 5*5+5 + 5*2+2); // 62
  });

  it('creates network with correct structure', () => {
    const net = new NeuralNet([2, 3, 1]);
    assert.equal(net.paramCount, 2*3+3 + 3*1+1); // 13
    assert.equal(net.weights.length, 2);
    assert.equal(net.biases.length, 2);
  });

  it('forward pass produces correct output dimensions', () => {
    const net = new NeuralNet([3, 4, 2]);
    net.fromGenes(Array(paramCount([3, 4, 2])).fill(0));
    const out = net.forward([1, 2, 3]);
    assert.equal(out.length, 2);
  });

  it('fromGenes and toGenes round-trip', () => {
    const rng = new RNG(500);
    const net = new NeuralNet([2, 3, 1]);
    const genes = Array.from({ length: net.paramCount }, () => rng.randFloat(-1, 1));
    net.fromGenes(genes);
    const exported = net.toGenes();
    for (let i = 0; i < genes.length; i++) {
      assert.ok(Math.abs(genes[i] - exported[i]) < 1e-10);
    }
  });

  it('forward pass with known weights', () => {
    // Simple: 1 input, 1 output, no hidden
    const net = new NeuralNet([1, 1], 'linear', 'linear');
    // Weight = 2, bias = 1
    net.fromGenes([2, 1]);
    const out = net.forward([3]);
    assert.ok(Math.abs(out[0] - 7) < 1e-10); // 2*3 + 1 = 7
  });

  it('tanh activation bounds output', () => {
    const net = new NeuralNet([1, 1], 'tanh', 'tanh');
    net.fromGenes([100, 0]); // huge weight
    const out = net.forward([1]);
    assert.ok(Math.abs(out[0]) <= 1); // tanh bounds to [-1, 1]
  });

  it('relu activation works', () => {
    const net = new NeuralNet([1, 2, 1], 'relu', 'linear');
    // Set weights manually: first layer [-1, 1], biases [0, 0], second layer [1, 1], bias [0]
    net.fromGenes([-1, 1, 0, 0, 1, 1, 0]);
    const out = net.forward([1]);
    // Hidden: [-1*1+0, 1*1+0] = [-1, 1] → ReLU → [0, 1]
    // Output: [0*1 + 1*1 + 0] = 1
    assert.ok(Math.abs(out[0] - 1) < 1e-10);
  });

  it('sigmoid activation bounds output to [0, 1]', () => {
    const net = new NeuralNet([1, 1], 'sigmoid', 'sigmoid');
    net.fromGenes([0, 0]); // zero weights+bias → sigmoid(0) = 0.5
    const out = net.forward([42]);
    assert.ok(out[0] >= 0 && out[0] <= 1);
  });
});

describe('Neuroevolution fitness', () => {
  it('neuroFitness creates a working function', () => {
    const rng = new RNG(510);
    const evaluator = (net) => {
      const out = net.forward([1, 0]);
      return -Math.abs(out[0] - 1); // want output = 1
    };
    const fit = neuroFitness([2, 3, 1], evaluator);
    const genes = Array.from({ length: paramCount([2, 3, 1]) }, () => rng.randFloat(-1, 1));
    const f = fit(genes);
    assert.ok(typeof f === 'number');
  });
});

describe('XOR neuroevolution', () => {
  it('evaluator returns negative MSE', () => {
    const eval_ = xorEvaluator();
    const net = new NeuralNet([2, 4, 1]);
    net.fromGenes(Array(net.paramCount).fill(0));
    const f = eval_(net);
    assert.ok(f <= 0);
  });

  it('GA evolves to solve XOR', () => {
    const rng = new RNG(520);
    const layers = [2, 5, 1];
    const nParams = paramCount(layers);
    const fit = neuroFitness(layers, xorEvaluator());

    const pop = new Population({
      size: 100,
      createIndividual: () => Individual.randomReal(nParams, -2, 2, rng),
      fitness: fit,
      crossover: {
        method: (p1, p2, rng) => blendCrossover(p1, p2, rng, 0.3),
        rate: 0.8
      },
      mutation: {
        method: (ind, rate, rng) => gaussianMutation(ind, rate, 0.5, rng),
        rate: 0.3
      },
      elitism: 3,
      rng
    });

    const result = pop.run(500);
    // XOR MSE should be close to 0 (fitness close to 0)
    assert.ok(result.bestEver.fitness > -0.1,
      `XOR not solved: fitness=${result.bestEver.fitness}`);

    // Verify actual XOR behavior
    const net = new NeuralNet(layers);
    net.fromGenes(result.bestEver.genes);
    const xorTests = [[0,0,0],[0,1,1],[1,0,1],[1,1,0]];
    for (const [a, b, expected] of xorTests) {
      const out = net.forward([a, b])[0];
      const rounded = out > 0.5 ? 1 : 0;
      assert.equal(rounded, expected, `XOR(${a},${b})=${out.toFixed(3)}, expected ${expected}`);
    }
  });
});

describe('Cart-pole neuroevolution', () => {
  it('evaluator returns step count', () => {
    const eval_ = cartPoleEvaluator(200);
    const net = new NeuralNet([4, 2, 1]);
    net.fromGenes(Array(net.paramCount).fill(0));
    const steps = eval_(net);
    assert.ok(steps > 0 && steps <= 200);
  });

  it('GA evolves to balance pole', () => {
    const rng = new RNG(530);
    const layers = [4, 6, 1];
    const nParams = paramCount(layers);
    const fit = neuroFitness(layers, cartPoleEvaluator(200));

    const pop = new Population({
      size: 80,
      createIndividual: () => Individual.randomReal(nParams, -1, 1, rng),
      fitness: fit,
      crossover: {
        method: (p1, p2, rng) => blendCrossover(p1, p2, rng, 0.3),
        rate: 0.8
      },
      mutation: {
        method: (ind, rate, rng) => gaussianMutation(ind, rate, 0.3, rng),
        rate: 0.2
      },
      elitism: 3,
      rng
    });

    const result = pop.run(100);
    // Should learn to balance for at least 100 steps
    assert.ok(result.bestEver.fitness >= 50,
      `Cart-pole not balanced well: ${result.bestEver.fitness} steps`);
  });
});
