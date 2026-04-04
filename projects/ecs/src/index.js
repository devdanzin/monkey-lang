// ===== Entity Component System =====

let nextEntityId = 1;

export class World {
  constructor() {
    this.entities = new Map();      // entityId → Set of component names
    this.components = new Map();    // componentName → Map(entityId → data)
    this.systems = [];
    this._toDestroy = [];
  }

  // ===== Entities =====

  createEntity() {
    const id = nextEntityId++;
    this.entities.set(id, new Set());
    return id;
  }

  destroyEntity(id) {
    const comps = this.entities.get(id);
    if (!comps) return;
    for (const name of comps) {
      this.components.get(name)?.delete(id);
    }
    this.entities.delete(id);
  }

  hasEntity(id) { return this.entities.has(id); }

  // ===== Components =====

  addComponent(entityId, name, data = {}) {
    if (!this.entities.has(entityId)) throw new Error(`Entity ${entityId} does not exist`);
    
    if (!this.components.has(name)) {
      this.components.set(name, new Map());
    }
    this.components.get(name).set(entityId, { ...data });
    this.entities.get(entityId).add(name);
    return this;
  }

  removeComponent(entityId, name) {
    this.components.get(name)?.delete(entityId);
    this.entities.get(entityId)?.delete(name);
    return this;
  }

  getComponent(entityId, name) {
    return this.components.get(name)?.get(entityId);
  }

  hasComponent(entityId, name) {
    return this.components.get(name)?.has(entityId) ?? false;
  }

  // ===== Queries =====

  // Find all entities with ALL specified components
  query(...componentNames) {
    const results = [];
    
    // Start with smallest component pool for efficiency
    const sorted = [...componentNames].sort((a, b) => 
      (this.components.get(a)?.size ?? 0) - (this.components.get(b)?.size ?? 0)
    );
    
    const first = this.components.get(sorted[0]);
    if (!first) return results;
    
    for (const entityId of first.keys()) {
      let hasAll = true;
      for (let i = 1; i < sorted.length; i++) {
        if (!this.components.get(sorted[i])?.has(entityId)) {
          hasAll = false;
          break;
        }
      }
      if (hasAll) results.push(entityId);
    }
    
    return results;
  }

  // Query returning component data
  queryWith(...componentNames) {
    return this.query(...componentNames).map(id => ({
      id,
      ...Object.fromEntries(componentNames.map(name => [name, this.getComponent(id, name)])),
    }));
  }

  // ===== Systems =====

  addSystem(system) {
    this.systems.push(system);
    if (system.init) system.init(this);
    return this;
  }

  // Run all systems once
  update(dt = 0) {
    for (const system of this.systems) {
      system.update(this, dt);
    }
    // Process deferred destroys
    for (const id of this._toDestroy) this.destroyEntity(id);
    this._toDestroy = [];
  }

  // Mark entity for deferred destruction (safe during system update)
  markForDestroy(id) {
    this._toDestroy.push(id);
  }

  // ===== Utility =====

  get entityCount() { return this.entities.size; }

  getEntityComponents(entityId) {
    return [...(this.entities.get(entityId) || [])];
  }
}
