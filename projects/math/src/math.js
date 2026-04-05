// math.js — Math utilities

export function factorial(n) { if (n <= 1) return 1n; let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; }
export function fibonacci(n) { if (n <= 0) return 0; if (n === 1) return 1; let a = 0, b = 1; for (let i = 2; i <= n; i++) [a, b] = [b, a + b]; return b; }
export function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
export function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }
export function isPrime(n) { if (n < 2) return false; if (n < 4) return true; if (n % 2 === 0 || n % 3 === 0) return false; for (let i = 5; i * i <= n; i += 6) if (n % i === 0 || n % (i + 2) === 0) return false; return true; }
export function sieve(max) { const s = new Uint8Array(max + 1).fill(1); s[0] = s[1] = 0; for (let i = 2; i * i <= max; i++) if (s[i]) for (let j = i * i; j <= max; j += i) s[j] = 0; const primes = []; for (let i = 2; i <= max; i++) if (s[i]) primes.push(i); return primes; }
export function power(base, exp) { if (exp === 0) return 1; if (exp < 0) return 1 / power(base, -exp); let r = 1; while (exp > 0) { if (exp & 1) r *= base; base *= base; exp >>= 1; } return r; }
export function modPow(base, exp, mod) { let r = 1n; base = BigInt(base) % BigInt(mod); const m = BigInt(mod); const e = BigInt(exp); let ex = e; while (ex > 0n) { if (ex & 1n) r = (r * base) % m; base = (base * base) % m; ex >>= 1n; } return Number(r); }
export function sqrt(n, precision = 1e-10) { if (n < 0) return NaN; if (n === 0) return 0; let x = n; while (Math.abs(x * x - n) > precision) x = (x + n / x) / 2; return x; }
export function combinations(n, k) { if (k > n) return 0; return Number(factorial(n) / (factorial(k) * factorial(n - k))); }
export function permutations(n, k) { if (k > n) return 0; return Number(factorial(n) / factorial(n - k)); }
export function binomial(n, k) { return combinations(n, k); }
export function catalan(n) { return combinations(2 * n, n) / (n + 1); }
export function abs(n) { return n < 0 ? -n : n; }
export function clamp(n, min, max) { return n < min ? min : n > max ? max : n; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function degToRad(deg) { return deg * Math.PI / 180; }
export function radToDeg(rad) { return rad * 180 / Math.PI; }
export function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
export function median(arr) { const sorted = [...arr].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; }
export function variance(arr) { const m = mean(arr); return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length; }
export function stddev(arr) { return Math.sqrt(variance(arr)); }
