// ===== Result Type (Rust-inspired Ok/Err) =====

export class Ok {
  constructor(value) { this.value = value; }
  isOk() { return true; }
  isErr() { return false; }
  map(fn) { return new Ok(fn(this.value)); }
  flatMap(fn) { return fn(this.value); }
  mapErr() { return this; }
  unwrap() { return this.value; }
  unwrapOr() { return this.value; }
  unwrapOrElse() { return this.value; }
  match({ ok }) { return ok(this.value); }
  toString() { return `Ok(${this.value})`; }
}

export class Err {
  constructor(error) { this.error = error; }
  isOk() { return false; }
  isErr() { return true; }
  map() { return this; }
  flatMap() { return this; }
  mapErr(fn) { return new Err(fn(this.error)); }
  unwrap() { throw new Error(`Unwrap on Err: ${this.error}`); }
  unwrapOr(def) { return def; }
  unwrapOrElse(fn) { return fn(this.error); }
  match({ err }) { return err(this.error); }
  toString() { return `Err(${this.error})`; }
}

export function ok(value) { return new Ok(value); }
export function err(error) { return new Err(error); }

// Try-catch wrapper
export function tryCatch(fn) {
  try { return ok(fn()); }
  catch (e) { return err(e); }
}

// Collect: [Result] → Result<Array>
export function collect(results) {
  const values = [];
  for (const r of results) {
    if (r.isErr()) return r;
    values.push(r.value);
  }
  return ok(values);
}
