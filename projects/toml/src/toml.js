// Tiny TOML parser — basic subset

export function parse(input) {
  const result = {};
  let currentTable = result;
  let currentPath = [];

  for (const rawLine of input.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;

    // Table header [section] or [section.subsection]
    const tableMatch = line.match(/^\[([^\]]+)\]$/);
    if (tableMatch) {
      const path = tableMatch[1].split('.').map(s => s.trim());
      currentPath = path;
      currentTable = result;
      for (const key of path) {
        if (!currentTable[key]) currentTable[key] = {};
        currentTable = currentTable[key];
      }
      continue;
    }

    // Array of tables [[section]]
    const arrayMatch = line.match(/^\[\[([^\]]+)\]\]$/);
    if (arrayMatch) {
      const path = arrayMatch[1].split('.').map(s => s.trim());
      let target = result;
      for (let i = 0; i < path.length - 1; i++) {
        if (!target[path[i]]) target[path[i]] = {};
        target = target[path[i]];
      }
      const key = path[path.length - 1];
      if (!target[key]) target[key] = [];
      const obj = {};
      target[key].push(obj);
      currentTable = obj;
      continue;
    }

    // Key = Value
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const rawValue = line.slice(eqIdx + 1).trim();
    currentTable[key] = parseValue(rawValue);
  }

  return result;
}

function parseValue(raw) {
  // String (basic)
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1); // Literal string
  // Boolean
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // Date
  if (/^\d{4}-\d{2}-\d{2}(T|\s)/.test(raw)) return new Date(raw);
  // Float
  if (/^[+-]?\d+\.\d+$/.test(raw)) return parseFloat(raw);
  // Integer
  if (/^[+-]?\d+$/.test(raw)) return parseInt(raw);
  // Hex
  if (/^0x[0-9a-fA-F]+$/.test(raw)) return parseInt(raw, 16);
  // Array
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return raw.slice(1, -1).split(',').map(v => parseValue(v.trim())).filter(v => v !== '');
  }
  // Inline table
  if (raw.startsWith('{') && raw.endsWith('}')) {
    const obj = {};
    for (const pair of raw.slice(1, -1).split(',')) {
      const [k, ...rest] = pair.split('=');
      if (k.trim()) obj[k.trim()] = parseValue(rest.join('=').trim());
    }
    return obj;
  }
  return raw;
}
