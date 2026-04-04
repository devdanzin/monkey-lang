import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Observable } from '../src/index.js';

describe('Observable — creation', () => {
  it('Observable.of', () => {
    const values = [];
    Observable.of(1, 2, 3).subscribe(v => values.push(v));
    assert.deepEqual(values, [1, 2, 3]);
  });

  it('Observable.from', () => {
    const values = [];
    Observable.from([4, 5, 6]).subscribe(v => values.push(v));
    assert.deepEqual(values, [4, 5, 6]);
  });

  it('Observable.empty completes immediately', () => {
    let completed = false;
    Observable.empty().subscribe({ next: () => {}, complete: () => { completed = true; } });
    assert.equal(completed, true);
  });

  it('custom observable', () => {
    const values = [];
    new Observable(observer => {
      observer.next(1); observer.next(2); observer.complete();
    }).subscribe(v => values.push(v));
    assert.deepEqual(values, [1, 2]);
  });
});

describe('Observable — subscribe', () => {
  it('receives next values', () => {
    const log = [];
    Observable.of(1, 2).subscribe(v => log.push(v));
    assert.deepEqual(log, [1, 2]);
  });

  it('receives complete', () => {
    let done = false;
    Observable.of(1).subscribe({ next: () => {}, complete: () => { done = true; } });
    assert.equal(done, true);
  });

  it('receives error', () => {
    let err = null;
    new Observable(o => o.error(new Error('oops'))).subscribe({
      next: () => {}, error: e => { err = e; },
    });
    assert.equal(err.message, 'oops');
  });

  it('unsubscribe stops values', () => {
    const values = [];
    const sub = new Observable(observer => {
      observer.next(1);
      setTimeout(() => observer.next(2), 10);
    }).subscribe(v => values.push(v));
    sub.unsubscribe();
    assert.deepEqual(values, [1]);
  });
});

describe('Observable — operators', () => {
  it('map', () => {
    const values = [];
    Observable.of(1, 2, 3).map(x => x * 2).subscribe(v => values.push(v));
    assert.deepEqual(values, [2, 4, 6]);
  });

  it('filter', () => {
    const values = [];
    Observable.of(1, 2, 3, 4, 5).filter(x => x % 2 === 0).subscribe(v => values.push(v));
    assert.deepEqual(values, [2, 4]);
  });

  it('take', () => {
    const values = [];
    Observable.of(1, 2, 3, 4, 5).take(3).subscribe(v => values.push(v));
    assert.deepEqual(values, [1, 2, 3]);
  });

  it('skip', () => {
    const values = [];
    Observable.of(1, 2, 3, 4, 5).skip(2).subscribe(v => values.push(v));
    assert.deepEqual(values, [3, 4, 5]);
  });

  it('scan (running reduce)', () => {
    const values = [];
    Observable.of(1, 2, 3).scan((acc, v) => acc + v, 0).subscribe(v => values.push(v));
    assert.deepEqual(values, [1, 3, 6]);
  });

  it('reduce', async () => {
    const result = await Observable.of(1, 2, 3).reduce((acc, v) => acc + v, 0).toPromise();
    assert.equal(result, 6);
  });

  it('tap (side effect)', () => {
    const side = [];
    const values = [];
    Observable.of(1, 2).tap(v => side.push(v * 10)).subscribe(v => values.push(v));
    assert.deepEqual(side, [10, 20]);
    assert.deepEqual(values, [1, 2]);
  });

  it('distinctUntilChanged', () => {
    const values = [];
    Observable.of(1, 1, 2, 2, 3, 1).distinctUntilChanged().subscribe(v => values.push(v));
    assert.deepEqual(values, [1, 2, 3, 1]);
  });

  it('chaining operators', () => {
    const values = [];
    Observable.of(1, 2, 3, 4, 5, 6)
      .filter(x => x % 2 === 0)
      .map(x => x * 10)
      .subscribe(v => values.push(v));
    assert.deepEqual(values, [20, 40, 60]);
  });
});

describe('Observable — merge', () => {
  it('merges multiple observables', () => {
    const values = [];
    Observable.merge(
      Observable.of(1, 2),
      Observable.of(3, 4),
    ).subscribe(v => values.push(v));
    assert.deepEqual(values.sort(), [1, 2, 3, 4]);
  });
});

describe('Observable — conversion', () => {
  it('toPromise', async () => {
    const v = await Observable.of(42).toPromise();
    assert.equal(v, 42);
  });

  it('toArray', async () => {
    const arr = await Observable.of(1, 2, 3).toArray();
    assert.deepEqual(arr, [1, 2, 3]);
  });
});

describe('Observable — teardown', () => {
  it('calls teardown on unsubscribe', () => {
    let tornDown = false;
    const sub = new Observable(() => {
      return () => { tornDown = true; };
    }).subscribe(() => {});
    sub.unsubscribe();
    assert.equal(tornDown, true);
  });
});
