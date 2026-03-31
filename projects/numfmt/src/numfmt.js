// Number formatter — compact, ordinal, percentage, etc.
export function compact(n) { if (Math.abs(n) < 1e3) return String(n); if (Math.abs(n) < 1e6) return (n/1e3).toFixed(1).replace(/\.0$/,'') + 'K'; if (Math.abs(n) < 1e9) return (n/1e6).toFixed(1).replace(/\.0$/,'') + 'M'; if (Math.abs(n) < 1e12) return (n/1e9).toFixed(1).replace(/\.0$/,'') + 'B'; return (n/1e12).toFixed(1).replace(/\.0$/,'') + 'T'; }
export function ordinal(n) { const s = ['th','st','nd','rd']; const v = n % 100; return n + (s[(v-20)%10]||s[v]||s[0]); }
export function percentage(n, decimals = 0) { return (n * 100).toFixed(decimals) + '%'; }
export function padLeft(n, width, char = '0') { return String(n).padStart(width, char); }
export function commaSeparate(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
export function toRoman(n) { const vals = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]; let r = ''; for (const [v, s] of vals) { while (n >= v) { r += s; n -= v; } } return r; }
export function fromRoman(s) { const map = {I:1,V:5,X:10,L:50,C:100,D:500,M:1000}; let r = 0; for (let i = 0; i < s.length; i++) { const curr = map[s[i]], next = map[s[i+1]]; r += next > curr ? -curr : curr; } return r; }
