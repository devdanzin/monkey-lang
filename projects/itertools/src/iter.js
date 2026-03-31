// Iterator utilities — lazy, composable operations on iterables

// Creation
export function* range(start, end, step = 1) {
  if (end === undefined) { end = start; start = 0; }
  if (step > 0) for (let i = start; i < end; i += step) yield i;
  else for (let i = start; i > end; i += step) yield i;
}

export function* repeat(value, n = Infinity) { for (let i = 0; i < n; i++) yield value; }
export function* cycle(iterable) { const arr = [...iterable]; while (true) for (const v of arr) yield v; }
export function* generate(fn) { let i = 0; while (true) yield fn(i++); }

// Transform
export function* map(iterable, fn) { let i = 0; for (const v of iterable) yield fn(v, i++); }
export function* filter(iterable, fn) { let i = 0; for (const v of iterable) if (fn(v, i++)) yield v; }
export function* flatMap(iterable, fn) { for (const v of iterable) yield* fn(v); }
export function* scan(iterable, fn, seed) { let acc = seed; for (const v of iterable) { acc = fn(acc, v); yield acc; } }
export function* enumerate(iterable, start = 0) { let i = start; for (const v of iterable) yield [i++, v]; }

// Combination
export function* zip(...iterables) {
  const iters = iterables.map(it => it[Symbol.iterator]());
  while (true) {
    const results = iters.map(it => it.next());
    if (results.some(r => r.done)) return;
    yield results.map(r => r.value);
  }
}

export function* zipLongest(...iterables) {
  const iters = iterables.map(it => it[Symbol.iterator]());
  while (true) {
    const results = iters.map(it => it.next());
    if (results.every(r => r.done)) return;
    yield results.map(r => r.done ? undefined : r.value);
  }
}

export function* chain(...iterables) { for (const it of iterables) yield* it; }
export function* interleave(...iterables) { const iters = iterables.map(it => it[Symbol.iterator]()); let active = true; while (active) { active = false; for (const it of iters) { const r = it.next(); if (!r.done) { yield r.value; active = true; } } } }

// Slicing
export function* take(iterable, n) { let i = 0; for (const v of iterable) { if (i++ >= n) return; yield v; } }
export function* skip(iterable, n) { let i = 0; for (const v of iterable) { if (i++ >= n) yield v; } }
export function* takeWhile(iterable, fn) { for (const v of iterable) { if (!fn(v)) return; yield v; } }
export function* skipWhile(iterable, fn) { let skipping = true; for (const v of iterable) { if (skipping && fn(v)) continue; skipping = false; yield v; } }
export function* slice(iterable, start, end) { yield* take(skip(iterable, start), end - start); }

// Grouping
export function* chunk(iterable, size) { let batch = []; for (const v of iterable) { batch.push(v); if (batch.length === size) { yield batch; batch = []; } } if (batch.length) yield batch; }
export function* window(iterable, size) { const buf = []; for (const v of iterable) { buf.push(v); if (buf.length > size) buf.shift(); if (buf.length === size) yield [...buf]; } }
export function* unique(iterable, keyFn) { const seen = new Set(); for (const v of iterable) { const key = keyFn ? keyFn(v) : v; if (!seen.has(key)) { seen.add(key); yield v; } } }

// Reduction (eager)
export function reduce(iterable, fn, seed) { let acc = seed; for (const v of iterable) acc = fn(acc, v); return acc; }
export function toArray(iterable) { return [...iterable]; }
export function count(iterable) { let n = 0; for (const _ of iterable) n++; return n; }
export function some(iterable, fn) { for (const v of iterable) if (fn(v)) return true; return false; }
export function every(iterable, fn) { for (const v of iterable) if (!fn(v)) return false; return true; }
export function find(iterable, fn) { for (const v of iterable) if (fn(v)) return v; return undefined; }
export function first(iterable) { for (const v of iterable) return v; return undefined; }
export function last(iterable) { let l; for (const v of iterable) l = v; return l; }
export function sum(iterable) { return reduce(iterable, (a, b) => a + b, 0); }
export function min(iterable) { return reduce(iterable, (a, b) => a < b ? a : b, Infinity); }
export function max(iterable) { return reduce(iterable, (a, b) => a > b ? a : b, -Infinity); }

// Pipe helper
export function pipe(iterable, ...fns) { return fns.reduce((it, fn) => fn(it), iterable); }
