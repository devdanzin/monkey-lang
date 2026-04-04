// cron.js — Cron expression parser

const MONTHS = ['', 'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const DAYS = ['sun','mon','tue','wed','thu','fri','sat'];

export function parseCron(expression) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Expected 5 fields, got ${parts.length}`);
  
  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dayOfMonth: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12, MONTHS),
    dayOfWeek: parseField(parts[4], 0, 6, DAYS),
  };
}

function parseField(field, min, max, names = null) {
  const values = new Set();
  
  for (const part of field.split(',')) {
    let f = part.toLowerCase();
    
    // Replace names
    if (names) {
      for (let i = 0; i < names.length; i++) {
        if (names[i] && f.includes(names[i])) f = f.replace(names[i], String(i));
      }
    }
    
    if (f === '*') {
      for (let i = min; i <= max; i++) values.add(i);
    } else if (f.includes('/')) {
      const [range, stepStr] = f.split('/');
      const step = parseInt(stepStr);
      let start = min, end = max;
      if (range !== '*') {
        if (range.includes('-')) {
          [start, end] = range.split('-').map(Number);
        } else {
          start = parseInt(range);
        }
      }
      for (let i = start; i <= end; i += step) values.add(i);
    } else if (f.includes('-')) {
      const [start, end] = f.split('-').map(Number);
      for (let i = start; i <= end; i++) values.add(i);
    } else {
      values.add(parseInt(f));
    }
  }
  
  return [...values].sort((a, b) => a - b);
}

export function matches(cron, date) {
  const parsed = typeof cron === 'string' ? parseCron(cron) : cron;
  return (
    parsed.minute.includes(date.getMinutes()) &&
    parsed.hour.includes(date.getHours()) &&
    parsed.month.includes(date.getMonth() + 1) &&
    (parsed.dayOfMonth.includes(date.getDate()) || parsed.dayOfWeek.includes(date.getDay()))
  );
}

export function nextOccurrence(cron, from = new Date()) {
  const parsed = typeof cron === 'string' ? parseCron(cron) : cron;
  const date = new Date(from);
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() + 1); // start from next minute
  
  const limit = 366 * 24 * 60; // 1 year in minutes
  for (let i = 0; i < limit; i++) {
    if (
      parsed.minute.includes(date.getMinutes()) &&
      parsed.hour.includes(date.getHours()) &&
      parsed.month.includes(date.getMonth() + 1) &&
      (parsed.dayOfMonth.includes(date.getDate()) && parsed.dayOfWeek.includes(date.getDay()))
    ) {
      return date;
    }
    date.setMinutes(date.getMinutes() + 1);
  }
  return null;
}

export function prevOccurrence(cron, from = new Date()) {
  const parsed = typeof cron === 'string' ? parseCron(cron) : cron;
  const date = new Date(from);
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() - 1);
  
  const limit = 366 * 24 * 60;
  for (let i = 0; i < limit; i++) {
    if (
      parsed.minute.includes(date.getMinutes()) &&
      parsed.hour.includes(date.getHours()) &&
      parsed.month.includes(date.getMonth() + 1) &&
      (parsed.dayOfMonth.includes(date.getDate()) && parsed.dayOfWeek.includes(date.getDay()))
    ) {
      return date;
    }
    date.setMinutes(date.getMinutes() - 1);
  }
  return null;
}

export function describe(expression) {
  const parsed = parseCron(expression);
  const parts = [];
  
  if (parsed.minute.length === 60) parts.push('Every minute');
  else if (parsed.minute.length === 1) parts.push(`At minute ${parsed.minute[0]}`);
  else parts.push(`At minutes ${parsed.minute.join(', ')}`);
  
  if (parsed.hour.length === 24) parts.push('of every hour');
  else if (parsed.hour.length === 1) parts.push(`past hour ${parsed.hour[0]}`);
  else parts.push(`past hours ${parsed.hour.join(', ')}`);
  
  if (parsed.dayOfMonth.length < 31) parts.push(`on day ${parsed.dayOfMonth.join(', ')}`);
  if (parsed.month.length < 12) parts.push(`in ${parsed.month.map(m => MONTHS[m]).join(', ')}`);
  if (parsed.dayOfWeek.length < 7) parts.push(`on ${parsed.dayOfWeek.map(d => DAYS[d]).join(', ')}`);
  
  return parts.join(' ');
}

// Presets
export const presets = {
  yearly: '0 0 1 1 *',
  monthly: '0 0 1 * *',
  weekly: '0 0 * * 0',
  daily: '0 0 * * *',
  hourly: '0 * * * *',
};
