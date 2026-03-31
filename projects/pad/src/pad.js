// String padding and manipulation
export const padStart = (s, len, ch = ' ') => String(s).padStart(len, ch);
export const padEnd = (s, len, ch = ' ') => String(s).padEnd(len, ch);
export const center = (s, len, ch = ' ') => { const str = String(s); const left = Math.ceil((len - str.length) / 2); const right = len - str.length - left; return ch.repeat(Math.max(0, left)) + str + ch.repeat(Math.max(0, right)); };
export const truncate = (s, len, suffix = '...') => s.length <= len ? s : s.slice(0, len - suffix.length) + suffix;
export const wordWrap = (s, width = 80) => { const words = s.split(' '); const lines = ['']; for (const w of words) { if (lines[lines.length-1].length + w.length + 1 > width) lines.push(w); else lines[lines.length-1] += (lines[lines.length-1] ? ' ' : '') + w; } return lines.join('\n'); };
export const repeat = (s, n) => s.repeat(n);
export const reverse = (s) => [...s].reverse().join('');
export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const indent = (s, n, ch = ' ') => s.split('\n').map(line => ch.repeat(n) + line).join('\n');
export const dedent = (s) => { const lines = s.split('\n'); const min = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^(\s*)/)[1].length)); return lines.map(l => l.slice(min)).join('\n'); };
export const strip = (s) => s.replace(/^\s+|\s+$/g, '');
export const squeeze = (s) => s.replace(/\s+/g, ' ').trim();
