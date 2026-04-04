// ===== Dependency Injection Container =====

const Lifecycle = { SINGLETON: 'singleton', TRANSIENT: 'transient', SCOPED: 'scoped' };

export class Container {
  constructor(parent = null) {
    this._registrations = new Map();
    this._singletons = new Map();
    this._scopedInstances = new Map();
    this._parent = parent;
    this._resolving = new Set(); // circular dependency detection
  }

  // Register a factory function
  register(name, factory, { lifecycle = Lifecycle.TRANSIENT, deps = [] } = {}) {
    this._registrations.set(name, { factory, lifecycle, deps });
    return this;
  }

  // Register a class (auto-resolved dependencies)
  registerClass(name, cls, { lifecycle = Lifecycle.TRANSIENT, deps = [] } = {}) {
    this._registrations.set(name, {
      factory: (...resolvedDeps) => new cls(...resolvedDeps),
      lifecycle,
      deps,
    });
    return this;
  }

  // Register a constant value
  registerValue(name, value) {
    this._registrations.set(name, { factory: () => value, lifecycle: Lifecycle.SINGLETON, deps: [] });
    this._singletons.set(name, value);
    return this;
  }

  // Resolve a dependency
  resolve(name) {
    // Check for circular dependencies
    if (this._resolving.has(name)) {
      throw new Error(`Circular dependency detected: ${name} → ${[...this._resolving].join(' → ')} → ${name}`);
    }

    const reg = this._getRegistration(name);
    if (!reg) throw new Error(`No registration found for "${name}"`);

    // Singleton: return cached instance
    if (reg.lifecycle === Lifecycle.SINGLETON) {
      if (this._singletons.has(name)) return this._singletons.get(name);
      if (this._parent?._singletons.has(name)) return this._parent._singletons.get(name);
    }

    // Scoped: return cached in this scope
    if (reg.lifecycle === Lifecycle.SCOPED) {
      if (this._scopedInstances.has(name)) return this._scopedInstances.get(name);
    }

    // Resolve dependencies
    this._resolving.add(name);
    try {
      const resolvedDeps = reg.deps.map(dep => this.resolve(dep));
      const instance = reg.factory(...resolvedDeps);

      if (reg.lifecycle === Lifecycle.SINGLETON) {
        this._singletons.set(name, instance);
      } else if (reg.lifecycle === Lifecycle.SCOPED) {
        this._scopedInstances.set(name, instance);
      }

      return instance;
    } finally {
      this._resolving.delete(name);
    }
  }

  // Check if registered
  has(name) {
    return this._registrations.has(name) || (this._parent?.has(name) ?? false);
  }

  // Create a child scope
  createScope() {
    const child = new Container(this);
    // Copy registrations to child
    for (const [name, reg] of this._registrations) {
      child._registrations.set(name, reg);
    }
    // Copy singletons reference
    child._singletons = this._singletons;
    return child;
  }

  // Auto-resolve: resolve all registered services
  resolveAll() {
    const result = {};
    for (const name of this._registrations.keys()) {
      result[name] = this.resolve(name);
    }
    return result;
  }

  _getRegistration(name) {
    return this._registrations.get(name) || this._parent?._getRegistration(name);
  }
}

export { Lifecycle };

// Convenience
export function createContainer() { return new Container(); }
