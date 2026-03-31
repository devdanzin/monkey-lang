/**
 * Tiny SQL Parser
 * 
 * Parse basic SQL statements into ASTs:
 * - SELECT with columns, aliases, *
 * - FROM with table names, aliases
 * - WHERE with conditions (AND, OR, comparisons)
 * - JOIN (INNER, LEFT, RIGHT)
 * - ORDER BY, GROUP BY, HAVING
 * - LIMIT, OFFSET
 * - INSERT, UPDATE, DELETE
 * - Aggregate functions: COUNT, SUM, AVG, MAX, MIN
 */

function parse(sql) {
  const tokens = tokenize(sql);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (val) => {
    const t = next();
    if (t.toUpperCase() !== val.toUpperCase()) throw new Error(`Expected ${val}, got ${t}`);
    return t;
  };
  const match = (val) => peek() && peek().toUpperCase() === val.toUpperCase();
  const matchNext = (val) => { if (match(val)) { next(); return true; } return false; };

  function parseStatement() {
    const kw = peek().toUpperCase();
    if (kw === 'SELECT') return parseSelect();
    if (kw === 'INSERT') return parseInsert();
    if (kw === 'UPDATE') return parseUpdate();
    if (kw === 'DELETE') return parseDelete();
    throw new Error(`Unexpected: ${peek()}`);
  }

  function parseSelect() {
    expect('SELECT');
    const distinct = matchNext('DISTINCT');
    const columns = parseColumns();
    expect('FROM');
    const from = parseFrom();
    const joins = [];
    while (peek() && ['JOIN', 'INNER', 'LEFT', 'RIGHT', 'CROSS'].includes(peek().toUpperCase())) {
      joins.push(parseJoin());
    }
    const where = matchNext('WHERE') ? parseExpr() : null;
    const groupBy = matchNext('GROUP') ? (expect('BY'), parseColumnList()) : null;
    const having = matchNext('HAVING') ? parseExpr() : null;
    const orderBy = matchNext('ORDER') ? (expect('BY'), parseOrderBy()) : null;
    const limit = matchNext('LIMIT') ? parseInt(next(), 10) : null;
    const offset = matchNext('OFFSET') ? parseInt(next(), 10) : null;
    return { type: 'select', distinct, columns, from, joins, where, groupBy, having, orderBy, limit, offset };
  }

  function parseColumns() {
    if (match('*')) { next(); return [{ expr: '*' }]; }
    const cols = [];
    do {
      const expr = parseExpr();
      const alias = matchNext('AS') ? next() : null;
      cols.push({ expr, alias });
    } while (matchNext(','));
    return cols;
  }

  function parseColumnList() {
    const cols = [];
    do { cols.push(next()); } while (matchNext(','));
    return cols;
  }

  function parseFrom() {
    const table = next();
    const alias = (peek() && !['WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'ORDER', 'GROUP', 'LIMIT', 'HAVING', 'CROSS'].includes(peek().toUpperCase()) && peek() !== ';') ? next() : null;
    return { table, alias };
  }

  function parseJoin() {
    let type = 'INNER';
    if (match('LEFT')) { type = 'LEFT'; next(); matchNext('OUTER'); }
    else if (match('RIGHT')) { type = 'RIGHT'; next(); matchNext('OUTER'); }
    else if (match('CROSS')) { type = 'CROSS'; next(); }
    else if (match('INNER')) { next(); }
    expect('JOIN');
    const table = next();
    const alias = matchNext('AS') ? next() : null;
    const on = matchNext('ON') ? parseExpr() : null;
    return { type, table, alias, on };
  }

  function parseOrderBy() {
    const items = [];
    do {
      const col = next();
      const dir = matchNext('DESC') ? 'DESC' : (matchNext('ASC'), 'ASC');
      items.push({ column: col, direction: dir });
    } while (matchNext(','));
    return items;
  }

  function parseInsert() {
    expect('INSERT'); expect('INTO');
    const table = next();
    let columns = null;
    if (matchNext('(')) {
      columns = [];
      do { columns.push(next()); } while (matchNext(','));
      expect(')');
    }
    expect('VALUES'); expect('(');
    const values = [];
    do { values.push(parseValue()); } while (matchNext(','));
    expect(')');
    return { type: 'insert', table, columns, values };
  }

  function parseUpdate() {
    expect('UPDATE');
    const table = next();
    expect('SET');
    const set = [];
    do {
      const col = next();
      expect('=');
      const val = parseValue();
      set.push({ column: col, value: val });
    } while (matchNext(','));
    const where = matchNext('WHERE') ? parseExpr() : null;
    return { type: 'update', table, set, where };
  }

  function parseDelete() {
    expect('DELETE'); expect('FROM');
    const table = next();
    const where = matchNext('WHERE') ? parseExpr() : null;
    return { type: 'delete', table, where };
  }

  function parseExpr() {
    let left = parseComparison();
    while (peek() && ['AND', 'OR'].includes(peek().toUpperCase())) {
      const op = next().toUpperCase();
      const right = parseComparison();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  function parseComparison() {
    const left = parseValue();
    if (peek() && ['=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'IN', 'IS'].includes(peek().toUpperCase())) {
      const op = next().toUpperCase();
      if (op === 'IS') {
        const not = matchNext('NOT');
        expect('NULL');
        return { type: 'is_null', expr: left, negated: not };
      }
      const right = parseValue();
      return { type: 'comparison', op, left, right };
    }
    return left;
  }

  function parseValue() {
    const t = peek();
    if (!t) throw new Error('Unexpected end');
    
    // Aggregate functions
    const upper = t.toUpperCase();
    if (['COUNT', 'SUM', 'AVG', 'MAX', 'MIN'].includes(upper)) {
      next(); expect('(');
      const arg = match('*') ? next() : next();
      expect(')');
      return { type: 'aggregate', fn: upper, arg };
    }
    
    // Parenthesized
    if (t === '(') { next(); const e = parseExpr(); expect(')'); return e; }
    
    // String literal
    if (t.startsWith("'")) {
      next();
      return { type: 'string', value: t.slice(1, -1) };
    }
    
    // Number
    if (/^-?\d+(\.\d+)?$/.test(t)) {
      next();
      return { type: 'number', value: parseFloat(t) };
    }
    
    // NULL
    if (upper === 'NULL') { next(); return { type: 'null' }; }
    
    // Identifier (possibly table.column)
    next();
    if (matchNext('.')) {
      const col = next();
      return { type: 'column', table: t, column: col };
    }
    return { type: 'identifier', name: t };
  }

  return parseStatement();
}

function tokenize(sql) {
  const tokens = [];
  let i = 0;
  while (i < sql.length) {
    if (/\s/.test(sql[i])) { i++; continue; }
    if (sql[i] === "'") {
      let s = "'";
      i++;
      while (i < sql.length && sql[i] !== "'") s += sql[i++];
      s += "'"; i++;
      tokens.push(s);
      continue;
    }
    for (const op of ['!=', '<>', '<=', '>=']) {
      if (sql.startsWith(op, i)) { tokens.push(op); i += op.length; continue; }
    }
    if ('(),=<>*;.'.includes(sql[i])) { tokens.push(sql[i++]); continue; }
    let word = '';
    while (i < sql.length && /[a-zA-Z0-9_.+\-]/.test(sql[i])) word += sql[i++];
    if (word) tokens.push(word);
  }
  return tokens;
}

module.exports = { parse, tokenize };
