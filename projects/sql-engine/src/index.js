// ===== Simple SQL Database Engine =====

// ===== Table =====

export class Table {
  constructor(name, columns) {
    this.name = name;
    this.columns = columns; // [{name, type}]
    this.rows = [];
    this.autoIncrement = 0;
  }

  insert(row) {
    // Fill in auto-increment for 'id' if not provided
    if (this.columns.some(c => c.name === 'id') && row.id === undefined) {
      row.id = ++this.autoIncrement;
    }
    this.rows.push({ ...row });
    return row;
  }

  columnNames() { return this.columns.map(c => c.name); }
}

// ===== Database =====

export class Database {
  constructor() {
    this.tables = new Map();
  }

  createTable(name, columns) {
    if (this.tables.has(name)) throw new Error(`Table ${name} already exists`);
    const table = new Table(name, columns);
    this.tables.set(name, table);
    return table;
  }

  dropTable(name) {
    if (!this.tables.has(name)) throw new Error(`Table ${name} does not exist`);
    this.tables.delete(name);
  }

  getTable(name) {
    const table = this.tables.get(name);
    if (!table) throw new Error(`Table ${name} does not exist`);
    return table;
  }

  // Execute a parsed query
  execute(query) {
    switch (query.type) {
      case 'create': return this._executeCreate(query);
      case 'insert': return this._executeInsert(query);
      case 'select': return this._executeSelect(query);
      case 'update': return this._executeUpdate(query);
      case 'delete': return this._executeDelete(query);
      case 'drop': return this._executeDrop(query);
      default: throw new Error(`Unknown query type: ${query.type}`);
    }
  }

  _executeCreate(query) {
    this.createTable(query.table, query.columns);
    return { type: 'ok', message: `Table ${query.table} created` };
  }

  _executeInsert(query) {
    const table = this.getTable(query.table);
    const row = {};
    for (let i = 0; i < query.columns.length; i++) {
      row[query.columns[i]] = query.values[i];
    }
    table.insert(row);
    return { type: 'ok', message: `1 row inserted` };
  }

  _executeSelect(query) {
    let rows = [];
    
    // FROM clause
    if (query.from) {
      const table = this.getTable(query.from);
      rows = table.rows.map(r => ({ ...r }));
    }
    
    // JOIN clause
    if (query.join) {
      const joinTable = this.getTable(query.join.table);
      const newRows = [];
      for (const leftRow of rows) {
        for (const rightRow of joinTable.rows) {
          // Prefix right table columns
          const combined = { ...leftRow };
          for (const [k, v] of Object.entries(rightRow)) {
            combined[`${query.join.table}.${k}`] = v;
            if (!(k in combined)) combined[k] = v;
          }
          
          // Check join condition
          if (query.join.on) {
            const { left, right } = query.join.on;
            if (this._resolveValue(combined, left) === this._resolveValue(combined, right)) {
              newRows.push(combined);
            }
          } else {
            newRows.push(combined);
          }
        }
      }
      rows = newRows;
    }
    
    // WHERE clause
    if (query.where) {
      rows = rows.filter(row => this._evaluateCondition(row, query.where));
    }
    
    // GROUP BY
    if (query.groupBy) {
      const groups = new Map();
      for (const row of rows) {
        const key = row[query.groupBy];
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      }
      
      rows = [];
      for (const [key, groupRows] of groups) {
        const resultRow = { [query.groupBy]: key };
        
        // Evaluate aggregate functions in select
        for (const col of query.columns) {
          if (col.aggregate) {
            resultRow[col.alias || `${col.aggregate}(${col.column})`] = 
              this._aggregate(col.aggregate, groupRows, col.column);
          }
        }
        rows.push(resultRow);
      }
    }
    
    // ORDER BY
    if (query.orderBy) {
      const { column, direction } = query.orderBy;
      rows.sort((a, b) => {
        const va = a[column], vb = b[column];
        if (va < vb) return direction === 'ASC' ? -1 : 1;
        if (va > vb) return direction === 'ASC' ? 1 : -1;
        return 0;
      });
    }
    
    // LIMIT
    if (query.limit !== undefined) {
      rows = rows.slice(0, query.limit);
    }
    
    // SELECT columns
    if (query.columns && query.columns[0] !== '*' && !query.groupBy) {
      rows = rows.map(row => {
        const result = {};
        for (const col of query.columns) {
          const name = typeof col === 'string' ? col : col.column;
          if (col.aggregate) {
            // Aggregate without GROUP BY (entire table)
            continue;
          }
          result[col.alias || name] = row[name];
        }
        return result;
      });
    }
    
    return { type: 'rows', rows, count: rows.length };
  }

  _executeUpdate(query) {
    const table = this.getTable(query.table);
    let count = 0;
    for (const row of table.rows) {
      if (!query.where || this._evaluateCondition(row, query.where)) {
        for (const [col, val] of Object.entries(query.set)) {
          row[col] = val;
        }
        count++;
      }
    }
    return { type: 'ok', message: `${count} rows updated` };
  }

  _executeDelete(query) {
    const table = this.getTable(query.table);
    const before = table.rows.length;
    table.rows = table.rows.filter(row => 
      query.where ? !this._evaluateCondition(row, query.where) : false
    );
    return { type: 'ok', message: `${before - table.rows.length} rows deleted` };
  }

  _executeDrop(query) {
    this.dropTable(query.table);
    return { type: 'ok', message: `Table ${query.table} dropped` };
  }

  _resolveValue(row, ref) {
    if (typeof ref === 'string') return row[ref];
    return ref;
  }

  _evaluateCondition(row, cond) {
    if (cond.op === 'AND') {
      return this._evaluateCondition(row, cond.left) && this._evaluateCondition(row, cond.right);
    }
    if (cond.op === 'OR') {
      return this._evaluateCondition(row, cond.left) || this._evaluateCondition(row, cond.right);
    }
    
    const left = typeof cond.left === 'string' ? row[cond.left] : cond.left;
    const right = typeof cond.right === 'string' ? row[cond.right] : cond.right;
    
    switch (cond.op) {
      case '=': return left === right;
      case '!=': return left !== right;
      case '<': return left < right;
      case '>': return left > right;
      case '<=': return left <= right;
      case '>=': return left >= right;
      case 'LIKE': {
        const pattern = right.replace(/%/g, '.*').replace(/_/g, '.');
        return new RegExp(`^${pattern}$`, 'i').test(left);
      }
      case 'IN': return right.includes(left);
      default: throw new Error(`Unknown operator: ${cond.op}`);
    }
  }

  _aggregate(fn, rows, column) {
    switch (fn.toUpperCase()) {
      case 'COUNT': return column === '*' ? rows.length : rows.filter(r => r[column] != null).length;
      case 'SUM': return rows.reduce((s, r) => s + (r[column] || 0), 0);
      case 'AVG': { const vals = rows.map(r => r[column]).filter(v => v != null); return vals.reduce((s, v) => s + v, 0) / vals.length; }
      case 'MIN': return Math.min(...rows.map(r => r[column]));
      case 'MAX': return Math.max(...rows.map(r => r[column]));
      default: throw new Error(`Unknown aggregate: ${fn}`);
    }
  }
}

// ===== Query Builder (DSL) =====

export function createTable(name, columns) {
  return { type: 'create', table: name, columns };
}

export function insert(table, columns, values) {
  return { type: 'insert', table, columns, values };
}

export function select(columns) {
  return {
    type: 'select',
    columns,
    from: null,
    where: null,
    orderBy: null,
    limit: undefined,
    join: null,
    groupBy: null,
    
    FROM(table) { this.from = table; return this; },
    WHERE(condition) { this.where = condition; return this; },
    ORDER_BY(column, direction = 'ASC') { this.orderBy = { column, direction }; return this; },
    LIMIT(n) { this.limit = n; return this; },
    JOIN(table, on) { this.join = { table, on }; return this; },
    GROUP_BY(column) { this.groupBy = column; return this; },
  };
}

export function update(table) {
  return {
    type: 'update',
    table,
    set: {},
    where: null,
    SET(obj) { this.set = obj; return this; },
    WHERE(condition) { this.where = condition; return this; },
  };
}

export function deleteFrom(table) {
  return {
    type: 'delete',
    table,
    where: null,
    WHERE(condition) { this.where = condition; return this; },
  };
}

// Condition helpers
export function eq(left, right) { return { op: '=', left, right }; }
export function neq(left, right) { return { op: '!=', left, right }; }
export function lt(left, right) { return { op: '<', left, right }; }
export function gt(left, right) { return { op: '>', left, right }; }
export function lte(left, right) { return { op: '<=', left, right }; }
export function gte(left, right) { return { op: '>=', left, right }; }
export function and(left, right) { return { op: 'AND', left, right }; }
export function or(left, right) { return { op: 'OR', left, right }; }
export function like(left, right) { return { op: 'LIKE', left, right }; }
export function inList(left, right) { return { op: 'IN', left, right }; }

// Aggregate helpers
export function count(column = '*', alias) { return { aggregate: 'COUNT', column, alias }; }
export function sum(column, alias) { return { aggregate: 'SUM', column, alias }; }
export function avg(column, alias) { return { aggregate: 'AVG', column, alias }; }
export function min(column, alias) { return { aggregate: 'MIN', column, alias }; }
export function max(column, alias) { return { aggregate: 'MAX', column, alias }; }
