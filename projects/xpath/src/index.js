/**
 * Tiny XPath-like Selector for JS objects
 * 
 * Navigate nested objects/arrays with path expressions:
 * - /key — direct child
 * - //key — recursive descent (find anywhere)
 * - [n] — array index
 * - [last()] — last element
 * - [@attr=val] — filter by attribute
 * - [@attr>val] — numeric comparison
 * - * — wildcard (all children)
 * - .. — parent
 * - | — union (combine results)
 */

function select(obj, path) {
  const parts = parse(path);
  let results = [{ value: obj, parent: null, key: null }];
  
  for (const part of parts) {
    results = step(results, part, obj);
  }
  
  return results.map(r => r.value);
}

function selectOne(obj, path) {
  const results = select(obj, path);
  return results.length > 0 ? results[0] : undefined;
}

function parse(path) {
  // Handle union
  if (path.includes('|')) {
    return [{ type: 'union', paths: path.split('|').map(p => parse(p.trim())) }];
  }
  
  const parts = [];
  let i = 0;
  
  while (i < path.length) {
    if (path[i] === '/') {
      if (path[i + 1] === '/') {
        i += 2;
        const name = readName(path, i);
        i += name.length;
        parts.push({ type: 'descendant', name });
      } else {
        i++;
        if (i < path.length && path[i] !== '[') {
          const name = readName(path, i);
          i += name.length;
          parts.push({ type: 'child', name });
        }
      }
    } else if (path[i] === '[') {
      i++;
      const content = readUntil(path, i, ']');
      i += content.length + 1;
      
      if (content === 'last()') {
        parts.push({ type: 'last' });
      } else if (content.startsWith('@')) {
        const filter = parseFilter(content.slice(1));
        parts.push({ type: 'filter', ...filter });
      } else {
        parts.push({ type: 'index', index: parseInt(content, 10) });
      }
    } else if (path.startsWith('..', i)) {
      parts.push({ type: 'parent' });
      i += 2;
    } else {
      const name = readName(path, i);
      if (name) {
        parts.push({ type: 'child', name });
        i += name.length;
      } else {
        i++;
      }
    }
  }
  
  return parts;
}

function readName(path, start) {
  let end = start;
  while (end < path.length && path[end] !== '/' && path[end] !== '[' && path[end] !== '|') end++;
  return path.slice(start, end);
}

function readUntil(path, start, char) {
  let end = start;
  let depth = 0;
  while (end < path.length) {
    if (path[end] === '(' ) depth++;
    if (path[end] === ')') depth--;
    if (path[end] === char && depth === 0) break;
    end++;
  }
  return path.slice(start, end);
}

function parseFilter(content) {
  for (const op of ['>=', '<=', '!=', '=', '>', '<']) {
    const idx = content.indexOf(op);
    if (idx !== -1) {
      const attr = content.slice(0, idx).trim();
      let val = content.slice(idx + op.length).trim();
      if (val.startsWith("'") || val.startsWith('"')) val = val.slice(1, -1);
      else if (/^-?\d+$/.test(val)) val = parseInt(val, 10);
      return { attr, op: op === '=' ? 'eq' : op === '!=' ? 'ne' : op === '>' ? 'gt' : op === '<' ? 'lt' : op === '>=' ? 'gte' : 'lte', val };
    }
  }
  return { attr: content, op: 'exists', val: null };
}

function step(nodes, part, root) {
  if (part.type === 'union') {
    const all = [];
    for (const subPath of part.paths) {
      let results = [{ value: root, parent: null, key: null }];
      for (const p of subPath) results = step(results, p, root);
      all.push(...results);
    }
    return all;
  }
  
  const results = [];
  
  for (const node of nodes) {
    const val = node.value;
    
    switch (part.type) {
      case 'child':
        if (part.name === '*') {
          if (Array.isArray(val)) {
            val.forEach((v, i) => results.push({ value: v, parent: val, key: i }));
          } else if (typeof val === 'object' && val !== null) {
            Object.entries(val).forEach(([k, v]) => results.push({ value: v, parent: val, key: k }));
          }
        } else if (typeof val === 'object' && val !== null) {
          if (val[part.name] !== undefined) {
            results.push({ value: val[part.name], parent: val, key: part.name });
          }
        }
        break;
        
      case 'descendant':
        findDescendants(val, part.name, results);
        break;
        
      case 'index':
        if (Array.isArray(val) && part.index < val.length) {
          results.push({ value: val[part.index], parent: val, key: part.index });
        }
        break;
        
      case 'last':
        if (Array.isArray(val) && val.length > 0) {
          results.push({ value: val[val.length - 1], parent: val, key: val.length - 1 });
        }
        break;
        
      case 'filter':
        if (Array.isArray(val)) {
          val.forEach((item, i) => {
            if (matchFilter(item, part)) {
              results.push({ value: item, parent: val, key: i });
            }
          });
        }
        break;
        
      case 'parent':
        if (node.parent) results.push({ value: node.parent, parent: null, key: null });
        break;
    }
  }
  
  return results;
}

function findDescendants(obj, name, results) {
  if (typeof obj !== 'object' || obj === null) return;
  
  if (name === '*') {
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => {
        results.push({ value: v, parent: obj, key: i });
        findDescendants(v, name, results);
      });
    } else {
      Object.entries(obj).forEach(([k, v]) => {
        results.push({ value: v, parent: obj, key: k });
        findDescendants(v, name, results);
      });
    }
  } else {
    if (!Array.isArray(obj) && obj[name] !== undefined) {
      results.push({ value: obj[name], parent: obj, key: name });
    }
    const children = Array.isArray(obj) ? obj : Object.values(obj);
    for (const child of children) {
      findDescendants(child, name, results);
    }
  }
}

function matchFilter(item, filter) {
  if (typeof item !== 'object' || item === null) return false;
  const val = item[filter.attr];
  
  switch (filter.op) {
    case 'exists': return val !== undefined;
    case 'eq': return String(val) === String(filter.val);
    case 'ne': return String(val) !== String(filter.val);
    case 'gt': return val > filter.val;
    case 'lt': return val < filter.val;
    case 'gte': return val >= filter.val;
    case 'lte': return val <= filter.val;
  }
  return false;
}

module.exports = { select, selectOne, parse };
