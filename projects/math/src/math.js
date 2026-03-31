// Math utilities
export const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inverseLerp = (a, b, v) => (v - a) / (b - a);
export const remap = (value, inMin, inMax, outMin, outMax) => lerp(outMin, outMax, inverseLerp(inMin, inMax, value));
export const degToRad = (d) => d * Math.PI / 180;
export const radToDeg = (r) => r * 180 / Math.PI;
export const gcd = (a, b) => { while (b) { [a, b] = [b, a % b]; } return Math.abs(a); };
export const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
export const isPrime = (n) => { if (n < 2) return false; if (n < 4) return true; if (n % 2 === 0 || n % 3 === 0) return false; for (let i = 5; i * i <= n; i += 6) { if (n % i === 0 || n % (i + 2) === 0) return false; } return true; };
export const factorial = (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
export const fibonacci = (n) => { let a = 0, b = 1; for (let i = 0; i < n; i++) [a, b] = [b, a + b]; return a; };
export const mean = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;
export const median = (arr) => { const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const variance = (arr) => { const m = mean(arr); return arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length; };
export const stddev = (arr) => Math.sqrt(variance(arr));
export const sum = (arr) => arr.reduce((s, x) => s + x, 0);
export const product = (arr) => arr.reduce((s, x) => s * x, 1);
export const round = (n, decimals = 0) => { const f = 10 ** decimals; return Math.round(n * f) / f; };
