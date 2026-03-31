// Array chunk utilities
export function chunk(arr, size) { const result = []; for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size)); return result; }
export function zip(...arrays) { const len = Math.min(...arrays.map(a => a.length)); return Array.from({ length: len }, (_, i) => arrays.map(a => a[i])); }
export function unzip(arr) { return arr[0].map((_, i) => arr.map(a => a[i])); }
export function unique(arr) { return [...new Set(arr)]; }
export function groupBy(arr, fn) { const groups = {}; for (const item of arr) { const key = typeof fn === 'function' ? fn(item) : item[fn]; (groups[key] = groups[key] || []).push(item); } return groups; }
export function compact(arr) { return arr.filter(Boolean); }
export function flatten(arr, depth = Infinity) { return depth > 0 ? arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val, depth - 1) : val), []) : [...arr]; }
export function partition(arr, fn) { const pass = [], fail = []; for (const item of arr) (fn(item) ? pass : fail).push(item); return [pass, fail]; }
export function interleave(...arrays) { const result = []; const maxLen = Math.max(...arrays.map(a => a.length)); for (let i = 0; i < maxLen; i++) for (const a of arrays) if (i < a.length) result.push(a[i]); return result; }
export function windows(arr, size) { const result = []; for (let i = 0; i <= arr.length - size; i++) result.push(arr.slice(i, i + size)); return result; }
