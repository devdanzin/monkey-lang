// Deep clone and deep merge

export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);
  if (obj instanceof Map) return new Map([...obj].map(([k, v]) => [deepClone(k), deepClone(v)]));
  if (obj instanceof Set) return new Set([...obj].map(v => deepClone(v)));
  if (Array.isArray(obj)) return obj.map(deepClone);
  const result = {};
  for (const [key, val] of Object.entries(obj)) result[key] = deepClone(val);
  return result;
}

export function deepMerge(target, ...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const [key, val] of Object.entries(source)) {
      if (val && typeof val === 'object' && !Array.isArray(val) && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        target[key] = deepMerge({ ...target[key] }, val);
      } else {
        target[key] = deepClone(val);
      }
    }
  }
  return target;
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a), keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => deepEqual(a[key], b[key]));
}

export function deepFreeze(obj) {
  Object.freeze(obj);
  for (const val of Object.values(obj)) { if (val && typeof val === 'object') deepFreeze(val); }
  return obj;
}

export function flatten(obj, prefix = '', sep = '.') {
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}${sep}${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) Object.assign(result, flatten(val, path, sep));
    else result[path] = val;
  }
  return result;
}

export function unflatten(obj, sep = '.') {
  const result = {};
  for (const [path, val] of Object.entries(obj)) {
    const keys = path.split(sep);
    let cur = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!cur[keys[i]]) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = val;
  }
  return result;
}

export function get(obj, path, defaultVal) {
  const keys = Array.isArray(path) ? path : path.split('.');
  let cur = obj;
  for (const key of keys) { if (cur == null) return defaultVal; cur = cur[key]; }
  return cur === undefined ? defaultVal : cur;
}

export function set(obj, path, value) {
  const keys = Array.isArray(path) ? path : path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) { if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {}; cur = cur[keys[i]]; }
  cur[keys[keys.length - 1]] = value;
  return obj;
}
