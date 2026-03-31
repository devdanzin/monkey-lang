// Percent encoding (URL encoding)
const UNRESERVED = /[A-Za-z0-9\-_.~]/;
export function encode(str) { return [...str].map(c => UNRESERVED.test(c) ? c : '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join(''); }
export function decode(str) { return str.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))); }
export function encodeComponent(str) { return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()); }
export function decodeComponent(str) { return decodeURIComponent(str); }
