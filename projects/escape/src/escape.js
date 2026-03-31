// Escape/unescape utilities
const HTML_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const HTML_UNMAP = Object.fromEntries(Object.entries(HTML_MAP).map(([k, v]) => [v, k]));
export function escapeHTML(str) { return str.replace(/[&<>"']/g, ch => HTML_MAP[ch]); }
export function unescapeHTML(str) { return str.replace(/&(amp|lt|gt|quot|#39);/g, (m) => HTML_UNMAP[m] || m); }
export function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function escapeShell(str) { return "'" + str.replace(/'/g, "'\\''") + "'"; }
export function escapeJSON(str) { return JSON.stringify(str).slice(1, -1); }
export function escapeCSV(str) { return str.includes(',') || str.includes('"') || str.includes('\n') ? '"' + str.replace(/"/g, '""') + '"' : str; }
export function escapeXML(str) { return escapeHTML(str); }
