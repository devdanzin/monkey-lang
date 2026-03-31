// Tiny SQL query builder — fluent API, parameterized queries

export class Query {
  constructor(table) {
    this._table = table;
    this._type = 'select';
    this._columns = ['*'];
    this._wheres = [];
    this._orderBy = [];
    this._limit = null;
    this._offset = null;
    this._joins = [];
    this._groupBy = [];
    this._having = [];
    this._values = {};
    this._params = [];
  }

  static from(table) { return new Query(table); }
  static insert(table) { const q = new Query(table); q._type = 'insert'; return q; }
  static update(table) { const q = new Query(table); q._type = 'update'; return q; }
  static delete(table) { const q = new Query(table); q._type = 'delete'; return q; }

  select(...cols) { this._columns = cols.length ? cols : ['*']; return this; }
  where(col, op, val) { if (val === undefined) { val = op; op = '='; } this._wheres.push({ col, op, val, logic: 'AND' }); return this; }
  orWhere(col, op, val) { if (val === undefined) { val = op; op = '='; } this._wheres.push({ col, op, val, logic: 'OR' }); return this; }
  orderBy(col, dir = 'ASC') { this._orderBy.push(`${col} ${dir}`); return this; }
  limit(n) { this._limit = n; return this; }
  offset(n) { this._offset = n; return this; }
  groupBy(...cols) { this._groupBy = cols; return this; }
  having(col, op, val) { this._having.push({ col, op, val }); return this; }
  join(table, on) { this._joins.push({ type: 'JOIN', table, on }); return this; }
  leftJoin(table, on) { this._joins.push({ type: 'LEFT JOIN', table, on }); return this; }
  set(values) { this._values = { ...this._values, ...values }; return this; }

  build() {
    this._params = [];
    switch (this._type) {
      case 'select': return this._buildSelect();
      case 'insert': return this._buildInsert();
      case 'update': return this._buildUpdate();
      case 'delete': return this._buildDelete();
    }
  }

  _buildSelect() {
    let sql = `SELECT ${this._columns.join(', ')} FROM ${this._table}`;
    for (const j of this._joins) sql += ` ${j.type} ${j.table} ON ${j.on}`;
    sql += this._buildWhere();
    if (this._groupBy.length) sql += ` GROUP BY ${this._groupBy.join(', ')}`;
    if (this._having.length) { const h = this._having.map(h => { this._params.push(h.val); return `${h.col} ${h.op} ?`; }); sql += ` HAVING ${h.join(' AND ')}`; }
    if (this._orderBy.length) sql += ` ORDER BY ${this._orderBy.join(', ')}`;
    if (this._limit !== null) sql += ` LIMIT ${this._limit}`;
    if (this._offset !== null) sql += ` OFFSET ${this._offset}`;
    return { sql, params: this._params };
  }

  _buildInsert() {
    const keys = Object.keys(this._values);
    const placeholders = keys.map(() => '?');
    this._params = Object.values(this._values);
    return { sql: `INSERT INTO ${this._table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`, params: this._params };
  }

  _buildUpdate() {
    const sets = Object.keys(this._values).map(k => { this._params.push(this._values[k]); return `${k} = ?`; });
    let sql = `UPDATE ${this._table} SET ${sets.join(', ')}`;
    sql += this._buildWhere();
    return { sql, params: this._params };
  }

  _buildDelete() {
    let sql = `DELETE FROM ${this._table}`;
    sql += this._buildWhere();
    return { sql, params: this._params };
  }

  _buildWhere() {
    if (this._wheres.length === 0) return '';
    const parts = this._wheres.map((w, i) => {
      this._params.push(w.val);
      const clause = `${w.col} ${w.op} ?`;
      return i === 0 ? clause : `${w.logic} ${clause}`;
    });
    return ` WHERE ${parts.join(' ')}`;
  }
}
