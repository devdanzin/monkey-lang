const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  pipe, compose, tap, when, unless, tryCatch, parallel,
  Pipeline, pipeAsync, AsyncPipeline,
} = require('../src/index.js');

test('pipe', () => {
  const add1 = x => x + 1;
  const double = x => x * 2;
  assert.equal(pipe(add1, double)(3), 8);   // (3+1)*2 = 8
  assert.equal(pipe(double, add1)(3), 7);   // 3*2+1 = 7
});

test('compose', () => {
  const add1 = x => x + 1;
  const double = x => x * 2;
  assert.equal(compose(double, add1)(3), 8); // double(add1(3)) = 8
});

test('tap', () => {
  const log = [];
  const fn = pipe(x => x + 1, tap(x => log.push(x)), x => x * 2);
  assert.equal(fn(3), 8);
  assert.deepEqual(log, [4]);
});

test('when', () => {
  const abs = when(x => x < 0, x => -x);
  assert.equal(abs(-5), 5);
  assert.equal(abs(5), 5);
});

test('unless', () => {
  const ensurePositive = unless(x => x > 0, () => 0);
  assert.equal(ensurePositive(-5), 0);
  assert.equal(ensurePositive(5), 5);
});

test('tryCatch', () => {
  const safeParse = tryCatch(JSON.parse, () => null);
  assert.deepEqual(safeParse('{"a":1}'), { a: 1 });
  assert.equal(safeParse('invalid'), null);
});

test('parallel', () => {
  const stats = parallel(
    arr => Math.min(...arr),
    arr => Math.max(...arr),
    arr => arr.reduce((a, b) => a + b, 0) / arr.length,
  );
  assert.deepEqual(stats([1, 2, 3, 4, 5]), [1, 5, 3]);
});

test('Pipeline class', () => {
  const result = Pipeline.of(5)
    .pipe(x => x + 1)
    .pipe(x => x * 2)
    .value();
  assert.equal(result, 12);
});

test('Pipeline — map/filter/reduce', () => {
  const result = Pipeline.of([1, 2, 3, 4, 5])
    .filter(x => x % 2 === 0)
    .map(x => x * 10)
    .reduce((a, b) => a + b, 0)
    .value();
  assert.equal(result, 60);
});

test('Pipeline — tap', () => {
  const log = [];
  Pipeline.of(42).tap(x => log.push(x)).pipe(x => x + 1).value();
  assert.deepEqual(log, [42]);
});

test('Pipeline — when', () => {
  const result = Pipeline.of(-5)
    .when(x => x < 0, x => -x)
    .value();
  assert.equal(result, 5);
});

test('async pipe', async () => {
  const fn = pipeAsync(
    x => Promise.resolve(x + 1),
    x => x * 2,
  );
  assert.equal(await fn(3), 8);
});

test('AsyncPipeline', async () => {
  const result = await AsyncPipeline.of(10)
    .pipe(x => Promise.resolve(x + 5))
    .pipe(x => x * 2)
    .value();
  assert.equal(result, 30);
});
