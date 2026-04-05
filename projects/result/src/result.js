// result.js — Result/Option types

// ===== Option =====
class SomeImpl { constructor(value) { this._value = value; } get isSome() { return true; } get isNone() { return false; }
  unwrap() { return this._value; } unwrapOr(_) { return this._value; } unwrapOrElse(_) { return this._value; }
  map(fn) { return Some(fn(this._value)); } flatMap(fn) { return fn(this._value); }
  filter(fn) { return fn(this._value) ? this : None; }
  match(handlers) { return handlers.some(this._value); }
  and(other) { return other; } or(_) { return this; }
  toResult(err) { return Ok(this._value); }
  [Symbol.toPrimitive]() { return this._value; }
}

class NoneImpl { get isSome() { return false; } get isNone() { return true; }
  unwrap() { throw new Error('Called unwrap on None'); } unwrapOr(def) { return def; } unwrapOrElse(fn) { return fn(); }
  map(_) { return None; } flatMap(_) { return None; }
  filter(_) { return None; }
  match(handlers) { return handlers.none(); }
  and(_) { return None; } or(other) { return other; }
  toResult(err) { return Err(err); }
}

export const None = new NoneImpl();
export function Some(value) { return new SomeImpl(value); }
export function Option(value) { return value == null ? None : Some(value); }

// ===== Result =====
class OkImpl { constructor(value) { this._value = value; } get isOk() { return true; } get isErr() { return false; }
  unwrap() { return this._value; } unwrapOr(_) { return this._value; } unwrapErr() { throw new Error('Called unwrapErr on Ok'); }
  map(fn) { return Ok(fn(this._value)); } mapErr(_) { return this; }
  andThen(fn) { return fn(this._value); } orElse(_) { return this; }
  match(handlers) { return handlers.ok(this._value); }
  toOption() { return Some(this._value); }
}

class ErrImpl { constructor(error) { this._error = error; } get isOk() { return false; } get isErr() { return true; }
  unwrap() { throw this._error instanceof Error ? this._error : new Error(String(this._error)); }
  unwrapOr(def) { return def; } unwrapErr() { return this._error; }
  map(_) { return this; } mapErr(fn) { return Err(fn(this._error)); }
  andThen(_) { return this; } orElse(fn) { return fn(this._error); }
  match(handlers) { return handlers.err(this._error); }
  toOption() { return None; }
}

export function Ok(value) { return new OkImpl(value); }
export function Err(error) { return new ErrImpl(error); }

// ===== Try wrapper =====
export function tryCatch(fn) {
  try { return Ok(fn()); }
  catch (e) { return Err(e); }
}

export async function tryCatchAsync(fn) {
  try { return Ok(await fn()); }
  catch (e) { return Err(e); }
}
