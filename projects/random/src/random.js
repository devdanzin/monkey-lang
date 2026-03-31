// Random utilities
export function int(min = 0, max = 100) { return Math.floor(Math.random() * (max - min + 1)) + min; }
export function float(min = 0, max = 1) { return Math.random() * (max - min) + min; }
export function bool(probability = 0.5) { return Math.random() < probability; }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function pickN(arr, n) { const shuffled = shuffle([...arr]); return shuffled.slice(0, n); }
export function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function sample(arr) { return pick(arr); }
export function weighted(items) { const total = items.reduce((s, [, w]) => s + w, 0); let r = Math.random() * total; for (const [item, weight] of items) { r -= weight; if (r <= 0) return item; } return items[items.length - 1][0]; }
export function hex(length = 8) { return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join(''); }
export function string(length = 8, chars = 'abcdefghijklmnopqrstuvwxyz0123456789') { return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
export function gaussian(mean = 0, stddev = 1) { const u = 1 - Math.random(); const v = Math.random(); return mean + stddev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
export function color() { return '#' + hex(6); }
