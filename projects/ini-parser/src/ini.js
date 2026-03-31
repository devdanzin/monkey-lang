// INI file parser — parse and stringify

export function parse(input) {
  const result = {};
  let currentSection = null;

  for (const rawLine of input.split('\n')) {
    const line = rawLine.trim();
    if (!line || line[0] === ';' || line[0] === '#') continue; // empty or comment

    // Section header
    const secMatch = line.match(/^\[([^\]]+)\]$/);
    if (secMatch) { currentSection = secMatch[1].trim(); result[currentSection] = result[currentSection] || {}; continue; }

    // Key=Value
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();

    // Strip inline comments
    const commentIdx = value.search(/\s+[;#]/);
    if (commentIdx >= 0) value = value.slice(0, commentIdx).trim();

    // Strip quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Type coercion
    value = coerce(value);

    if (currentSection) result[currentSection][key] = value;
    else result[key] = value; // global keys
  }

  return result;
}

function coerce(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === '') return '';
  if (/^-?\d+$/.test(value)) return parseInt(value);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}

export function stringify(obj) {
  const lines = [];
  // Global keys first
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'object' && val !== null) continue;
    lines.push(`${key} = ${formatValue(val)}`);
  }
  // Sections
  for (const [section, vals] of Object.entries(obj)) {
    if (typeof vals !== 'object' || vals === null) continue;
    if (lines.length > 0) lines.push('');
    lines.push(`[${section}]`);
    for (const [key, val] of Object.entries(vals)) {
      lines.push(`${key} = ${formatValue(val)}`);
    }
  }
  return lines.join('\n');
}

function formatValue(val) {
  if (typeof val === 'string' && val.includes(' ')) return `"${val}"`;
  return String(val);
}

export function get(obj, path) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}
