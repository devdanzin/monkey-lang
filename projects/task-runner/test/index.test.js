import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TaskRunner } from '../src/index.js';

describe('TaskRunner — basic', () => {
  it('runs simple task', async () => {
    const tr = new TaskRunner();
    tr.task('hello', () => 'world');
    assert.equal(await tr.run('hello'), 'world');
  });

  it('runs task with dependencies', async () => {
    const tr = new TaskRunner();
    tr.task('a', () => 1);
    tr.task('b', ['a'], (deps) => deps.a + 10);
    assert.equal(await tr.run('b'), 11);
  });

  it('caches results', async () => {
    const tr = new TaskRunner();
    let count = 0;
    tr.task('x', () => ++count);
    await tr.run('x');
    await tr.run('x');
    assert.equal(count, 1);
  });

  it('throws on missing task', async () => {
    const tr = new TaskRunner();
    await assert.rejects(() => tr.run('nope'));
  });

  it('throws on circular dependency', async () => {
    const tr = new TaskRunner();
    tr.task('a', ['b'], () => 1);
    tr.task('b', ['a'], () => 2);
    await assert.rejects(() => tr.run('a'), /Circular/);
  });
});

describe('TaskRunner — complex', () => {
  it('diamond dependency', async () => {
    const tr = new TaskRunner();
    const log = [];
    tr.task('a', () => { log.push('a'); return 1; });
    tr.task('b', ['a'], (d) => { log.push('b'); return d.a + 1; });
    tr.task('c', ['a'], (d) => { log.push('c'); return d.a + 2; });
    tr.task('d', ['b', 'c'], (d) => { log.push('d'); return d.b + d.c; });
    
    const result = await tr.run('d');
    assert.equal(result, 5); // (1+1) + (1+2)
    assert.equal(log.indexOf('a') < log.indexOf('b'), true);
    assert.equal(log.indexOf('a') < log.indexOf('c'), true);
  });

  it('runAll', async () => {
    const tr = new TaskRunner();
    tr.task('x', () => 10);
    tr.task('y', () => 20);
    const results = await tr.runAll(['x', 'y']);
    assert.deepEqual(results, { x: 10, y: 20 });
  });
});

describe('TaskRunner — parallel', () => {
  it('runs independent tasks in parallel levels', async () => {
    const tr = new TaskRunner();
    tr.task('a', () => 1);
    tr.task('b', () => 2);
    tr.task('c', ['a', 'b'], (d) => d.a + d.b);
    
    const result = await tr.runParallel('c');
    assert.equal(result, 3);
  });
});

describe('TaskRunner — reset', () => {
  it('allows re-running after reset', async () => {
    const tr = new TaskRunner();
    let count = 0;
    tr.task('x', () => ++count);
    await tr.run('x');
    assert.equal(count, 1);
    tr.reset();
    await tr.run('x');
    assert.equal(count, 2);
  });
});

describe('TaskRunner — utility', () => {
  it('getTaskNames', () => {
    const tr = new TaskRunner();
    tr.task('a', () => {}); tr.task('b', () => {});
    assert.deepEqual(tr.getTaskNames().sort(), ['a', 'b']);
  });

  it('getDependencies', () => {
    const tr = new TaskRunner();
    tr.task('build', ['compile', 'lint'], () => {});
    assert.deepEqual(tr.getDependencies('build'), ['compile', 'lint']);
  });
});
