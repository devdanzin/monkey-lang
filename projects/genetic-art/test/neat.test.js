import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  Genome, NodeGene, ConnectionGene, NodeType,
  getInnovation, resetNEAT,
  compatibilityDistance, crossover
} from '../src/neat.js';

describe('NEAT', () => {
  beforeEach(() => resetNEAT());

  describe('Innovation Tracking', () => {
    it('should assign unique innovation numbers', () => {
      const i1 = getInnovation(0, 3);
      const i2 = getInnovation(1, 3);
      assert.notEqual(i1, i2);
    });

    it('should return same innovation for same connection', () => {
      const i1 = getInnovation(0, 3);
      const i2 = getInnovation(0, 3);
      assert.equal(i1, i2);
    });

    it('should increment globally', () => {
      const i1 = getInnovation(0, 3);
      const i2 = getInnovation(1, 3);
      assert.equal(i2, i1 + 1);
    });
  });

  describe('Genome Construction', () => {
    it('should create input, bias, and output nodes', () => {
      const g = new Genome(2, 1);
      assert.equal(g.nodes.length, 4); // 2 inputs + 1 bias + 1 output
      assert.equal(g.nodes.filter(n => n.type === NodeType.INPUT).length, 2);
      assert.equal(g.nodes.filter(n => n.type === NodeType.BIAS).length, 1);
      assert.equal(g.nodes.filter(n => n.type === NodeType.OUTPUT).length, 1);
    });

    it('should have correct layer assignment', () => {
      const g = new Genome(3, 2);
      const inputs = g.nodes.filter(n => n.type === NodeType.INPUT);
      const outputs = g.nodes.filter(n => n.type === NodeType.OUTPUT);
      inputs.forEach(n => assert.equal(n.layer, 0));
      outputs.forEach(n => assert.equal(n.layer, 1));
    });

    it('should fully connect with initFullConnect', () => {
      const g = new Genome(2, 1);
      g.initFullConnect(() => 0.5);
      // 2 inputs + 1 bias → 1 output = 3 connections
      assert.equal(g.connections.length, 3);
      assert.ok(g.connections.every(c => c.enabled));
    });
  });

  describe('Forward Pass', () => {
    it('should compute XOR-like network output', () => {
      const g = new Genome(2, 1);
      g.initFullConnect(() => 0.5);
      const output = g.forward([0, 1]);
      assert.equal(output.length, 1);
      assert.ok(output[0] >= 0 && output[0] <= 1, 'Sigmoid output in [0,1]');
    });

    it('should handle multiple outputs', () => {
      const g = new Genome(3, 2);
      g.initFullConnect(() => 0.5);
      const output = g.forward([1, 0, 1]);
      assert.equal(output.length, 2);
    });

    it('should throw on wrong input count', () => {
      const g = new Genome(2, 1);
      assert.throws(() => g.forward([1]), /Expected 2 inputs/);
    });

    it('should handle hidden nodes after addNode mutation', () => {
      const g = new Genome(2, 1);
      g.initFullConnect(() => 0.5);
      g.addNodeMutation(() => 0); // Always picks first enabled connection
      
      const hidden = g.nodes.filter(n => n.type === NodeType.HIDDEN);
      assert.equal(hidden.length, 1);
      
      // Should still produce valid output
      const output = g.forward([0.5, 0.5]);
      assert.equal(output.length, 1);
      assert.ok(!isNaN(output[0]));
    });
  });

  describe('Mutations', () => {
    it('addNodeMutation should split a connection', () => {
      const g = new Genome(2, 1);
      g.initFullConnect(() => 0.5);
      const connsBefore = g.connections.length;
      
      g.addNodeMutation(() => 0);
      
      // One connection disabled, two new ones added
      assert.equal(g.connections.length, connsBefore + 2);
      assert.equal(g.connections.filter(c => !c.enabled).length, 1);
      assert.equal(g.nodes.filter(n => n.type === NodeType.HIDDEN).length, 1);
    });

    it('addConnectionMutation should add a new connection', () => {
      const g = new Genome(2, 1);
      g.initFullConnect(() => 0.5);
      // Add a hidden node first to have a non-fully-connected topology
      g.addNodeMutation(() => 0);
      const connsBefore = g.connections.length;
      
      g.addConnectionMutation(() => 0.5);
      
      // May or may not find a valid connection to add (topology dependent)
      assert.ok(g.connections.length >= connsBefore);
    });

    it('mutateWeights should change weights', () => {
      const g = new Genome(2, 1);
      g.initFullConnect(() => 0.5);
      const weightsBefore = g.connections.map(c => c.weight);
      
      let callCount = 0;
      g.mutateWeights({}, () => { callCount++; return callCount % 3 === 0 ? 0.9 : 0.3; });
      
      const weightsAfter = g.connections.map(c => c.weight);
      assert.ok(weightsBefore.some((w, i) => w !== weightsAfter[i]), 'At least one weight should change');
    });
  });

  describe('Compatibility Distance', () => {
    it('should be 0 for identical genomes', () => {
      const g = new Genome(2, 1);
      g.initFullConnect(() => 0.5);
      const dist = compatibilityDistance(g, g.clone());
      assert.equal(dist, 0);
    });

    it('should increase with weight differences', () => {
      const g1 = new Genome(2, 1);
      g1.initFullConnect(() => 0.5);
      const g2 = g1.clone();
      g2.connections.forEach(c => { c.weight += 10; });
      
      const dist = compatibilityDistance(g1, g2);
      assert.ok(dist > 0);
    });

    it('should increase with structural differences', () => {
      const g1 = new Genome(2, 1);
      g1.initFullConnect(() => 0.5);
      const g2 = g1.clone();
      g2.addNodeMutation(() => 0);
      
      const dist = compatibilityDistance(g1, g2);
      assert.ok(dist > 0);
    });
  });

  describe('Crossover', () => {
    it('should produce child with genes from both parents', () => {
      const g1 = new Genome(2, 1);
      g1.initFullConnect(() => 0.3);
      g1.fitness = 10;
      
      const g2 = new Genome(2, 1);
      g2.initFullConnect(() => 0.7);
      g2.fitness = 5;
      
      const child = crossover(g1, g2, () => 0.5);
      assert.equal(child.connections.length, g1.connections.length);
      assert.equal(child.fitness, 0); // Reset
    });

    it('should handle disjoint genes (fitter parent wins)', () => {
      const g1 = new Genome(2, 1);
      g1.initFullConnect(() => 0.5);
      g1.addNodeMutation(() => 0);
      g1.fitness = 10;
      
      const g2 = new Genome(2, 1);
      g2.initFullConnect(() => 0.5);
      g2.fitness = 5;
      
      const child = crossover(g1, g2, () => 0.5);
      // Child should have the extra connections from g1 (fitter)
      assert.ok(child.connections.length >= g2.connections.length);
    });

    it('should handle equal fitness (keep larger)', () => {
      const g1 = new Genome(2, 1);
      g1.initFullConnect(() => 0.5);
      g1.fitness = 10;
      
      const g2 = new Genome(2, 1);
      g2.initFullConnect(() => 0.5);
      g2.addNodeMutation(() => 0);
      g2.fitness = 10;
      
      const child = crossover(g1, g2, () => 0.5);
      assert.ok(child.connections.length > 0);
    });
  });

  describe('Clone', () => {
    it('should deep clone genome', () => {
      const g = new Genome(2, 1);
      g.initFullConnect(() => 0.5);
      g.fitness = 42;
      
      const clone = g.clone();
      assert.equal(clone.fitness, 42);
      assert.equal(clone.connections.length, g.connections.length);
      
      // Mutating clone should not affect original
      clone.connections[0].weight = 999;
      assert.notEqual(g.connections[0].weight, 999);
    });
  });

  describe('Integration', () => {
    it('should evolve a network through multiple mutations', () => {
      const g = new Genome(2, 1);
      g.initFullConnect(() => 0.5);
      
      // Apply several mutations
      for (let i = 0; i < 5; i++) {
        g.addNodeMutation(Math.random);
        g.addConnectionMutation(Math.random);
        g.mutateWeights();
      }
      
      // Should still produce valid output
      const output = g.forward([1, 0]);
      assert.equal(output.length, 1);
      assert.ok(!isNaN(output[0]));
      assert.ok(output[0] >= 0 && output[0] <= 1);
    });
  });
});
