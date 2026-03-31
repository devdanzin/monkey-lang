/**
 * Tiny ECS — Entity Component System
 * 
 * Game architecture pattern:
 * - Entities: just IDs
 * - Components: data attached to entities
 * - Systems: logic that operates on entities with matching components
 * - Queries: find entities by component types
 * - Events
 */

class World {
  constructor() {
    this.nextId = 1;
    this.entities = new Set();
    this.components = new Map(); // componentName -> Map<entityId, data>
    this.systems = [];
    this.events = new Map(); // eventName -> [handlers]
  }

  createEntity() {
    const id = this.nextId++;
    this.entities.add(id);
    return id;
  }

  destroyEntity(id) {
    this.entities.delete(id);
    for (const store of this.components.values()) {
      store.delete(id);
    }
  }

  addComponent(entity, name, data = {}) {
    if (!this.components.has(name)) this.components.set(name, new Map());
    this.components.get(name).set(entity, data);
    return this;
  }

  removeComponent(entity, name) {
    const store = this.components.get(name);
    if (store) store.delete(entity);
    return this;
  }

  getComponent(entity, name) {
    const store = this.components.get(name);
    return store ? store.get(entity) : undefined;
  }

  hasComponent(entity, name) {
    const store = this.components.get(name);
    return store ? store.has(entity) : false;
  }

  query(...componentNames) {
    const results = [];
    for (const entity of this.entities) {
      let match = true;
      for (const name of componentNames) {
        if (!this.hasComponent(entity, name)) { match = false; break; }
      }
      if (match) {
        const components = {};
        for (const name of componentNames) {
          components[name] = this.getComponent(entity, name);
        }
        results.push({ entity, ...components });
      }
    }
    return results;
  }

  addSystem(name, componentNames, fn, priority = 0) {
    this.systems.push({ name, components: componentNames, fn, priority });
    this.systems.sort((a, b) => a.priority - b.priority);
    return this;
  }

  update(dt = 0) {
    for (const system of this.systems) {
      const entities = this.query(...system.components);
      system.fn(entities, dt, this);
    }
  }

  on(event, handler) {
    if (!this.events.has(event)) this.events.set(event, []);
    this.events.get(event).push(handler);
    return this;
  }

  emit(event, data) {
    const handlers = this.events.get(event) || [];
    for (const handler of handlers) handler(data, this);
  }

  entityCount() { return this.entities.size; }

  serialize() {
    const entities = [];
    for (const id of this.entities) {
      const components = {};
      for (const [name, store] of this.components) {
        if (store.has(id)) components[name] = store.get(id);
      }
      entities.push({ id, components });
    }
    return { entities, nextId: this.nextId };
  }

  static deserialize(data) {
    const world = new World();
    world.nextId = data.nextId;
    for (const { id, components } of data.entities) {
      world.entities.add(id);
      for (const [name, compData] of Object.entries(components)) {
        world.addComponent(id, name, compData);
      }
    }
    return world;
  }
}

module.exports = { World };
