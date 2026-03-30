import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Observable, map, filter, take, skip, reduce, scan, tap, distinctUntilChanged, catchError } from '../src/index.js';

describe('Observable creation', () => {
  it('Observable.of', async () => {
    const result = await Observable.of(1, 2, 3).toArray();
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('Observable.from', async () => {
    const result = await Observable.from([4, 5, 6]).toArray();
    assert.deepEqual(result, [4, 5, 6]);
  });

  it('Observable.empty', async () => {
    const result = await Observable.empty().toArray();
    assert.deepEqual(result, []);
  });

  it('Observable.fromPromise', async () => {
    const result = await Observable.fromPromise(Promise.resolve(42)).toPromise();
    assert.equal(result, 42);
  });

  it('custom Observable', async () => {
    const obs = new Observable(observer => {
      observer.next(1);
      observer.next(2);
      observer.complete();
    });
    assert.deepEqual(await obs.toArray(), [1, 2]);
  });
});

describe('Operators', () => {
  it('map', async () => {
    const result = await Observable.of(1, 2, 3).pipe(map(x => x * 2)).toArray();
    assert.deepEqual(result, [2, 4, 6]);
  });

  it('filter', async () => {
    const result = await Observable.of(1, 2, 3, 4, 5).pipe(filter(x => x % 2 === 0)).toArray();
    assert.deepEqual(result, [2, 4]);
  });

  it('take', async () => {
    const result = await Observable.of(1, 2, 3, 4, 5).pipe(take(3)).toArray();
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('skip', async () => {
    const result = await Observable.of(1, 2, 3, 4, 5).pipe(skip(2)).toArray();
    assert.deepEqual(result, [3, 4, 5]);
  });

  it('reduce', async () => {
    const result = await Observable.of(1, 2, 3, 4).pipe(reduce((acc, x) => acc + x, 0)).toPromise();
    assert.equal(result, 10);
  });

  it('scan', async () => {
    const result = await Observable.of(1, 2, 3).pipe(scan((acc, x) => acc + x, 0)).toArray();
    assert.deepEqual(result, [1, 3, 6]);
  });

  it('tap (side effects)', async () => {
    const side = [];
    await Observable.of(1, 2, 3).pipe(tap(x => side.push(x))).toArray();
    assert.deepEqual(side, [1, 2, 3]);
  });

  it('distinctUntilChanged', async () => {
    const result = await Observable.of(1, 1, 2, 2, 3, 2).pipe(distinctUntilChanged()).toArray();
    assert.deepEqual(result, [1, 2, 3, 2]);
  });

  it('chained pipe', async () => {
    const result = await Observable.of(1, 2, 3, 4, 5, 6)
      .pipe(filter(x => x % 2 === 0), map(x => x * 10), take(2))
      .toArray();
    assert.deepEqual(result, [20, 40]);
  });
});

describe('Error handling', () => {
  it('error propagation', async () => {
    const obs = Observable.throwError(new Error('boom'));
    try {
      await obs.toPromise();
      assert.fail();
    } catch (e) {
      assert.equal(e.message, 'boom');
    }
  });

  it('catchError', async () => {
    const result = await Observable.throwError(new Error('oops'))
      .pipe(catchError(() => Observable.of(42)))
      .toPromise();
    assert.equal(result, 42);
  });
});

describe('Combination', () => {
  it('merge', async () => {
    const result = await Observable.merge(
      Observable.of(1, 2),
      Observable.of(3, 4)
    ).toArray();
    assert.equal(result.length, 4);
    assert.ok(result.includes(1));
    assert.ok(result.includes(4));
  });
});

describe('Unsubscribe', () => {
  it('stops receiving after unsubscribe', () => {
    const values = [];
    const obs = new Observable(observer => {
      observer.next(1);
      observer.next(2);
      observer.next(3);
    });
    const sub = obs.subscribe(v => {
      values.push(v);
      if (v === 2) sub.unsubscribe();
    });
    assert.deepEqual(values, [1, 2]);
  });
});

describe('toPromise', () => {
  it('resolves with last value', async () => {
    assert.equal(await Observable.of(1, 2, 3).toPromise(), 3);
  });
});
