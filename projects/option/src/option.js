// Option type — Some/None (Rust-inspired)
class Option { get isSome() { return false; } get isNone() { return true; } unwrap() { throw new Error('Called unwrap on None'); } unwrapOr(def) { return def; } map() { return none; } flatMap() { return none; } filter() { return none; } match({ none }) { return none(); } }
class SomeImpl extends Option { constructor(value) { super(); this._value = value; } get isSome() { return true; } get isNone() { return false; } unwrap() { return this._value; } unwrapOr() { return this._value; } map(fn) { return some(fn(this._value)); } flatMap(fn) { return fn(this._value); } filter(fn) { return fn(this._value) ? this : none; } match({ some }) { return some(this._value); } toString() { return `Some(${this._value})`; } }
export const none = new Option();
export function some(value) { return new SomeImpl(value); }
export function from(value) { return value == null ? none : some(value); }
export function tryCatch(fn) { try { return some(fn()); } catch { return none; } }
