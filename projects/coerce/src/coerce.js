// Type coercion utilities
export function toNumber(val) { if (typeof val === 'number') return val; if (typeof val === 'string') { const n = Number(val); return isNaN(n) ? null : n; } if (typeof val === 'boolean') return val ? 1 : 0; if (val === null || val === undefined) return 0; return null; }
export function toString(val) { if (val === null) return 'null'; if (val === undefined) return 'undefined'; if (typeof val === 'object') return JSON.stringify(val); return String(val); }
export function toBoolean(val) { if (typeof val === 'boolean') return val; if (typeof val === 'string') { const s = val.toLowerCase().trim(); return s !== '' && s !== '0' && s !== 'false' && s !== 'no' && s !== 'null' && s !== 'undefined'; } if (typeof val === 'number') return val !== 0 && !isNaN(val); return !!val; }
export function toArray(val) { if (Array.isArray(val)) return val; if (val === null || val === undefined) return []; if (typeof val === 'string') return [...val]; if (typeof val[Symbol.iterator] === 'function') return [...val]; return [val]; }
export function toDate(val) { if (val instanceof Date) return val; const d = new Date(val); return isNaN(d.getTime()) ? null : d; }
export function toInteger(val) { const n = toNumber(val); return n === null ? null : Math.trunc(n); }
export function toFloat(val) { return toNumber(val); }
export function typeOf(val) { if (val === null) return 'null'; if (Array.isArray(val)) return 'array'; if (val instanceof Date) return 'date'; if (val instanceof RegExp) return 'regexp'; return typeof val; }
