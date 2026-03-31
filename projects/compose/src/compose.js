// Function composition utilities

// pipe: left-to-right composition
export function pipe(...fns) { return (x) => fns.reduce((v, fn) => fn(v), x); }

// compose: right-to-left composition
export function compose(...fns) { return (x) => fns.reduceRight((v, fn) => fn(v), x); }

// Async pipe
export function pipeAsync(...fns) { return (x) => fns.reduce(async (v, fn) => fn(await v), x); }

// Curry
export function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn(...args);
    return (...more) => curried(...args, ...more);
  };
}

// Partial application
export function partial(fn, ...partialArgs) {
  return (...args) => fn(...partialArgs, ...args);
}

// Memoize
export function memoize(fn, keyFn) {
  const cache = new Map();
  return (...args) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

// Once
export function once(fn) { let called = false, result; return (...args) => { if (!called) { called = true; result = fn(...args); } return result; }; }

// Noop
export function noop() {}

// Identity
export function identity(x) { return x; }

// Constant
export function constant(x) { return () => x; }

// Flip (swap first two args)
export function flip(fn) { return (a, b, ...rest) => fn(b, a, ...rest); }

// Not (negate predicate)
export function not(fn) { return (...args) => !fn(...args); }

// Tap (side effect in pipeline)
export function tap(fn) { return (x) => { fn(x); return x; }; }

// Attempt (try/catch wrapper)
export function attempt(fn, fallback) { try { return fn(); } catch { return fallback; } }

// Flow (named pipe for readability)
export const flow = pipe;

// Juxt (apply multiple fns to same args)
export function juxt(...fns) { return (...args) => fns.map(fn => fn(...args)); }

// Converge (apply fn to results of other fns)
export function converge(fn, branches) { return (...args) => fn(...branches.map(b => b(...args))); }

// Trampoline (tail-call optimization)
export function trampoline(fn) {
  return (...args) => {
    let result = fn(...args);
    while (typeof result === 'function') result = result();
    return result;
  };
}
