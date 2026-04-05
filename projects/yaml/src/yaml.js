// yaml.js — YAML parser (subset)

export function parse(input) {
  const lines = input.split('\n');
  let pos = 0;

  function peekLine() { return pos < lines.length ? lines[pos] : null; }
  function nextLine() { return lines[pos++]; }
  function getIndent(line) { return line ? line.match(/^(\s*)/)[1].length : 0; }
  function stripComment(line) { 
    let inQuote = false, qChar = '';
    for (let i = 0; i < line.length; i++) {
      if (!inQuote && (line[i] === '"' || line[i] === "'")) { inQuote = true; qChar = line[i]; }
      else if (inQuote && line[i] === qChar) inQuote = false;
      else if (!inQuote && line[i] === '#') return line.slice(0, i).trimEnd();
    }
    return line;
  }

  function parseValue(str) {
    str = str.trim();
    if (!str || str === '~' || str === 'null' || str === 'Null' || str === 'NULL') return null;
    if (str === 'true' || str === 'True' || str === 'TRUE') return true;
    if (str === 'false' || str === 'False' || str === 'FALSE') return false;
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) return str.slice(1, -1);
    const num = Number(str);
    if (!isNaN(num) && str !== '') return num;
    return str;
  }

  function parseBlock(baseIndent) {
    while (pos < lines.length) {
      const line = peekLine();
      if (line === null) return null;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) { pos++; continue; }
      
      const indent = getIndent(line);
      if (indent < baseIndent) return null;

      // Flow sequence
      if (trimmed.startsWith('[')) return parseFlowSequence(trimmed);
      // Flow mapping
      if (trimmed.startsWith('{')) return parseFlowMapping(trimmed);

      // Block sequence
      if (trimmed.startsWith('- ') || trimmed === '-') {
        return parseBlockSequence(indent);
      }

      // Block mapping (key: value)
      if (trimmed.includes(':')) {
        return parseBlockMapping(indent);
      }

      // Scalar
      pos++;
      return parseValue(stripComment(trimmed));
    }
    return null;
  }

  function parseBlockSequence(baseIndent) {
    const result = [];
    while (pos < lines.length) {
      const line = peekLine();
      if (line === null) break;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) { pos++; continue; }
      
      const indent = getIndent(line);
      if (indent < baseIndent) break;
      if (indent > baseIndent) break;
      
      if (!trimmed.startsWith('-')) break;
      pos++;
      
      const afterDash = trimmed.slice(1).trim();
      const cleaned = stripComment(afterDash);
      
      if (!cleaned) {
        // Nested block
        result.push(parseBlock(indent + 2));
      } else if (cleaned.includes(':') && !cleaned.startsWith('"') && !cleaned.startsWith("'")) {
        // Inline mapping in sequence
        pos--;
        const saved = lines[pos];
        lines[pos] = ' '.repeat(indent + 2) + cleaned;
        result.push(parseBlock(indent + 2));
        lines[pos - 1] = saved; // doesn't matter, pos already advanced
      } else {
        result.push(parseValue(cleaned));
      }
    }
    return result;
  }

  function parseBlockMapping(baseIndent) {
    const result = {};
    while (pos < lines.length) {
      const line = peekLine();
      if (line === null) break;
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) { pos++; continue; }
      
      const indent = getIndent(line);
      if (indent < baseIndent) break;
      if (indent > baseIndent) break;
      
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) break;
      
      const key = trimmed.slice(0, colonIdx).trim();
      let valueStr = stripComment(trimmed.slice(colonIdx + 1)).trim();
      pos++;
      
      if (valueStr === '|') {
        // Literal block scalar
        result[key] = parseLiteralBlock(indent);
      } else if (valueStr === '>') {
        // Folded block scalar
        result[key] = parseFoldedBlock(indent);
      } else if (!valueStr) {
        // Nested structure
        result[key] = parseBlock(indent + 2);
      } else {
        result[key] = parseValue(valueStr);
      }
    }
    return result;
  }

  function parseLiteralBlock(parentIndent) {
    const lines_ = [];
    let blockIndent = -1;
    while (pos < lines.length) {
      const line = peekLine();
      if (line === null) break;
      const indent = getIndent(line);
      if (line.trim() === '') { lines_.push(''); pos++; continue; }
      if (indent <= parentIndent) break;
      if (blockIndent === -1) blockIndent = indent;
      lines_.push(line.slice(blockIndent));
      pos++;
    }
    return lines_.join('\n');
  }

  function parseFoldedBlock(parentIndent) {
    const lines_ = [];
    let blockIndent = -1;
    while (pos < lines.length) {
      const line = peekLine();
      if (line === null) break;
      const indent = getIndent(line);
      if (line.trim() === '') { lines_.push(''); pos++; continue; }
      if (indent <= parentIndent) break;
      if (blockIndent === -1) blockIndent = indent;
      lines_.push(line.slice(blockIndent));
      pos++;
    }
    return lines_.join(' ').replace(/\s+/g, ' ').trim();
  }

  function parseFlowSequence(str) {
    pos++;
    const inner = str.slice(1, -1).trim();
    if (!inner) return [];
    return splitFlow(inner).map(s => parseValue(s.trim()));
  }

  function parseFlowMapping(str) {
    pos++;
    const inner = str.slice(1, -1).trim();
    if (!inner) return {};
    const result = {};
    for (const pair of splitFlow(inner)) {
      const [key, ...rest] = pair.split(':');
      result[key.trim()] = parseValue(rest.join(':').trim());
    }
    return result;
  }

  function splitFlow(str) {
    const parts = [];
    let depth = 0, current = '';
    for (const ch of str) {
      if (ch === '[' || ch === '{') depth++;
      if (ch === ']' || ch === '}') depth--;
      if (ch === ',' && depth === 0) { parts.push(current); current = ''; }
      else current += ch;
    }
    if (current.trim()) parts.push(current);
    return parts;
  }

  return parseBlock(0);
}

export function stringify(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  if (obj === null) return 'null';
  if (typeof obj === 'boolean') return String(obj);
  if (typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') return obj.includes('\n') ? `|\n${obj.split('\n').map(l => pad + '  ' + l).join('\n')}` : obj;
  if (Array.isArray(obj)) return obj.map(item => {
    const val = typeof item === 'object' && item !== null ? '\n' + stringify(item, indent + 1) : ' ' + stringify(item, 0);
    return `${pad}-${val}`;
  }).join('\n');
  if (typeof obj === 'object') return Object.entries(obj).map(([key, val]) => {
    if (typeof val === 'object' && val !== null) return `${pad}${key}:\n${stringify(val, indent + 1)}`;
    return `${pad}${key}: ${stringify(val, 0)}`;
  }).join('\n');
  return String(obj);
}
