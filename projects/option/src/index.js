// ===== Option Type (Rust/Scala-inspired Some/None) =====

export class Some {
  constructor(value) { this.value = value; }
  isSome() { return true; }
  isNone() { return false; }
  map(fn) { return some(fn(this.value)); }
  flatMap(fn) { return fn(this.value); }
  filter(pred) { return pred(this.value) ? this : none(); }
  unwrap() { return this.value; }
  unwrapOr() { return this.value; }
  unwrapOrElse() { return this.value; }
  or() { return this; }
  and(other) { return other; }
  zip(other) { return other.isSome() ? some([this.value, other.value]) : none(); }
  match({ some: s }) { return s(this.value); }
  toString() { return `Some(${this.value})`; }
}

export class None {
  isSome() { return false; }
  isNone() { return true; }
  map() { return this; }
  flatMap() { return this; }
  filter() { return this; }
  unwrap() { throw new Error('Unwrap on None'); }
  unwrapOr(def) { return def; }
  unwrapOrElse(fn) { return fn(); }
  or(other) { return other; }
  and() { return this; }
  zip() { return this; }
  match({ none: n }) { return n(); }
  toString() { return 'None'; }
}

const NONE = new None();
export function some(value) { return new Some(value); }
export function none() { return NONE; }
export function fromNullable(value) { return value != null ? some(value) : none(); }
