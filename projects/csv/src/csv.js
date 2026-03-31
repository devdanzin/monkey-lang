// CSV parser/serializer — RFC 4180 compliant

export function parse(input, { header = true, delimiter = ',', quote = '"' } = {}) {
  const rows = parseRows(input, delimiter, quote);
  if (!header || rows.length === 0) return rows;
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
    return obj;
  });
}

export function parseRows(input, delimiter = ',', quote = '"') {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === quote) {
        if (i + 1 < input.length && input[i + 1] === quote) { field += quote; i += 2; }
        else { inQuotes = false; i++; }
      } else { field += ch; i++; }
    } else {
      if (ch === quote) { inQuotes = true; i++; }
      else if (ch === delimiter) { row.push(field); field = ''; i++; }
      else if (ch === '\r' && input[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i += 2; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
      else { field += ch; i++; }
    }
  }
  if (field || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export function stringify(data, { header = true, delimiter = ',', quote = '"' } = {}) {
  if (data.length === 0) return '';
  const isObjects = typeof data[0] === 'object' && !Array.isArray(data[0]);
  const headers = isObjects ? Object.keys(data[0]) : null;
  const rows = isObjects ? data.map(obj => headers.map(h => obj[h])) : data;

  const lines = [];
  if (header && headers) lines.push(headers.map(h => escapeField(String(h), delimiter, quote)).join(delimiter));
  for (const row of rows) {
    lines.push(row.map(v => escapeField(v === null || v === undefined ? '' : String(v), delimiter, quote)).join(delimiter));
  }
  return lines.join('\n');
}

function escapeField(field, delimiter, quote) {
  if (field.includes(quote) || field.includes(delimiter) || field.includes('\n') || field.includes('\r')) {
    return quote + field.replace(new RegExp(quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), quote + quote) + quote;
  }
  return field;
}
