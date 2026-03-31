// Money formatter — currency formatting
const CURRENCIES = { USD: { symbol: '$', code: 'USD', decimals: 2 }, EUR: { symbol: '€', code: 'EUR', decimals: 2 }, GBP: { symbol: '£', code: 'GBP', decimals: 2 }, JPY: { symbol: '¥', code: 'JPY', decimals: 0 }, BTC: { symbol: '₿', code: 'BTC', decimals: 8 } };
export function format(amount, currency = 'USD', { locale = 'en', showCode = false } = {}) {
  const c = CURRENCIES[currency] || { symbol: currency, decimals: 2 };
  const fixed = amount.toFixed(c.decimals);
  const [int, dec] = fixed.split('.');
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let result = c.symbol + formatted;
  if (dec) result += '.' + dec;
  if (showCode) result += ' ' + c.code;
  return result;
}
export function parse(str) { return parseFloat(str.replace(/[^0-9.-]/g, '')); }
export function add(a, b, decimals = 2) { const f = 10 ** decimals; return Math.round(a * f + b * f) / f; }
export function subtract(a, b, decimals = 2) { return add(a, -b, decimals); }
export function multiply(a, b, decimals = 2) { const f = 10 ** decimals; return Math.round(a * f * b) / f; }
export function split(amount, ways, decimals = 2) {
  const f = 10 ** decimals;
  const base = Math.floor(amount * f / ways) / f;
  const remainder = Math.round((amount - base * ways) * f);
  return Array.from({ length: ways }, (_, i) => i < remainder ? add(base, 1 / f) : base);
}
