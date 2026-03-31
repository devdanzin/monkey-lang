// Either type — Left/Right (Haskell-inspired)
class Either { get isLeft() { return false; } get isRight() { return false; } }
class LeftImpl extends Either { constructor(value) { super(); this._value = value; } get isLeft() { return true; } unwrap() { throw new Error(`Called unwrap on Left(${this._value})`); } unwrapLeft() { return this._value; } map() { return this; } flatMap() { return this; } mapLeft(fn) { return left(fn(this._value)); } match({ left: l }) { return l(this._value); } toString() { return `Left(${this._value})`; } }
class RightImpl extends Either { constructor(value) { super(); this._value = value; } get isRight() { return true; } unwrap() { return this._value; } unwrapLeft() { throw new Error(`Called unwrapLeft on Right`); } map(fn) { return right(fn(this._value)); } flatMap(fn) { return fn(this._value); } mapLeft() { return this; } match({ right: r }) { return r(this._value); } toString() { return `Right(${this._value})`; } }
export function left(value) { return new LeftImpl(value); }
export function right(value) { return new RightImpl(value); }
export function tryCatch(fn) { try { return right(fn()); } catch (e) { return left(e); } }
export function fromNullable(value, error = 'null') { return value == null ? left(error) : right(value); }
