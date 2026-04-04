// signals.js — Reactive signals system

let currentEffect = null;
let batchDepth = 0;
let pendingEffects = new Set();

// ===== Signal =====
export function createSignal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();

  function read() {
    if (currentEffect) subscribers.add(currentEffect);
    return value;
  }

  function write(newValue) {
    if (typeof newValue === 'function') newValue = newValue(value);
    if (newValue === value) return;
    value = newValue;
    for (const sub of subscribers) {
      if (batchDepth > 0) pendingEffects.add(sub);
      else sub.execute();
    }
  }

  read.peek = () => value;
  read.subscribe = (fn) => { subscribers.add({ execute: fn }); return () => subscribers.delete({ execute: fn }); };

  return [read, write];
}

// ===== Effect =====
export function createEffect(fn) {
  const effect = {
    execute() {
      const prevEffect = currentEffect;
      currentEffect = effect;
      try { fn(); }
      finally { currentEffect = prevEffect; }
    },
    dispose() { disposed = true; }
  };
  let disposed = false;
  effect.execute();
  return () => { disposed = true; };
}

// ===== Computed =====
export function createComputed(fn) {
  let cachedValue;
  let dirty = true;
  const subscribers = new Set();
  const deps = new Set();

  const computation = {
    execute() {
      dirty = true;
      for (const sub of subscribers) {
        if (batchDepth > 0) pendingEffects.add(sub);
        else sub.execute();
      }
    }
  };

  function read() {
    if (currentEffect) subscribers.add(currentEffect);
    if (dirty) {
      const prevEffect = currentEffect;
      currentEffect = computation;
      try { cachedValue = fn(); }
      finally { currentEffect = prevEffect; }
      dirty = false;
    }
    return cachedValue;
  }

  read.peek = () => cachedValue;
  return read;
}

// ===== Batch =====
export function batch(fn) {
  batchDepth++;
  try { fn(); }
  finally {
    batchDepth--;
    if (batchDepth === 0) {
      const effects = [...pendingEffects];
      pendingEffects.clear();
      for (const effect of effects) effect.execute();
    }
  }
}

// ===== Untrack =====
export function untrack(fn) {
  const prevEffect = currentEffect;
  currentEffect = null;
  try { return fn(); }
  finally { currentEffect = prevEffect; }
}

// ===== Memo =====
export function createMemo(fn, equals = (a, b) => a === b) {
  let prev;
  const computed = createComputed(() => {
    const next = fn();
    if (prev !== undefined && equals(prev, next)) return prev;
    prev = next;
    return next;
  });
  return computed;
}

// ===== Reactive Store =====
export function createStore(initialState) {
  const signals = {};

  function getSignal(key) {
    if (!signals[key]) signals[key] = createSignal(initialState[key]);
    return signals[key];
  }

  const store = new Proxy({}, {
    get(_, key) { return getSignal(key)[0](); },
    set(_, key, value) { getSignal(key)[1](value); return true; },
  });

  function setStore(updates) {
    batch(() => {
      for (const [key, value] of Object.entries(updates)) {
        getSignal(key)[1](value);
      }
    });
  }

  return [store, setStore];
}
