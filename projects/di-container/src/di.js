// di.js — Dependency Injection Container

export const Lifetime = { SINGLETON: 'singleton', TRANSIENT: 'transient', SCOPED: 'scoped' };

export class Container {
  constructor(parent = null) {
    this.registrations = new Map();
    this.singletons = new Map();
    this.scopedInstances = new Map();
    this.parent = parent;
    this.resolving = new Set(); // circular dependency detection
  }

  // Register a class
  register(token, implementation, lifetime = Lifetime.TRANSIENT, options = {}) {
    this.registrations.set(token, { implementation, lifetime, options, type: 'class' });
    return this;
  }

  // Register a factory function
  registerFactory(token, factory, lifetime = Lifetime.TRANSIENT) {
    this.registrations.set(token, { factory, lifetime, type: 'factory' });
    return this;
  }

  // Register a constant value
  registerValue(token, value) {
    this.registrations.set(token, { value, lifetime: Lifetime.SINGLETON, type: 'value' });
    this.singletons.set(token, value);
    return this;
  }

  // Register with tags
  registerTagged(token, tag, implementation, lifetime = Lifetime.TRANSIENT) {
    const key = `${String(token)}:${tag}`;
    this.registrations.set(key, { implementation, lifetime, type: 'class', tag });
    return this;
  }

  // Resolve a dependency
  resolve(token) {
    // Check circular dependencies
    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected: ${String(token)}`);
    }

    // Check singleton cache
    if (this.singletons.has(token)) return this.singletons.get(token);

    // Check scoped cache
    if (this.scopedInstances.has(token)) return this.scopedInstances.get(token);

    // Find registration
    const reg = this.registrations.get(token) || this.parent?.registrations.get(token);
    if (!reg) throw new Error(`No registration for: ${String(token)}`);

    this.resolving.add(token);
    try {
      let instance;

      if (reg.type === 'value') {
        instance = reg.value;
      } else if (reg.type === 'factory') {
        instance = reg.factory(this);
      } else {
        // Class instantiation
        const deps = (reg.options?.inject || []).map(dep => this.resolve(dep));
        instance = new reg.implementation(...deps);

        // Property injection
        if (reg.options?.properties) {
          for (const [prop, dep] of Object.entries(reg.options.properties)) {
            instance[prop] = this.resolve(dep);
          }
        }
      }

      // Cache based on lifetime
      if (reg.lifetime === Lifetime.SINGLETON) this.singletons.set(token, instance);
      if (reg.lifetime === Lifetime.SCOPED) this.scopedInstances.set(token, instance);

      return instance;
    } finally {
      this.resolving.delete(token);
    }
  }

  // Resolve tagged
  resolveTagged(token, tag) {
    return this.resolve(`${String(token)}:${tag}`);
  }

  // Resolve all registrations for a token pattern
  resolveAll(token) {
    const results = [];
    for (const [key, reg] of this.registrations) {
      if (typeof key === 'string' && key.startsWith(`${String(token)}:`)) {
        results.push(this.resolve(key));
      }
    }
    return results;
  }

  // Create a child container (scoped)
  createScope() {
    const child = new Container(this);
    // Copy registrations to child (inherit parent registrations)
    for (const [key, reg] of this.registrations) {
      if (!child.registrations.has(key)) {
        child.registrations.set(key, reg);
      }
    }
    // Copy singleton references
    for (const [key, val] of this.singletons) {
      child.singletons.set(key, val);
    }
    return child;
  }

  // Check if token is registered
  has(token) {
    return this.registrations.has(token) || (this.parent?.has(token) ?? false);
  }

  // Dispose singletons
  dispose() {
    for (const [, instance] of this.singletons) {
      if (instance && typeof instance.dispose === 'function') instance.dispose();
    }
    for (const [, instance] of this.scopedInstances) {
      if (instance && typeof instance.dispose === 'function') instance.dispose();
    }
    this.singletons.clear();
    this.scopedInstances.clear();
  }
}

// ===== Decorators (token-based) =====
export function injectable(token, deps = []) {
  return function (target) {
    target.__diToken = token;
    target.__diDeps = deps;
    return target;
  };
}

// ===== Auto-wire helper =====
export function autoRegister(container, classes) {
  for (const cls of classes) {
    const token = cls.__diToken || cls.name;
    const deps = cls.__diDeps || [];
    container.register(token, cls, Lifetime.TRANSIENT, { inject: deps });
  }
}
