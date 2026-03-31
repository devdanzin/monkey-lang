// Tiny validators
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export const isURL = (s) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(s);
export const isIPv4 = (s) => { const parts = s.split('.'); return parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p) && +p >= 0 && +p <= 255); };
export const isIPv6 = (s) => /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(s) || /^::$/.test(s);
export const isUUID = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export const isHex = (s) => /^(0x)?[0-9a-fA-F]+$/.test(s);
export const isAlpha = (s) => /^[a-zA-Z]+$/.test(s);
export const isAlphanumeric = (s) => /^[a-zA-Z0-9]+$/.test(s);
export const isNumeric = (s) => /^-?\d+\.?\d*$/.test(s);
export const isEmpty = (s) => s.trim().length === 0;
export const isJSON = (s) => { try { JSON.parse(s); return true; } catch { return false; } };
export const isBase64 = (s) => /^[A-Za-z0-9+/]+=*$/.test(s) && s.length % 4 === 0;
export const isCreditCard = (s) => { const n = s.replace(/\D/g, ''); if (n.length < 13 || n.length > 19) return false; let sum = 0; let alt = false; for (let i = n.length - 1; i >= 0; i--) { let d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } sum += d; alt = !alt; } return sum % 10 === 0; };
export const isSlug = (s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
export const isMACAddress = (s) => /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(s);
