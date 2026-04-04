// ===== Simple SQL Database Engine =====

// ===== B-Tree Index =====

class BTreeNode {
  constructor(order, isLeaf = true) {
    this.order = order;
    this.keys = [];    // { key, rowIndices: number[] }
    this.children = [];
    this.isLeaf = isLeaf;
  }
}

export class BTreeIndex {
  constructor(name, column, order = 16) {
    this.name = name;
    this.column = column;
    this.order = order;
    this.root = new BTreeNode(order, true);
    this.size = 0;
  }

  // Insert a key → rowIndex mapping
  insert(key, rowIndex) {
    const root = this.root;
    if (root.keys.length === 2 * this.order - 1) {
      const newRoot = new BTreeNode(this.order, false);
      newRoot.children.push(root);
      this._splitChild(newRoot, 0);
      this.root = newRoot;
    }
    this._insertNonFull(this.root, key, rowIndex);
    this.size++;
  }

  _insertNonFull(node, key, rowIndex) {
    let i = node.keys.length - 1;
    
    if (node.isLeaf) {
      // Check if key already exists
      const existing = node.keys.find(k => k.key === key);
      if (existing) {
        existing.rowIndices.push(rowIndex);
        return;
      }
      // Insert in sorted position
      while (i >= 0 && node.keys[i].key > key) i--;
      node.keys.splice(i + 1, 0, { key, rowIndices: [rowIndex] });
    } else {
      while (i >= 0 && node.keys[i].key > key) i--;
      // Check if equal to existing key
      if (i >= 0 && node.keys[i].key === key) {
        node.keys[i].rowIndices.push(rowIndex);
        return;
      }
      i++;
      if (node.children[i] && node.children[i].keys.length === 2 * this.order - 1) {
        this._splitChild(node, i);
        if (i < node.keys.length && key > node.keys[i].key) i++;
        if (i < node.keys.length && node.keys[i].key === key) {
          node.keys[i].rowIndices.push(rowIndex);
          return;
        }
      }
      this._insertNonFull(node.children[i], key, rowIndex);
    }
  }

  _splitChild(parent, i) {
    const t = this.order;
    const child = parent.children[i];
    const newNode = new BTreeNode(t, child.isLeaf);
    
    parent.keys.splice(i, 0, child.keys[t - 1]);
    parent.children.splice(i + 1, 0, newNode);
    
    newNode.keys = child.keys.splice(t, t - 1);
    child.keys.splice(t - 1, 1);
    
    if (!child.isLeaf) {
      newNode.children = child.children.splice(t, t);
    }
  }

  // Point lookup: return row indices for exact key match
  lookup(key) {
    return this._search(this.root, key);
  }

  _search(node, key) {
    let i = 0;
    while (i < node.keys.length && key > node.keys[i].key) i++;
    
    if (i < node.keys.length && node.keys[i].key === key) {
      return [...node.keys[i].rowIndices];
    }
    
    if (node.isLeaf) return [];
    return this._search(node.children[i], key);
  }

  // Range scan: return row indices where lo <= key <= hi
  range(lo, hi) {
    const result = [];
    this._rangeSearch(this.root, lo, hi, result);
    return result;
  }

  _rangeSearch(node, lo, hi, result) {
    let i = 0;
    while (i < node.keys.length && node.keys[i].key < lo) {
      if (!node.isLeaf) this._rangeSearch(node.children[i], lo, hi, result);
      i++;
    }
    
    while (i < node.keys.length && node.keys[i].key <= hi) {
      if (!node.isLeaf) this._rangeSearch(node.children[i], lo, hi, result);
      result.push(...node.keys[i].rowIndices);
      i++;
    }
    
    if (!node.isLeaf && i < node.children.length) {
      this._rangeSearch(node.children[i], lo, hi, result);
    }
  }

  // Greater-than scan: return row indices where key > val
  greaterThan(val) {
    const result = [];
    this._gtSearch(this.root, val, result);
    return result;
  }

  _gtSearch(node, val, result) {
    let i = 0;
    while (i < node.keys.length && node.keys[i].key <= val) {
      if (!node.isLeaf) this._gtSearch(node.children[i], val, result);
      i++;
    }
    
    while (i < node.keys.length) {
      if (!node.isLeaf) this._gtSearch(node.children[i], val, result);
      result.push(...node.keys[i].rowIndices);
      i++;
    }
    
    if (!node.isLeaf && i < node.children.length) {
      this._gtSearch(node.children[i], val, result);
    }
  }

  // Less-than scan: return row indices where key < val
  lessThan(val) {
    const result = [];
    this._ltSearch(this.root, val, result);
    return result;
  }

  _ltSearch(node, val, result) {
    let i = 0;
    while (i < node.keys.length && node.keys[i].key < val) {
      if (!node.isLeaf) this._ltSearch(node.children[i], val, result);
      result.push(...node.keys[i].rowIndices);
      i++;
    }
    
    if (!node.isLeaf && i < node.children.length && (i === 0 || node.keys[i - 1].key < val)) {
      // Don't descend if we've already gone past val
    }
  }

  // Rebuild index from scratch (needed after row mutations)
  rebuild(rows) {
    this.root = new BTreeNode(this.order, true);
    this.size = 0;
    for (let i = 0; i < rows.length; i++) {
      const key = rows[i][this.column];
      if (key !== undefined && key !== null) {
        this.insert(key, i);
      }
    }
  }
}

// ===== Table =====

export class Table {
  constructor(name, columns) {
    this.name = name;
    this.columns = columns; // [{name, type}]
    this.rows = [];
    this.autoIncrement = 0;
    this.indices = new Map(); // column -> BTreeIndex
  }

  insert(row) {
    // Fill in auto-increment for 'id' if not provided
    if (this.columns.some(c => c.name === 'id') && row.id === undefined) {
      row.id = ++this.autoIncrement;
    }
    const rowIndex = this.rows.length;
    this.rows.push({ ...row });
    
    // Update indices
    for (const [col, index] of this.indices) {
      const key = row[col];
      if (key !== undefined && key !== null) {
        index.insert(key, rowIndex);
      }
    }
    
    return row;
  }

  createIndex(name, column) {
    const index = new BTreeIndex(name, column);
    // Index all existing rows
    for (let i = 0; i < this.rows.length; i++) {
      const key = this.rows[i][column];
      if (key !== undefined && key !== null) {
        index.insert(key, i);
      }
    }
    this.indices.set(column, index);
    return index;
  }

  dropIndex(column) {
    this.indices.delete(column);
  }

  getIndex(column) {
    return this.indices.get(column) || null;
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
      case 'createIndex': return this._executeCreateIndex(query);
      case 'insert': return this._executeInsert(query);
      case 'select': return this._executeSelect(query);
      case 'update': return this._executeUpdate(query);
      case 'delete': return this._executeDelete(query);
      case 'drop': return this._executeDrop(query);
      case 'explain': return this._executeExplain(query);
      default: throw new Error(`Unknown query type: ${query.type}`);
    }
  }

  _executeCreate(query) {
    this.createTable(query.table, query.columns);
    return { type: 'ok', message: `Table ${query.table} created` };
  }

  _executeCreateIndex(query) {
    const table = this.getTable(query.table);
    table.createIndex(query.name, query.column);
    return { type: 'ok', message: `Index ${query.name} created on ${query.table}(${query.column})` };
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
    let table = null;
    
    // FROM clause
    if (query.from) {
      table = this.getTable(query.from);
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
    
    // WHERE clause — try to use index
    if (query.where) {
      const indexPlan = this._tryIndexScan(query.from, query.where);
      if (indexPlan) {
        const indexRows = indexPlan.rowIndices.map(i => ({ ...table.rows[i] }));
        // If the index only partially covers the condition, filter the rest
        if (indexPlan.residual) {
          rows = indexRows.filter(row => this._evaluateCondition(row, indexPlan.residual));
        } else {
          rows = indexRows;
        }
        this._lastQueryPlan = { type: 'index_scan', index: indexPlan.indexName, column: indexPlan.column, residual: !!indexPlan.residual };
      } else {
        rows = rows.filter(row => this._evaluateCondition(row, query.where));
        this._lastQueryPlan = { type: 'full_scan', table: query.from };
      }
    } else {
      this._lastQueryPlan = { type: 'full_scan', table: query.from };
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

  _executeExplain(query) {
    // Execute the inner query to populate plan
    this.execute(query.inner);
    return { type: 'plan', plan: this._lastQueryPlan || { type: 'unknown' } };
  }

  // Try to use a B-tree index for a WHERE condition
  // Note: column references and string literals are both JS strings.
  // We distinguish by checking if the string is a known column name.
  _tryIndexScan(tableName, cond) {
    if (!tableName) return null;
    const table = this.tables.get(tableName);
    if (!table) return null;
    const colNames = new Set(table.columnNames());

    // Simple equality: column = value
    if (cond.op === '=') {
      // left is column, right is value
      if (typeof cond.left === 'string' && colNames.has(cond.left)) {
        const index = table.getIndex(cond.left);
        if (index) {
          const val = typeof cond.right === 'string' && colNames.has(cond.right) ? null : cond.right;
          if (val !== null) {
            return { indexName: index.name, column: cond.left, rowIndices: index.lookup(val), residual: null };
          }
        }
      }
      // right is column, left is value
      if (typeof cond.right === 'string' && colNames.has(cond.right)) {
        const index = table.getIndex(cond.right);
        if (index) {
          const val = typeof cond.left === 'string' && colNames.has(cond.left) ? null : cond.left;
          if (val !== null) {
            return { indexName: index.name, column: cond.right, rowIndices: index.lookup(val), residual: null };
          }
        }
      }
    }

    // Range: column > value, column < value, column >= value, column <= value
    if ((cond.op === '>' || cond.op === '>=' || cond.op === '<' || cond.op === '<=') && typeof cond.left === 'string' && colNames.has(cond.left)) {
      const index = table.getIndex(cond.left);
      if (index) {
        const val = cond.right;
        let rowIndices;
        if (cond.op === '>') rowIndices = index.greaterThan(val);
        else if (cond.op === '>=') rowIndices = [...index.lookup(val), ...index.greaterThan(val)];
        else if (cond.op === '<') rowIndices = index.lessThan(val);
        else rowIndices = [...index.lessThan(val), ...index.lookup(val)];
        return { indexName: index.name, column: cond.left, rowIndices, residual: null };
      }
    }

    // AND: try to use index on one side, filter the other
    if (cond.op === 'AND') {
      const leftPlan = this._tryIndexScan(tableName, cond.left);
      if (leftPlan) {
        return { ...leftPlan, residual: cond.right };
      }
      const rightPlan = this._tryIndexScan(tableName, cond.right);
      if (rightPlan) {
        return { ...rightPlan, residual: cond.left };
      }
    }

    return null;
  }

  _resolveValue(row, ref) {
    // Column references: { col: 'name' } or raw string for backward compat
    if (ref && typeof ref === 'object' && ref.col) return row[ref.col];
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
    
    // Determine what's a column reference vs a literal value
    // Column refs are strings that exist as column names in the row
    // Otherwise treat as literal
    const resolveArg = (arg) => {
      if (typeof arg === 'string') {
        // If the row has this key, it's a column reference
        if (arg in row) return row[arg];
        // Otherwise it's a string literal
        return arg;
      }
      if (Array.isArray(arg)) return arg;
      return arg;
    };
    
    const left = resolveArg(cond.left);
    const right = resolveArg(cond.right);
    
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

// Index + explain helpers
export function createIndex(name, table, column) {
  return { type: 'createIndex', name, table, column };
}

export function explain(query) {
  return { type: 'explain', inner: query };
}
