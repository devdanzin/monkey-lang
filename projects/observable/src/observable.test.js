import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Observable, Subject, BehaviorSubject, ReplaySubject, map, filter, take, skip, scan, distinctUntilChanged, tap } from './observable.js';

describe('Observable', () => {
  it('subscribe and receive values', () => {
    const vals = [];
    Observable.of(1, 2, 3).subscribe(v => vals.push(v));
    assert.deepStrictEqual(vals, [1, 2, 3]);
  });
  it('complete fires', () => {
    let completed = false;
    Observable.of(1).subscribe({ next: () => {}, complete: () => { completed = true; } });
    assert.ok(completed);
  });
  it('from iterable', () => {
    const vals = [];
    Observable.from([10, 20, 30]).subscribe(v => vals.push(v));
    assert.deepStrictEqual(vals, [10, 20, 30]);
  });
  it('empty', () => {
    let completed = false;
    Observable.empty().subscribe({ next: () => {}, complete: () => { completed = true; } });
    assert.ok(completed);
  });
  it('unsubscribe', () => {
    const vals = [];
    const sub = Observable.of(1, 2, 3).subscribe(v => vals.push(v));
    sub.unsubscribe(); // already complete, but should not error
  });
});

describe('Operators', () => {
  it('map', () => {
    const vals = [];
    Observable.of(1, 2, 3).pipe(map(x => x * 2)).subscribe(v => vals.push(v));
    assert.deepStrictEqual(vals, [2, 4, 6]);
  });
  it('filter', () => {
    const vals = [];
    Observable.of(1, 2, 3, 4, 5).pipe(filter(x => x % 2 === 0)).subscribe(v => vals.push(v));
    assert.deepStrictEqual(vals, [2, 4]);
  });
  it('take', () => {
    const vals = [];
    Observable.of(1, 2, 3, 4, 5).pipe(take(3)).subscribe(v => vals.push(v));
    assert.deepStrictEqual(vals, [1, 2, 3]);
  });
  it('skip', () => {
    const vals = [];
    Observable.of(1, 2, 3, 4, 5).pipe(skip(2)).subscribe(v => vals.push(v));
    assert.deepStrictEqual(vals, [3, 4, 5]);
  });
  it('scan', () => {
    const vals = [];
    Observable.of(1, 2, 3).pipe(scan((acc, v) => acc + v, 0)).subscribe(v => vals.push(v));
    assert.deepStrictEqual(vals, [1, 3, 6]);
  });
  it('distinctUntilChanged', () => {
    const vals = [];
    Observable.of(1, 1, 2, 2, 3, 1).pipe(distinctUntilChanged()).subscribe(v => vals.push(v));
    assert.deepStrictEqual(vals, [1, 2, 3, 1]);
  });
  it('tap', () => {
    const side = [];
    const vals = [];
    Observable.of(1, 2, 3).pipe(tap(v => side.push(v))).subscribe(v => vals.push(v));
    assert.deepStrictEqual(side, [1, 2, 3]);
    assert.deepStrictEqual(vals, [1, 2, 3]);
  });
  it('chained operators', () => {
    const vals = [];
    Observable.of(1, 2, 3, 4, 5, 6).pipe(
      filter(x => x % 2 === 0),
      map(x => x * 10),
      take(2)
    ).subscribe(v => vals.push(v));
    assert.deepStrictEqual(vals, [20, 40]);
  });
});

describe('Subject', () => {
  it('multicasts', () => {
    const sub = new Subject();
    const a = [], b = [];
    sub.subscribe(v => a.push(v));
    sub.subscribe(v => b.push(v));
    sub.next(1); sub.next(2);
    assert.deepStrictEqual(a, [1, 2]);
    assert.deepStrictEqual(b, [1, 2]);
  });
  it('unsubscribe removes observer', () => {
    const sub = new Subject();
    const vals = [];
    const s = sub.subscribe(v => vals.push(v));
    sub.next(1);
    s.unsubscribe();
    sub.next(2);
    assert.deepStrictEqual(vals, [1]);
  });
});

describe('BehaviorSubject', () => {
  it('emits current value on subscribe', () => {
    const sub = new BehaviorSubject(42);
    const vals = [];
    sub.subscribe(v => vals.push(v));
    assert.deepStrictEqual(vals, [42]);
  });
  it('has value property', () => {
    const sub = new BehaviorSubject(10);
    sub.next(20);
    assert.equal(sub.value, 20);
  });
});

describe('ReplaySubject', () => {
  it('replays buffer on subscribe', () => {
    const sub = new ReplaySubject(2);
    sub.next(1); sub.next(2); sub.next(3);
    const vals = [];
    sub.subscribe(v => vals.push(v));
    assert.deepStrictEqual(vals, [2, 3]); // last 2
  });
});
