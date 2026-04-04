// ===== Reactive Signals =====
// SolidJS/Preact-inspired fine-grained reactivity

let currentEffect = null;
let batchDepth = 0;
let pendingEffects = new Set();
let executingEffect = false;

// ===== Signal =====

export function signal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();

  function read() {
    // Track dependency
    if (currentEffect) {
      subscribers.add(currentEffect);
      currentEffect._deps.add(subscribers);
    }
    return value;
  }

  read.set = function(newValue) {
    if (Object.is(value, newValue)) return;
    value = newValue;
    notify(subscribers);
  };

  read.update = function(fn) {
    read.set(fn(value));
  };

  read.peek = function() { return value; };

  // Subscribe to changes (returns unsubscribe)
  read.subscribe = function(fn) {
    const wrapper = { execute: () => fn(value), _deps: new Set() };
    subscribers.add(wrapper);
    return () => subscribers.delete(wrapper);
  };

  return read;
}

function notify(subscribers) {
  // Snapshot to avoid iteration issues when effects re-subscribe
  const snapshot = [...subscribers];
  for (const sub of snapshot) {
    if (batchDepth > 0) {
      pendingEffects.add(sub);
    } else {
      sub.execute();
    }
  }
}

// ===== Computed =====

export function computed(fn) {
  let cachedValue;
  let dirty = true;
  const subscribers = new Set();

  const eff = {
    execute() {
      dirty = true;
      notify(subscribers);
    },
    _deps: new Set(),
  };

  function read() {
    if (dirty) {
      // Clean up old deps
      for (const dep of eff._deps) dep.delete(eff);
      eff._deps.clear();

      const prevEffect = currentEffect;
      currentEffect = eff;
      try {
        cachedValue = fn();
      } finally {
        currentEffect = prevEffect;
      }
      dirty = false;
    }

    // Track this computed as a dependency
    if (currentEffect) {
      subscribers.add(currentEffect);
      currentEffect._deps.add(subscribers);
    }

    return cachedValue;
  }

  read.peek = () => {
    if (dirty) {
      const prevEffect = currentEffect;
      currentEffect = eff;
      try { cachedValue = fn(); } finally { currentEffect = prevEffect; }
      dirty = false;
    }
    return cachedValue;
  };

  return read;
}

// ===== Effect =====

export function effect(fn) {
  const eff = {
    execute() {
      // Call cleanup from previous run
      if (eff._cleanup) { eff._cleanup(); eff._cleanup = null; }
      
      // Clean up old deps
      for (const dep of eff._deps) dep.delete(eff);
      eff._deps.clear();

      const prevEffect = currentEffect;
      currentEffect = eff;
      try {
        const cleanup = fn();
        eff._cleanup = typeof cleanup === 'function' ? cleanup : null;
      } finally {
        currentEffect = prevEffect;
      }
    },
    _deps: new Set(),
    _cleanup: null,
  };

  eff.execute();

  // Return dispose function
  return () => {
    if (eff._cleanup) { eff._cleanup(); eff._cleanup = null; }
    for (const dep of eff._deps) dep.delete(eff);
    eff._deps.clear();
  };
}

// ===== Batch =====

export function batch(fn) {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const effects = [...pendingEffects];
      pendingEffects.clear();
      for (const eff of effects) {
        eff.execute();
      }
    }
  }
}

// ===== Untracked =====

export function untracked(fn) {
  const prev = currentEffect;
  currentEffect = null;
  try {
    return fn();
  } finally {
    currentEffect = prev;
  }
}
