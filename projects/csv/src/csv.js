// csv.js — CSV parser/serializer (RFC 4180)

export function parse(input, options = {}) {
  const delimiter = options.delimiter || ',';
  const hasHeader = options.header !== false;
  const typeInfer = options.types !== false;

  const rows = parseRows(input, delimiter);
  if (rows.length === 0) return [];

  if (hasHeader) {
    const headers = rows[0];
    return rows.slice(1).map(row => {
      const obj = {};
      for (let i = 0; i < headers.length; i++) {
        let val = row[i] ?? '';
        if (typeInfer) val = inferType(val);
        obj[headers[i]] = val;
      }
      return obj;
    });
  }

  if (typeInfer) return rows.map(row => row.map(inferType));
  return rows;
}

export function parseRows(input, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < input.length && input[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === delimiter) {
        row.push(field);
        field = '';
        i++;
      } else if (ch === '\r') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i++;
        if (i < input.length && input[i] === '\n') i++;
      } else if (ch === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Last field/row
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function inferType(val) {
  if (val === '') return val;
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null') return null;
  const num = Number(val);
  if (!isNaN(num) && val.trim() !== '') return num;
  return val;
}

// ===== Stringify =====
export function stringify(data, options = {}) {
  const delimiter = options.delimiter || ',';
  const includeHeader = options.header !== false;

  if (data.length === 0) return '';

  // Array of objects
  if (typeof data[0] === 'object' && !Array.isArray(data[0])) {
    const headers = options.columns || Object.keys(data[0]);
    const rows = data.map(obj => headers.map(h => escapeField(String(obj[h] ?? ''), delimiter)));
    if (includeHeader) return [headers.map(h => escapeField(h, delimiter)).join(delimiter), ...rows.map(r => r.join(delimiter))].join('\n');
    return rows.map(r => r.join(delimiter)).join('\n');
  }

  // Array of arrays
  return data.map(row => row.map(cell => escapeField(String(cell ?? ''), delimiter)).join(delimiter)).join('\n');
}

function escapeField(field, delimiter) {
  if (field.includes('"') || field.includes(delimiter) || field.includes('\n') || field.includes('\r')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

// ===== Streaming parser =====
export class CsvStream {
  constructor(options = {}) {
    this.delimiter = options.delimiter || ',';
    this.buffer = '';
    this.rows = [];
    this.header = null;
    this.hasHeader = options.header !== false;
  }

  write(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop(); // keep incomplete last line

    for (const line of lines) {
      if (line.trim() === '') continue;
      const row = parseRows(line, this.delimiter)[0];
      if (!row) continue;
      if (this.hasHeader && !this.header) {
        this.header = row;
      } else if (this.hasHeader && this.header) {
        const obj = {};
        for (let i = 0; i < this.header.length; i++) obj[this.header[i]] = row[i] ?? '';
        this.rows.push(obj);
      } else {
        this.rows.push(row);
      }
    }
  }

  end() {
    if (this.buffer.trim()) this.write(this.buffer + '\n');
    this.buffer = '';
    return this.rows;
  }
}
