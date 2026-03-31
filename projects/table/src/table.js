// Tiny table formatter — ASCII tables
export function table(data, { header = true, border = true, align } = {}) {
  const rows = header ? data : [Object.keys(data[0] || {}), ...data.map(r => Array.isArray(r) ? r : Object.values(r))];
  const cols = rows[0]?.length || 0;
  const widths = Array.from({ length: cols }, (_, i) => Math.max(...rows.map(r => String(r[i] ?? '').length)));

  const pad = (val, i) => {
    const s = String(val ?? '');
    const dir = align?.[i] || 'left';
    return dir === 'right' ? s.padStart(widths[i]) : dir === 'center' ? s.padStart(Math.ceil((widths[i] + s.length) / 2)).padEnd(widths[i]) : s.padEnd(widths[i]);
  };

  const sep = border ? '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+' : '';
  const line = (row) => border ? '| ' + row.map((v, i) => pad(v, i)).join(' | ') + ' |' : row.map((v, i) => pad(v, i)).join('  ');

  const lines = [];
  if (border) lines.push(sep);
  lines.push(line(rows[0]));
  if (border) lines.push(sep);
  for (let i = 1; i < rows.length; i++) lines.push(line(rows[i]));
  if (border) lines.push(sep);
  return lines.join('\n');
}
