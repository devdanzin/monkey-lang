// Dependency Injection Container — register, resolve, scopes, factories, decorators

export class Container {
  constructor(parent = null) {
    this._bindings = new Map();
    this._singletons = new Map();
    this._parent = parent;
  }

  // Register a class/factory as a binding
  register(name, factory, { singleton = false, tags = [] } = {}) {
    this._bindings.set(name, { factory, singleton, tags });
    return this;
  }

  // Register a constant value
  value(name, val) {
    return this.register(name, () => val, { singleton: true });
  }

  // Register a class (auto-resolved)
  class(name, Cls, { singleton = false } = {}) {
    return this.register(name, (container) => {
      // Resolve constructor dependencies from metadata
      const deps = Cls._inject || [];
      const args = deps.map(dep => container.resolve(dep));
      return new Cls(...args);
    }, { singleton });
  }

  // Resolve a dependency
  resolve(name) {
    // Check singletons first
    if (this._singletons.has(name)) return this._singletons.get(name);

    const binding = this._bindings.get(name);

    if (!binding) {
      // Check parent
      if (this._parent) return this._parent.resolve(name);
      throw new Error(`No binding for: ${name}`);
    }

    const instance = binding.factory(this);

    if (binding.singleton) {
      this._singletons.set(name, instance);
    }

    return instance;
  }

  // Check if binding exists
  has(name) {
    return this._bindings.has(name) || (this._parent?.has(name) ?? false);
  }

  // Resolve all bindings with a given tag
  resolveTagged(tag) {
    const results = [];
    for (const [name, binding] of this._bindings) {
      if (binding.tags.includes(tag)) {
        results.push(this.resolve(name));
      }
    }
    if (this._parent) results.push(...this._parent.resolveTagged(tag));
    return results;
  }

  // Create a child container (inherits bindings)
  createChild() {
    return new Container(this);
  }

  // Create a scoped container (fresh singletons)
  createScope() {
    const scope = new Container(this._parent);
    // Copy bindings but not singleton instances
    for (const [name, binding] of this._bindings) {
      scope._bindings.set(name, { ...binding });
    }
    return scope;
  }

  // Decorator: wrap resolved instance
  decorate(name, decorator) {
    const original = this._bindings.get(name);
    if (!original) throw new Error(`No binding for: ${name}`);

    const origFactory = original.factory;
    original.factory = (container) => decorator(origFactory(container), container);
    return this;
  }

  // Get all registered names
  names() {
    const set = new Set(this._bindings.keys());
    if (this._parent) for (const n of this._parent.names()) set.add(n);
    return [...set];
  }

  // Remove a binding
  remove(name) {
    this._bindings.delete(name);
    this._singletons.delete(name);
    return this;
  }

  // Clear all bindings
  clear() {
    this._bindings.clear();
    this._singletons.clear();
    return this;
  }
}

// Decorator for specifying injection dependencies
export function inject(...deps) {
  return function(target) {
    target._inject = deps;
    return target;
  };
}
