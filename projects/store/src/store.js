// Tiny Reactive Store — Zustand-inspired

export function createStore(initialState, actions) {
  let state = { ...initialState };
  const listeners = new Set();

  const store = {
    getState: () => state,
    setState: (updater) => {
      const newState = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...newState };
      for (const listener of listeners) listener(state);
    },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    destroy: () => { listeners.clear(); },
  };

  // Bind actions
  if (actions) {
    const boundActions = actions(store.setState, store.getState, store);
    Object.assign(store, boundActions);
  }

  return store;
}

// Selector hook — subscribe to a slice of state
export function select(store, selector) {
  let current = selector(store.getState());
  return {
    get: () => current,
    subscribe: (listener) => {
      return store.subscribe((state) => {
        const next = selector(state);
        if (next !== current) { current = next; listener(next); }
      });
    }
  };
}

// Middleware helper
export function applyMiddleware(store, ...middlewares) {
  let setState = store.setState;
  for (const mw of middlewares.reverse()) {
    const next = setState;
    setState = (updater) => mw(next, store.getState)(updater);
  }
  store.setState = setState;
  return store;
}

// Logger middleware
export function logger(next, getState) {
  return (updater) => {
    const prev = getState();
    next(updater);
    const curr = getState();
    console.log('state change:', prev, '→', curr);
  };
}

// Persist middleware
export function persist(key) {
  return (next, getState) => (updater) => {
    next(updater);
    // In browser: localStorage.setItem(key, JSON.stringify(getState()));
  };
}
