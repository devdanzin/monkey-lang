// orm.js — Object-Relational Mapper from scratch

// ===== Schema Definition =====
export function defineModel(name, schema) {
  return { name, schema, tableName: name.toLowerCase() + 's' };
}

export function field(type, options = {}) {
  return { type, ...options };
}

export function hasMany(target, foreignKey) {
  return { relation: 'hasMany', target, foreignKey };
}

export function belongsTo(target, foreignKey) {
  return { relation: 'belongsTo', target, foreignKey };
}

// ===== Query Builder =====
export class QueryBuilder {
  constructor(db, model) {
    this.db = db;
    this.model = model;
    this._where = [];
    this._orderBy = [];
    this._limit = null;
    this._offset = null;
    this._joins = [];
    this._select = ['*'];
    this._includes = [];
  }

  where(conditions) {
    if (typeof conditions === 'string') {
      this._where.push(conditions);
    } else {
      for (const [key, value] of Object.entries(conditions)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          for (const [op, val] of Object.entries(value)) {
            const sqlOp = { $gt: '>', $gte: '>=', $lt: '<', $lte: '<=', $ne: '!=' }[op] || '=';
            this._where.push({ column: key, op: sqlOp, value: val });
          }
        } else {
          this._where.push({ column: key, op: '=', value });
        }
      }
    }
    return this;
  }

  orderBy(column, direction = 'ASC') { this._orderBy.push({ column, direction }); return this; }
  limit(n) { this._limit = n; return this; }
  offset(n) { this._offset = n; return this; }
  select(...columns) { this._select = columns; return this; }
  include(relation) { this._includes.push(relation); return this; }

  join(model, on) { this._joins.push({ model, on }); return this; }

  // Execute query
  async findAll() {
    let results = this.db._scan(this.model);
    results = this._applyWhere(results);
    results = this._applyOrderBy(results);
    if (this._offset) results = results.slice(this._offset);
    if (this._limit) results = results.slice(0, this._limit);
    results = this._applySelect(results);
    await this._applyIncludes(results);
    return results;
  }

  async findOne() {
    const results = await this.limit(1).findAll();
    return results[0] || null;
  }

  async count() {
    let results = this.db._scan(this.model);
    results = this._applyWhere(results);
    return results.length;
  }

  _applyWhere(results) {
    for (const cond of this._where) {
      if (typeof cond === 'string') continue;
      results = results.filter(row => {
        const val = row[cond.column];
        switch (cond.op) {
          case '=': return val === cond.value;
          case '!=': return val !== cond.value;
          case '>': return val > cond.value;
          case '>=': return val >= cond.value;
          case '<': return val < cond.value;
          case '<=': return val <= cond.value;
          default: return true;
        }
      });
    }
    return results;
  }

  _applyOrderBy(results) {
    if (this._orderBy.length === 0) return results;
    return [...results].sort((a, b) => {
      for (const { column, direction } of this._orderBy) {
        const cmp = a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0;
        if (cmp !== 0) return direction === 'DESC' ? -cmp : cmp;
      }
      return 0;
    });
  }

  _applySelect(results) {
    if (this._select[0] === '*') return results;
    return results.map(row => {
      const selected = {};
      for (const col of this._select) selected[col] = row[col];
      return selected;
    });
  }

  async _applyIncludes(results) {
    for (const rel of this._includes) {
      const relDef = this.model.schema[rel];
      if (!relDef || !relDef.relation) continue;

      if (relDef.relation === 'hasMany') {
        const targetModel = this.db.models.get(relDef.target);
        if (!targetModel) continue;
        for (const row of results) {
          row[rel] = this.db._scan(targetModel).filter(r => r[relDef.foreignKey] === row.id);
        }
      } else if (relDef.relation === 'belongsTo') {
        const targetModel = this.db.models.get(relDef.target);
        if (!targetModel) continue;
        for (const row of results) {
          row[rel] = this.db._scan(targetModel).find(r => r.id === row[relDef.foreignKey]) || null;
        }
      }
    }
  }
}

// ===== Database / Repository =====
export class ORM {
  constructor() {
    this.models = new Map();
    this.data = new Map();  // tableName → rows
    this.nextId = new Map();
    this.migrations = [];
  }

  register(model) {
    this.models.set(model.name, model);
    if (!this.data.has(model.tableName)) {
      this.data.set(model.tableName, []);
      this.nextId.set(model.tableName, 1);
    }
    return this;
  }

  // CRUD
  create(modelName, data) {
    const model = this.models.get(modelName);
    if (!model) throw new Error(`Model ${modelName} not found`);
    const table = model.tableName;
    const id = this.nextId.get(table);
    this.nextId.set(table, id + 1);
    const row = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
    this.data.get(table).push(row);
    return { ...row };
  }

  findById(modelName, id) {
    const model = this.models.get(modelName);
    if (!model) throw new Error(`Model ${modelName} not found`);
    return this.data.get(model.tableName).find(r => r.id === id) || null;
  }

  update(modelName, id, data) {
    const model = this.models.get(modelName);
    if (!model) throw new Error(`Model ${modelName} not found`);
    const rows = this.data.get(model.tableName);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...data, updatedAt: new Date() };
    return { ...rows[idx] };
  }

  delete(modelName, id) {
    const model = this.models.get(modelName);
    if (!model) throw new Error(`Model ${modelName} not found`);
    const rows = this.data.get(model.tableName);
    const idx = rows.findIndex(r => r.id === id);
    if (idx === -1) return false;
    rows.splice(idx, 1);
    return true;
  }

  // Query builder
  query(modelName) {
    const model = this.models.get(modelName);
    if (!model) throw new Error(`Model ${modelName} not found`);
    return new QueryBuilder(this, model);
  }

  _scan(model) {
    return [...(this.data.get(model.tableName) || [])];
  }

  // Migrations
  addMigration(name, up, down) {
    this.migrations.push({ name, up, down, applied: false });
  }

  migrate() {
    for (const migration of this.migrations) {
      if (!migration.applied) {
        migration.up(this);
        migration.applied = true;
      }
    }
  }

  rollback() {
    for (let i = this.migrations.length - 1; i >= 0; i--) {
      if (this.migrations[i].applied) {
        this.migrations[i].down(this);
        this.migrations[i].applied = false;
        return;
      }
    }
  }

  // Bulk operations
  bulkCreate(modelName, items) {
    return items.map(item => this.create(modelName, item));
  }

  // Count
  count(modelName) {
    const model = this.models.get(modelName);
    return this.data.get(model.tableName).length;
  }

  // Truncate
  truncate(modelName) {
    const model = this.models.get(modelName);
    this.data.set(model.tableName, []);
    this.nextId.set(model.tableName, 1);
  }
}
