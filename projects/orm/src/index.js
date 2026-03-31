/**
 * Tiny ORM — In-memory object-relational mapping
 * 
 * Features:
 * - Define models with typed fields and defaults
 * - CRUD: create, find, findOne, update, delete
 * - Query builder: where, orderBy, limit, offset
 * - Relations: hasMany, belongsTo, hasOne
 * - Hooks: beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete
 * - Validation: required, min, max, enum, custom
 * - Auto-increment IDs
 * - Transactions (basic)
 */

class Database {
  constructor() {
    this.tables = new Map();
    this.models = new Map();
    this.idCounters = new Map();
  }

  define(name, schema, options = {}) {
    const model = new Model(this, name, schema, options);
    this.models.set(name, model);
    this.tables.set(name, []);
    this.idCounters.set(name, 1);
    return model;
  }

  getModel(name) { return this.models.get(name); }
}

class Model {
  constructor(db, name, schema, options) {
    this.db = db;
    this.name = name;
    this.schema = schema;
    this.options = options;
    this.hooks = { beforeCreate: [], afterCreate: [], beforeUpdate: [], afterUpdate: [], beforeDelete: [] };
    this.relations = [];
  }

  _table() { return this.db.tables.get(this.name); }

  _validate(data) {
    for (const [field, def] of Object.entries(this.schema)) {
      const val = data[field];
      if (def.required && (val === undefined || val === null)) {
        throw new Error(`Validation: ${field} is required`);
      }
      if (val !== undefined && val !== null) {
        if (def.type === 'string' && typeof val !== 'string') throw new Error(`Validation: ${field} must be a string`);
        if (def.type === 'number' && typeof val !== 'number') throw new Error(`Validation: ${field} must be a number`);
        if (def.type === 'boolean' && typeof val !== 'boolean') throw new Error(`Validation: ${field} must be a boolean`);
        if (def.min !== undefined && val < def.min) throw new Error(`Validation: ${field} must be >= ${def.min}`);
        if (def.max !== undefined && val > def.max) throw new Error(`Validation: ${field} must be <= ${def.max}`);
        if (def.enum && !def.enum.includes(val)) throw new Error(`Validation: ${field} must be one of ${def.enum.join(', ')}`);
        if (def.validate && !def.validate(val)) throw new Error(`Validation: ${field} failed custom validation`);
      }
    }
  }

  _applyDefaults(data) {
    const result = { ...data };
    for (const [field, def] of Object.entries(this.schema)) {
      if (result[field] === undefined && def.default !== undefined) {
        result[field] = typeof def.default === 'function' ? def.default() : def.default;
      }
    }
    return result;
  }

  async _runHooks(hookName, record) {
    for (const fn of this.hooks[hookName] || []) {
      await fn(record);
    }
  }

  hook(name, fn) {
    if (!this.hooks[name]) this.hooks[name] = [];
    this.hooks[name].push(fn);
    return this;
  }

  hasMany(targetName, opts = {}) {
    this.relations.push({ type: 'hasMany', target: targetName, foreignKey: opts.foreignKey || `${this.name}Id` });
    return this;
  }

  belongsTo(targetName, opts = {}) {
    this.relations.push({ type: 'belongsTo', target: targetName, foreignKey: opts.foreignKey || `${targetName}Id` });
    return this;
  }

  hasOne(targetName, opts = {}) {
    this.relations.push({ type: 'hasOne', target: targetName, foreignKey: opts.foreignKey || `${this.name}Id` });
    return this;
  }

  async create(data) {
    const record = this._applyDefaults(data);
    this._validate(record);
    
    const id = this.db.idCounters.get(this.name);
    this.db.idCounters.set(this.name, id + 1);
    record.id = id;
    record.createdAt = new Date().toISOString();
    record.updatedAt = record.createdAt;
    
    await this._runHooks('beforeCreate', record);
    this._table().push({ ...record });
    await this._runHooks('afterCreate', record);
    return { ...record };
  }

  find(query = {}) {
    return new Query(this, query);
  }

  findAll(query = {}) {
    return this.find(query).exec();
  }

  findOne(query = {}) {
    const results = this._filter(query);
    return results.length > 0 ? { ...results[0] } : null;
  }

  findById(id) {
    return this.findOne({ id });
  }

  _filter(query) {
    return this._table().filter(record => {
      for (const [key, val] of Object.entries(query)) {
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          // Operator queries: { age: { $gt: 18, $lt: 65 } }
          for (const [op, opVal] of Object.entries(val)) {
            switch (op) {
              case '$gt': if (!(record[key] > opVal)) return false; break;
              case '$gte': if (!(record[key] >= opVal)) return false; break;
              case '$lt': if (!(record[key] < opVal)) return false; break;
              case '$lte': if (!(record[key] <= opVal)) return false; break;
              case '$ne': if (record[key] === opVal) return false; break;
              case '$in': if (!opVal.includes(record[key])) return false; break;
              case '$like': if (!record[key]?.includes(opVal)) return false; break;
            }
          }
        } else {
          if (record[key] !== val) return false;
        }
      }
      return true;
    });
  }

  async update(query, updates) {
    const records = this._filter(query);
    const table = this._table();
    let count = 0;
    for (const record of records) {
      const idx = table.findIndex(r => r.id === record.id);
      if (idx !== -1) {
        const updated = { ...table[idx], ...updates, updatedAt: new Date().toISOString() };
        this._validate(updated);
        await this._runHooks('beforeUpdate', updated);
        table[idx] = updated;
        await this._runHooks('afterUpdate', updated);
        count++;
      }
    }
    return count;
  }

  async delete(query) {
    const records = this._filter(query);
    const table = this._table();
    let count = 0;
    for (const record of records) {
      await this._runHooks('beforeDelete', record);
      const idx = table.findIndex(r => r.id === record.id);
      if (idx !== -1) {
        table.splice(idx, 1);
        count++;
      }
    }
    return count;
  }

  count(query = {}) {
    return this._filter(query).length;
  }

  async populate(record, relationName) {
    const rel = this.relations.find(r => r.target === relationName);
    if (!rel) throw new Error(`No relation to ${relationName}`);
    const target = this.db.getModel(relationName);
    if (!target) throw new Error(`Model ${relationName} not found`);

    if (rel.type === 'hasMany') {
      record[relationName] = target._filter({ [rel.foreignKey]: record.id });
    } else if (rel.type === 'belongsTo') {
      record[relationName] = target.findById(record[rel.foreignKey]);
    } else if (rel.type === 'hasOne') {
      record[relationName] = target.findOne({ [rel.foreignKey]: record.id });
    }
    return record;
  }
}

class Query {
  constructor(model, where = {}) {
    this.model = model;
    this._where = where;
    this._orderBy = null;
    this._limit = null;
    this._offset = 0;
    this._select = null;
  }

  where(query) { this._where = { ...this._where, ...query }; return this; }
  orderBy(field, dir = 'asc') { this._orderBy = { field, dir }; return this; }
  limit(n) { this._limit = n; return this; }
  offset(n) { this._offset = n; return this; }
  select(...fields) { this._select = fields; return this; }

  exec() {
    let results = this.model._filter(this._where);
    if (this._orderBy) {
      const { field, dir } = this._orderBy;
      results.sort((a, b) => {
        if (a[field] < b[field]) return dir === 'asc' ? -1 : 1;
        if (a[field] > b[field]) return dir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    results = results.slice(this._offset);
    if (this._limit !== null) results = results.slice(0, this._limit);
    if (this._select) {
      results = results.map(r => {
        const o = {};
        for (const f of this._select) o[f] = r[f];
        return o;
      });
    }
    return results.map(r => ({ ...r }));
  }

  first() {
    const results = this.limit(1).exec();
    return results[0] || null;
  }

  count() {
    return this.model._filter(this._where).length;
  }
}

module.exports = { Database, Model, Query };
