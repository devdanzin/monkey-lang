// Result type — Rust-inspired Ok/Err for explicit error handling
export class Result {
  constructor(ok, value) { this._ok = ok; this._value = value; }
  static Ok(value) { return new Result(true, value); }
  static Err(error) { return new Result(false, error); }
  static from(fn) { try { return Result.Ok(fn()); } catch (e) { return Result.Err(e); } }
  static async fromAsync(fn) { try { return Result.Ok(await fn()); } catch (e) { return Result.Err(e); } }

  get isOk() { return this._ok; }
  get isErr() { return !this._ok; }
  unwrap() { if (this._ok) return this._value; throw this._value; }
  unwrapOr(def) { return this._ok ? this._value : def; }
  unwrapOrElse(fn) { return this._ok ? this._value : fn(this._value); }
  expect(msg) { if (this._ok) return this._value; throw new Error(msg); }
  map(fn) { return this._ok ? Result.Ok(fn(this._value)) : this; }
  mapErr(fn) { return this._ok ? this : Result.Err(fn(this._value)); }
  andThen(fn) { return this._ok ? fn(this._value) : this; }
  orElse(fn) { return this._ok ? this : fn(this._value); }
  match(handlers) { return this._ok ? handlers.Ok(this._value) : handlers.Err(this._value); }
  toString() { return this._ok ? `Ok(${this._value})` : `Err(${this._value})`; }
}
export const Ok = Result.Ok;
export const Err = Result.Err;
