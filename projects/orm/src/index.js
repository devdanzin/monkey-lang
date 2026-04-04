// ===== Simple ORM =====
// In-memory ORM with models, CRUD, relationships, query builder

let autoId = 0;

export class Model {
  static _store = new Map(); // Model class name → records
  static _schema = {};
  static _relations = {};

  static _getStore() {
    const name = this.name;
    if (!Model._store.has(name)) Model._store.set(name, []);
    return Model._store.get(name);
  }

  static create(data) {
    const record = { id: ++autoId, ...data, _model: this.name };
    this._getStore().push(record);
    return record;
  }

  static findById(id) { return this._getStore().find(r => r.id === id) ?? null; }
  static findAll() { return [...this._getStore()]; }
  static findOne(predicate) { return this._getStore().find(predicate) ?? null; }
  static where(predicate) { return this._getStore().filter(predicate); }

  static update(id, data) {
    const record = this.findById(id);
    if (!record) return null;
    Object.assign(record, data);
    return record;
  }

  static delete(id) {
    const store = this._getStore();
    const idx = store.findIndex(r => r.id === id);
    if (idx === -1) return false;
    store.splice(idx, 1);
    return true;
  }

  static count() { return this._getStore().length; }
  static clear() { Model._store.set(this.name, []); }
  static clearAll() { Model._store.clear(); autoId = 0; }

  // Query builder
  static query() { return new QueryBuilder(this); }
}

// ===== Query Builder =====

class QueryBuilder {
  constructor(model) {
    this._model = model;
    this._filters = [];
    this._sortBy = null;
    this._sortDir = 'asc';
    this._limitN = Infinity;
    this._offsetN = 0;
    this._selectFields = null;
  }

  where(key, op, value) {
    if (value === undefined) { value = op; op = '==='; }
    this._filters.push({ key, op, value });
    return this;
  }

  orderBy(field, dir = 'asc') { this._sortBy = field; this._sortDir = dir; return this; }
  limit(n) { this._limitN = n; return this; }
  offset(n) { this._offsetN = n; return this; }
  select(...fields) { this._selectFields = fields; return this; }

  execute() {
    let results = this._model.findAll();

    // Apply filters
    for (const f of this._filters) {
      results = results.filter(r => {
        const val = r[f.key];
        switch (f.op) {
          case '===': case '=': return val === f.value;
          case '!=': return val !== f.value;
          case '>': return val > f.value;
          case '<': return val < f.value;
          case '>=': return val >= f.value;
          case '<=': return val <= f.value;
          case 'like': return String(val).includes(f.value);
          default: return true;
        }
      });
    }

    // Sort
    if (this._sortBy) {
      results.sort((a, b) => {
        const va = a[this._sortBy], vb = b[this._sortBy];
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return this._sortDir === 'desc' ? -cmp : cmp;
      });
    }

    // Offset + Limit
    results = results.slice(this._offsetN, this._offsetN + this._limitN);

    // Select fields
    if (this._selectFields) {
      results = results.map(r => {
        const obj = {};
        for (const f of this._selectFields) obj[f] = r[f];
        return obj;
      });
    }

    return results;
  }

  first() { return this.limit(1).execute()[0] ?? null; }
  count() { this._limitN = Infinity; this._offsetN = 0; return this.execute().length; }
}

// ===== Relationships =====

export function hasMany(parentModel, childModel, foreignKey) {
  return function(parentId) {
    return childModel.where(r => r[foreignKey] === parentId);
  };
}

export function hasOne(parentModel, childModel, foreignKey) {
  return function(parentId) {
    return childModel.findOne(r => r[foreignKey] === parentId);
  };
}

export function belongsTo(childModel, parentModel, foreignKey) {
  return function(record) {
    return parentModel.findById(record[foreignKey]);
  };
}
