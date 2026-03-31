/**
 * Tiny YAML Parser
 * 
 * Parses a subset of YAML:
 * - Scalars: strings, numbers, booleans, null
 * - Mappings (key: value)
 * - Sequences (- item)
 * - Nested structures (indentation-based)
 * - Quoted strings (single and double)
 * - Multi-line strings (| and >)
 * - Comments (#)
 * - Flow sequences [a, b, c]
 * - Flow mappings {a: 1, b: 2}
 */

function parse(src) {
  const lines = src.split('\n');
  let pos = 0;

  function peekLine() { return pos < lines.length ? lines[pos] : null; }
  function readLine() { return lines[pos++]; }
  
  function getIndent(line) {
    const m = line.match(/^(\s*)/);
    return m ? m[1].length : 0;
  }

  function stripComment(line) {
    let inSingle = false, inDouble = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === "'" && !inDouble) inSingle = !inSingle;
      if (line[i] === '"' && !inSingle) inDouble = !inDouble;
      if (line[i] === '#' && !inSingle && !inDouble && (i === 0 || line[i - 1] === ' ')) {
        return line.slice(0, i).trimEnd();
      }
    }
    return line;
  }

  function parseValue(val) {
    val = val.trim();
    if (val === '' || val === '~' || val === 'null') return null;
    if (val === 'true' || val === 'True' || val === 'TRUE') return true;
    if (val === 'false' || val === 'False' || val === 'FALSE') return false;
    
    // Quoted strings
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      return val.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\').replace(/\\"/g, '"');
    }
    
    // Flow sequence
    if (val.startsWith('[') && val.endsWith(']')) {
      return parseFlowSequence(val);
    }
    
    // Flow mapping
    if (val.startsWith('{') && val.endsWith('}')) {
      return parseFlowMapping(val);
    }
    
    // Numbers
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(val)) {
      const n = Number(val);
      if (!isNaN(n)) return n;
    }
    if (/^0x[0-9a-fA-F]+$/.test(val)) return parseInt(val, 16);
    if (/^0o[0-7]+$/.test(val)) return parseInt(val.slice(2), 8);
    
    return val;
  }

  function parseFlowSequence(src) {
    const inner = src.slice(1, -1).trim();
    if (inner === '') return [];
    return splitFlow(inner).map(s => parseValue(s.trim()));
  }

  function parseFlowMapping(src) {
    const inner = src.slice(1, -1).trim();
    if (inner === '') return {};
    const result = {};
    for (const part of splitFlow(inner)) {
      const colonIdx = part.indexOf(':');
      if (colonIdx === -1) continue;
      const key = part.slice(0, colonIdx).trim();
      const val = part.slice(colonIdx + 1).trim();
      result[key] = parseValue(val);
    }
    return result;
  }

  function splitFlow(str) {
    const parts = [];
    let depth = 0, current = '', inQuote = false, quoteChar = '';
    for (const ch of str) {
      if (!inQuote && (ch === '"' || ch === "'")) { inQuote = true; quoteChar = ch; current += ch; continue; }
      if (inQuote && ch === quoteChar) { inQuote = false; current += ch; continue; }
      if (!inQuote) {
        if (ch === '[' || ch === '{') depth++;
        if (ch === ']' || ch === '}') depth--;
        if (ch === ',' && depth === 0) { parts.push(current); current = ''; continue; }
      }
      current += ch;
    }
    if (current.trim()) parts.push(current);
    return parts;
  }

  function parseBlock(minIndent) {
    while (pos < lines.length) {
      const line = peekLine();
      if (line === null) return null;
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) { pos++; continue; }
      
      const indent = getIndent(line);
      if (indent < minIndent) return null;
      
      const content = stripComment(trimmed);
      
      // Sequence item
      if (content.startsWith('- ')) {
        return parseSequence(indent);
      }
      if (content === '-') {
        return parseSequence(indent);
      }
      
      // Mapping
      const colonIdx = findColon(content);
      if (colonIdx > 0) {
        return parseMapping(indent);
      }
      
      // Scalar
      pos++;
      return parseValue(content);
    }
    return null;
  }

  function findColon(line) {
    let inQuote = false, quoteChar = '';
    for (let i = 0; i < line.length; i++) {
      if (!inQuote && (line[i] === '"' || line[i] === "'")) { inQuote = true; quoteChar = line[i]; continue; }
      if (inQuote && line[i] === quoteChar) { inQuote = false; continue; }
      if (!inQuote && line[i] === ':' && (i + 1 >= line.length || line[i + 1] === ' ')) {
        return i;
      }
    }
    return -1;
  }

  function parseSequence(indent) {
    const result = [];
    while (pos < lines.length) {
      const line = peekLine();
      if (line === null) break;
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) { pos++; continue; }
      
      const curIndent = getIndent(line);
      if (curIndent < indent) break;
      if (curIndent > indent) break; // nested, shouldn't happen at this level
      
      const content = stripComment(trimmed);
      if (!content.startsWith('-')) break;
      
      pos++;
      const afterDash = content.slice(1).trim();
      
      if (afterDash === '') {
        // Block value follows
        const val = parseBlock(indent + 2);
        result.push(val);
      } else {
        // Check if it's a mapping key
        const colonIdx = findColon(afterDash);
        if (colonIdx > 0) {
          // Inline mapping in sequence
          pos--;
          const saved = lines[pos];
          // Parse as nested mapping
          const key = afterDash.slice(0, colonIdx).trim();
          const valStr = afterDash.slice(colonIdx + 1).trim();
          pos++;
          
          if (valStr === '' || valStr === '|' || valStr === '>') {
            const obj = {};
            if (valStr === '|' || valStr === '>') {
              obj[key] = parseMultiline(indent + 2, valStr);
            } else {
              obj[key] = parseBlock(indent + 2);
            }
            // Continue reading more keys at same indent+2
            while (pos < lines.length) {
              const nextLine = peekLine();
              if (!nextLine || nextLine.trim() === '' || nextLine.trim().startsWith('#')) { pos++; continue; }
              const nextIndent = getIndent(nextLine);
              if (nextIndent <= indent) break;
              const nextContent = stripComment(nextLine.trim());
              const nextColon = findColon(nextContent);
              if (nextColon > 0) {
                pos++;
                const nk = nextContent.slice(0, nextColon).trim();
                const nv = nextContent.slice(nextColon + 1).trim();
                if (nv === '') {
                  obj[nk] = parseBlock(nextIndent + 2);
                } else {
                  obj[nk] = parseValue(nv);
                }
              } else break;
            }
            result.push(obj);
          } else {
            const obj = { [key]: parseValue(valStr) };
            // Read more keys at same sub-indent
            while (pos < lines.length) {
              const nextLine = peekLine();
              if (!nextLine || nextLine.trim() === '' || nextLine.trim().startsWith('#')) { pos++; continue; }
              const nextIndent = getIndent(nextLine);
              if (nextIndent <= indent) break;
              const nextContent = stripComment(nextLine.trim());
              const nextColon = findColon(nextContent);
              if (nextColon > 0) {
                pos++;
                const nk = nextContent.slice(0, nextColon).trim();
                const nv = nextContent.slice(nextColon + 1).trim();
                obj[nk] = nv === '' ? parseBlock(nextIndent + 2) : parseValue(nv);
              } else break;
            }
            result.push(obj);
          }
        } else {
          result.push(parseValue(afterDash));
        }
      }
    }
    return result;
  }

  function parseMapping(indent) {
    const result = {};
    while (pos < lines.length) {
      const line = peekLine();
      if (line === null) break;
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) { pos++; continue; }
      
      const curIndent = getIndent(line);
      if (curIndent < indent) break;
      if (curIndent > indent) break;
      
      const content = stripComment(trimmed);
      const colonIdx = findColon(content);
      if (colonIdx <= 0) break;
      
      pos++;
      const key = content.slice(0, colonIdx).trim();
      const valStr = content.slice(colonIdx + 1).trim();
      
      if (valStr === '|' || valStr === '>') {
        result[key] = parseMultiline(indent + 2, valStr);
      } else if (valStr === '') {
        result[key] = parseBlock(indent + 2);
      } else {
        result[key] = parseValue(valStr);
      }
    }
    return result;
  }

  function parseMultiline(indent, style) {
    const lines_ = [];
    while (pos < lines.length) {
      const line = peekLine();
      if (line === null) break;
      if (line.trim() === '') { lines_.push(''); pos++; continue; }
      if (getIndent(line) < indent) break;
      lines_.push(line.slice(indent));
      pos++;
    }
    // Remove trailing empty lines
    while (lines_.length > 0 && lines_[lines_.length - 1] === '') lines_.pop();
    
    if (style === '|') return lines_.join('\n');
    // Folded: join with spaces, preserve blank lines as newlines
    return lines_.join(' ').replace(/  +/g, '\n');
  }

  // Skip document markers
  while (pos < lines.length) {
    const line = peekLine();
    if (line && (line.trim() === '---' || line.trim() === '')) { pos++; continue; }
    break;
  }

  return parseBlock(0);
}

function stringify(value, indent = 0) {
  const pad = ' '.repeat(indent);
  
  if (value === null || value === undefined) return `${pad}null`;
  if (typeof value === 'boolean') return `${pad}${value}`;
  if (typeof value === 'number') return `${pad}${value}`;
  if (typeof value === 'string') {
    if (value.includes('\n')) return `${pad}|\n${value.split('\n').map(l => `${pad}  ${l}`).join('\n')}`;
    if (value.includes(':') || value.includes('#') || value.startsWith('{') || value.startsWith('[')) {
      return `${pad}"${value}"`;
    }
    return `${pad}${value}`;
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`;
    return value.map(item => {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const entries = Object.entries(item);
        const first = entries[0];
        const rest = entries.slice(1);
        let s = `${pad}- ${first[0]}: ${formatInlineValue(first[1])}`;
        for (const [k, v] of rest) {
          s += `\n${pad}  ${k}: ${formatInlineValue(v)}`;
        }
        return s;
      }
      return `${pad}- ${formatInlineValue(item)}`;
    }).join('\n');
  }
  
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return `${pad}{}`;
    return entries.map(([k, v]) => {
      if (typeof v === 'object' && v !== null) {
        return `${pad}${k}:\n${stringify(v, indent + 2)}`;
      }
      return `${pad}${k}: ${formatInlineValue(v)}`;
    }).join('\n');
  }
  
  return `${pad}${value}`;
}

function formatInlineValue(v) {
  if (v === null) return 'null';
  if (typeof v === 'string' && (v.includes(':') || v.includes('#'))) return `"${v}"`;
  return String(v);
}

module.exports = { parse, stringify };
