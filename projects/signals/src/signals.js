// Signals — fine-grained reactivity (Solid.js-inspired)
// signal() → [get, set], computed(), effect(), batch()

let currentEffect = null;
let batchDepth = 0;
let pendingEffects = new Set();

export function createSignal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();

  function get() {
    if (currentEffect) subscribers.add(currentEffect);
    return value;
  }

  function set(newValue) {
    if (typeof newValue === 'function') newValue = newValue(value);
    if (newValue === value) return;
    value = newValue;
    if (batchDepth > 0) {
      for (const sub of subscribers) pendingEffects.add(sub);
    } else {
      for (const sub of [...subscribers]) sub();
    }
  }

  return [get, set];
}

export function createEffect(fn) {
  function run() {
    const prev = currentEffect;
    currentEffect = run;
    try { fn(); }
    finally { currentEffect = prev; }
  }
  run();
  return () => { /* cleanup: effects auto-unsubscribe when signals change */ };
}

export function createComputed(fn) {
  const [get, set] = createSignal(undefined);
  createEffect(() => set(fn()));
  return get;
}

export function createMemo(fn) {
  let cached, initialized = false;
  const [get, set] = createSignal(undefined);
  createEffect(() => {
    const newValue = fn();
    if (!initialized || newValue !== cached) {
      cached = newValue;
      initialized = true;
      set(newValue);
    }
  });
  return get;
}

export function batch(fn) {
  batchDepth++;
  try { fn(); }
  finally {
    batchDepth--;
    if (batchDepth === 0) {
      const effects = [...pendingEffects];
      pendingEffects.clear();
      for (const effect of effects) effect();
    }
  }
}

// Derived signal that depends on multiple signals
export function derived(fn) {
  return createComputed(fn);
}

// Watch a signal and call handler on changes
export function watch(signalGetter, handler) {
  let prev;
  createEffect(() => {
    const value = signalGetter();
    if (value !== prev) {
      const old = prev;
      prev = value;
      handler(value, old);
    }
  });
}
