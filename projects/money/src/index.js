/**
 * Tiny Money/Currency
 * 
 * Precise money arithmetic using integer cents to avoid floating-point errors.
 * - Create from amounts, parse from strings
 * - Add, subtract, multiply, divide
 * - Comparison
 * - Currency conversion
 * - Allocation (split bill evenly)
 * - Formatting
 */

class Money {
  constructor(cents, currency = 'USD') {
    this.cents = Math.round(cents);
    this.currency = currency.toUpperCase();
  }

  static of(amount, currency = 'USD') {
    return new Money(Math.round(amount * 100), currency);
  }

  static parse(str) {
    const m = str.match(/^([A-Z]{3})?\s*\$?([\d,]+(?:\.\d{0,2})?)\s*([A-Z]{3})?$/);
    if (!m) throw new Error(`Cannot parse: ${str}`);
    const currency = m[1] || m[3] || 'USD';
    const amount = parseFloat(m[2].replace(/,/g, ''));
    return Money.of(amount, currency);
  }

  static zero(currency = 'USD') { return new Money(0, currency); }

  get amount() { return this.cents / 100; }

  _check(other) {
    if (!(other instanceof Money)) throw new Error('Expected Money');
    if (this.currency !== other.currency) throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
  }

  add(other) {
    this._check(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  subtract(other) {
    this._check(other);
    return new Money(this.cents - other.cents, this.currency);
  }

  multiply(factor) {
    return new Money(Math.round(this.cents * factor), this.currency);
  }

  divide(divisor) {
    return new Money(Math.round(this.cents / divisor), this.currency);
  }

  negate() { return new Money(-this.cents, this.currency); }
  abs() { return new Money(Math.abs(this.cents), this.currency); }

  isZero() { return this.cents === 0; }
  isPositive() { return this.cents > 0; }
  isNegative() { return this.cents < 0; }

  equals(other) {
    return other instanceof Money && this.cents === other.cents && this.currency === other.currency;
  }

  lt(other) { this._check(other); return this.cents < other.cents; }
  lte(other) { this._check(other); return this.cents <= other.cents; }
  gt(other) { this._check(other); return this.cents > other.cents; }
  gte(other) { this._check(other); return this.cents >= other.cents; }

  compareTo(other) {
    this._check(other);
    return this.cents - other.cents;
  }

  /**
   * Allocate evenly among n parts, distributing remainder penny by penny
   */
  allocate(n) {
    const base = Math.floor(this.cents / n);
    const remainder = this.cents - base * n;
    const results = [];
    for (let i = 0; i < n; i++) {
      results.push(new Money(base + (i < remainder ? 1 : 0), this.currency));
    }
    return results;
  }

  /**
   * Split by ratios (e.g., [1, 2, 3] splits 10.00 into [1.67, 3.33, 5.00])
   */
  splitByRatio(ratios) {
    const total = ratios.reduce((a, b) => a + b, 0);
    const results = [];
    let allocated = 0;
    for (let i = 0; i < ratios.length; i++) {
      if (i === ratios.length - 1) {
        results.push(new Money(this.cents - allocated, this.currency));
      } else {
        const share = Math.round(this.cents * ratios[i] / total);
        results.push(new Money(share, this.currency));
        allocated += share;
      }
    }
    return results;
  }

  percentage(pct) {
    return new Money(Math.round(this.cents * pct / 100), this.currency);
  }

  convert(targetCurrency, rate) {
    return new Money(Math.round(this.cents * rate), targetCurrency);
  }

  format(locale = 'en-US') {
    const symbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };
    const symbol = symbols[this.currency] || this.currency + ' ';
    const abs = Math.abs(this.amount);
    const formatted = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (this.cents < 0 ? '-' : '') + symbol + formatted;
  }

  toString() { return this.format(); }
  toJSON() { return { amount: this.amount, currency: this.currency }; }
}

module.exports = { Money };
