// ecs.js — Entity Component System

let nextEntityId = 0;

export class World {
  constructor() {
    this.entities = new Map();
    this.components = new Map(); // componentName -> Map<entityId, data>
    this.systems = [];
    this.events = [];
    this.listeners = new Map();
  }

  createEntity() {
    const id = nextEntityId++;
    this.entities.set(id, new Set());
    this.emit('entityCreated', { entity: id });
    return id;
  }

  destroyEntity(id) {
    const comps = this.entities.get(id);
    if (!comps) return;
    for (const comp of comps) {
      this.components.get(comp)?.delete(id);
    }
    this.entities.delete(id);
    this.emit('entityDestroyed', { entity: id });
  }

  addComponent(entity, name, data = {}) {
    if (!this.components.has(name)) this.components.set(name, new Map());
    this.components.get(name).set(entity, data);
    this.entities.get(entity)?.add(name);
    this.emit('componentAdded', { entity, component: name });
    return this;
  }

  removeComponent(entity, name) {
    this.components.get(name)?.delete(entity);
    this.entities.get(entity)?.delete(name);
    this.emit('componentRemoved', { entity, component: name });
  }

  getComponent(entity, name) {
    return this.components.get(name)?.get(entity);
  }

  hasComponent(entity, name) {
    return this.components.get(name)?.has(entity) ?? false;
  }

  // Query entities with ALL specified components
  query(...componentNames) {
    const results = [];
    for (const [entityId, comps] of this.entities) {
      if (componentNames.every(c => comps.has(c))) {
        results.push(entityId);
      }
    }
    return results;
  }

  // Query returning component data
  queryWith(...componentNames) {
    return this.query(...componentNames).map(id => ({
      entity: id,
      ...Object.fromEntries(componentNames.map(c => [c, this.getComponent(id, c)])),
    }));
  }

  // Register system
  addSystem(name, components, fn, priority = 0) {
    this.systems.push({ name, components, fn, priority });
    this.systems.sort((a, b) => a.priority - b.priority);
    return this;
  }

  // Run all systems
  update(dt = 0) {
    for (const system of this.systems) {
      const entities = this.query(...system.components);
      for (const entity of entities) {
        const data = {};
        for (const comp of system.components) data[comp] = this.getComponent(entity, comp);
        system.fn(entity, data, dt, this);
      }
    }
  }

  // Events
  emit(event, data) { this.events.push({ event, data }); for (const fn of this.listeners.get(event) || []) fn(data); }
  on(event, fn) { if (!this.listeners.has(event)) this.listeners.set(event, []); this.listeners.get(event).push(fn); }

  get entityCount() { return this.entities.size; }
}
