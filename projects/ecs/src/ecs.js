// Entity Component System — data-oriented game engine architecture
// Entities are IDs, Components are data, Systems query entities by component signature

export class World {
  constructor() {
    this.nextEntityId = 0;
    this.entities = new Set();
    this.components = new Map(); // componentName → Map<entityId, componentData>
    this.systems = [];
    this.resources = new Map(); // global shared state
  }

  // ===== Entities =====
  spawn(...components) {
    const id = this.nextEntityId++;
    this.entities.add(id);
    for (const comp of components) {
      this.addComponent(id, comp);
    }
    return id;
  }

  despawn(entity) {
    this.entities.delete(entity);
    for (const [, store] of this.components) {
      store.delete(entity);
    }
  }

  isAlive(entity) {
    return this.entities.has(entity);
  }

  // ===== Components =====
  addComponent(entity, component) {
    const name = component.constructor.name || component._type;
    if (!this.components.has(name)) {
      this.components.set(name, new Map());
    }
    this.components.get(name).set(entity, component);
    return this;
  }

  removeComponent(entity, componentClass) {
    const name = componentClass.name;
    const store = this.components.get(name);
    if (store) store.delete(entity);
    return this;
  }

  getComponent(entity, componentClass) {
    const name = componentClass.name;
    const store = this.components.get(name);
    return store ? store.get(entity) : undefined;
  }

  hasComponent(entity, componentClass) {
    const name = componentClass.name;
    const store = this.components.get(name);
    return store ? store.has(entity) : false;
  }

  // ===== Queries =====
  // Get all entities that have ALL the specified components
  query(...componentClasses) {
    const results = [];
    const names = componentClasses.map(c => c.name);
    const stores = names.map(n => this.components.get(n));

    // If any component type has no store, no entities can match
    if (stores.some(s => !s)) return results;

    // Iterate over the smallest store for efficiency
    let smallest = stores[0], smallestIdx = 0;
    for (let i = 1; i < stores.length; i++) {
      if (stores[i].size < smallest.size) { smallest = stores[i]; smallestIdx = i; }
    }

    for (const [entity] of smallest) {
      if (!this.entities.has(entity)) continue;
      let match = true;
      for (let i = 0; i < stores.length; i++) {
        if (i !== smallestIdx && !stores[i].has(entity)) { match = false; break; }
      }
      if (match) {
        const comps = stores.map(s => s.get(entity));
        results.push([entity, ...comps]);
      }
    }

    return results;
  }

  // Query returning entities WITHOUT a component
  queryWithout(include, exclude) {
    const results = this.query(...include);
    const excludeNames = exclude.map(c => c.name);
    return results.filter(([entity]) => {
      return !excludeNames.some(name => {
        const store = this.components.get(name);
        return store && store.has(entity);
      });
    });
  }

  // ===== Resources =====
  setResource(name, value) { this.resources.set(name, value); }
  getResource(name) { return this.resources.get(name); }

  // ===== Systems =====
  addSystem(system) {
    this.systems.push(system);
    return this;
  }

  // Run all systems once
  tick(dt = 1/60) {
    for (const system of this.systems) {
      system(this, dt);
    }
  }

  // ===== Utility =====
  entityCount() { return this.entities.size; }

  // Get all components for an entity
  inspect(entity) {
    const result = {};
    for (const [name, store] of this.components) {
      if (store.has(entity)) result[name] = store.get(entity);
    }
    return result;
  }

  // Clear everything
  clear() {
    this.entities.clear();
    this.components.clear();
    this.systems = [];
    this.resources.clear();
    this.nextEntityId = 0;
  }
}

// Component helper — creates a simple component class
export function defineComponent(name, defaults = {}) {
  const ComponentClass = class {
    constructor(values = {}) {
      Object.assign(this, defaults, values);
    }
  };
  Object.defineProperty(ComponentClass, 'name', { value: name });
  return ComponentClass;
}
