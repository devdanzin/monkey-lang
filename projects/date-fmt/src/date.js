export function format(date, fmt) {
  const d = date instanceof Date ? date : new Date(date);
  const tokens = { YYYY: d.getFullYear(), YY: String(d.getFullYear()).slice(-2), MM: pad(d.getMonth()+1), M: d.getMonth()+1, DD: pad(d.getDate()), D: d.getDate(), HH: pad(d.getHours()), H: d.getHours(), hh: pad(d.getHours()%12||12), h: d.getHours()%12||12, mm: pad(d.getMinutes()), m: d.getMinutes(), ss: pad(d.getSeconds()), s: d.getSeconds(), A: d.getHours()<12?'AM':'PM', a: d.getHours()<12?'am':'pm' };
  return fmt.replace(/YYYY|YY|MM|DD|HH|hh|mm|ss|M|D|H|h|m|s|A|a/g, m => String(tokens[m]));
}
function pad(n) { return String(n).padStart(2, '0'); }
export function timeAgo(date, now = new Date()) {
  const diff = Math.floor((now - new Date(date)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff/86400)}d ago`;
  return `${Math.floor(diff/2592000)}mo ago`;
}
export function isLeapYear(y) { return y%4===0 && (y%100!==0 || y%400===0); }
export function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
