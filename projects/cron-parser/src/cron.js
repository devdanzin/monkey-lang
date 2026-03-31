// CRON expression parser — parse, validate, next occurrence

export function parse(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) throw new Error(`Invalid cron: expected 5-6 fields, got ${parts.length}`);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  return { minute: parseField(minute, 0, 59), hour: parseField(hour, 0, 23), dayOfMonth: parseField(dayOfMonth, 1, 31), month: parseField(month, 1, 12), dayOfWeek: parseField(dayOfWeek, 0, 6) };
}

function parseField(field, min, max) {
  if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => i + min);
  const values = new Set();
  for (const part of field.split(',')) {
    if (part.includes('/')) {
      const [range, step] = part.split('/');
      const s = parseInt(step);
      const [lo, hi] = range === '*' ? [min, max] : range.split('-').map(Number);
      for (let i = lo; i <= (hi || max); i += s) values.add(i);
    } else if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      for (let i = lo; i <= hi; i++) values.add(i);
    } else {
      values.add(parseInt(part));
    }
  }
  return [...values].filter(v => v >= min && v <= max).sort((a, b) => a - b);
}

export function isValid(expr) {
  try { parse(expr); return true; } catch { return false; }
}

export function nextOccurrence(expr, from = new Date()) {
  const cron = typeof expr === 'string' ? parse(expr) : expr;
  const date = new Date(from);
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() + 1);

  for (let i = 0; i < 525960; i++) { // Max ~1 year of minutes
    if (cron.month.includes(date.getMonth() + 1) && cron.dayOfMonth.includes(date.getDate()) && cron.dayOfWeek.includes(date.getDay()) && cron.hour.includes(date.getHours()) && cron.minute.includes(date.getMinutes())) {
      return date;
    }
    date.setMinutes(date.getMinutes() + 1);
  }
  return null;
}

export function nextN(expr, n, from = new Date()) {
  const results = [];
  let cursor = new Date(from);
  for (let i = 0; i < n; i++) {
    const next = nextOccurrence(expr, cursor);
    if (!next) break;
    results.push(next);
    cursor = next;
  }
  return results;
}

export function matches(expr, date) {
  const cron = typeof expr === 'string' ? parse(expr) : expr;
  return cron.month.includes(date.getMonth() + 1) && cron.dayOfMonth.includes(date.getDate()) && cron.dayOfWeek.includes(date.getDay()) && cron.hour.includes(date.getHours()) && cron.minute.includes(date.getMinutes());
}

export function toString(cron) {
  const f = (arr, min, max) => arr.length === max - min + 1 ? '*' : arr.join(',');
  return `${f(cron.minute,0,59)} ${f(cron.hour,0,23)} ${f(cron.dayOfMonth,1,31)} ${f(cron.month,1,12)} ${f(cron.dayOfWeek,0,6)}`;
}
