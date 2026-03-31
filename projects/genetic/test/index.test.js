const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GA } = require('../src/index.js');

test('maximize ones (OneMax)', () => {
  const ga = new GA({
    populationSize: 50,
    chromosomeLength: 20,
    mutationRate: 0.05,
    fitness: chrom => chrom.reduce((s, g) => s + g, 0),
  });
  const result = ga.run(100);
  assert.ok(result.fitness >= 15, `Expected >=15, got ${result.fitness}`);
});

test('history tracked', () => {
  const ga = new GA({
    populationSize: 20,
    chromosomeLength: 10,
    fitness: chrom => chrom.reduce((s, g) => s + g, 0),
  });
  ga.run(10);
  assert.equal(ga.history.length, 10);
  assert.ok('best' in ga.history[0]);
  assert.ok('avg' in ga.history[0]);
});

test('elitism preserves best', () => {
  const ga = new GA({
    populationSize: 10,
    chromosomeLength: 5,
    elitism: 2,
    fitness: chrom => chrom.reduce((s, g) => s + g, 0),
  });
  ga.init();
  const before = ga.evaluate();
  ga.step();
  const after = ga.evaluate();
  // Best should not decrease due to elitism
  assert.ok(after[0].fitness >= before[0].fitness - 1);
});

test('custom gene pool', () => {
  const ga = new GA({
    populationSize: 20,
    chromosomeLength: 5,
    genePool: ['A', 'B', 'C'],
    fitness: chrom => chrom.filter(g => g === 'A').length,
  });
  const result = ga.run(50);
  assert.ok(result.fitness >= 3);
});

test('roulette selection', () => {
  const ga = new GA({
    populationSize: 20,
    chromosomeLength: 10,
    selection: 'roulette',
    fitness: chrom => chrom.reduce((s, g) => s + g, 0),
  });
  const result = ga.run(30);
  assert.ok(result.fitness > 0);
});

test('two-point crossover', () => {
  const ga = new GA({
    populationSize: 30,
    chromosomeLength: 10,
    crossover: 'two',
    fitness: chrom => chrom.reduce((s, g) => s + g, 0),
  });
  const result = ga.run(50);
  assert.ok(result.fitness >= 5);
});

test('uniform crossover', () => {
  const ga = new GA({
    populationSize: 30,
    chromosomeLength: 10,
    crossover: 'uniform',
    fitness: chrom => chrom.reduce((s, g) => s + g, 0),
  });
  const result = ga.run(50);
  assert.ok(result.fitness >= 5);
});

test('fitness improves over generations', () => {
  const ga = new GA({
    populationSize: 40,
    chromosomeLength: 20,
    fitness: chrom => chrom.reduce((s, g) => s + g, 0),
  });
  ga.run(50);
  const firstAvg = ga.history[0].avg;
  const lastAvg = ga.history[ga.history.length - 1].avg;
  assert.ok(lastAvg >= firstAvg, `Expected improvement: ${firstAvg} -> ${lastAvg}`);
});
