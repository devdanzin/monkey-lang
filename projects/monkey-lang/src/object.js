// Monkey Language Object System

export const OBJ = {
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  NULL: 'NULL',
  STRING: 'STRING',
  RETURN: 'RETURN',
  ERROR: 'ERROR',
  FUNCTION: 'FUNCTION',
  ARRAY: 'ARRAY',
  HASH: 'HASH',
  BUILTIN: 'BUILTIN',
};

export class MonkeyInteger {
  constructor(value) { this.value = value; }
  type() { return OBJ.INTEGER; }
  inspect() { return String(this.value); }
  hashKey() { return `int:${this.value}`; }
}

export class MonkeyBoolean {
  constructor(value) { this.value = value; }
  type() { return OBJ.BOOLEAN; }
  inspect() { return String(this.value); }
  hashKey() { return `bool:${this.value}`; }
}

export class MonkeyNull {
  type() { return OBJ.NULL; }
  inspect() { return 'null'; }
}

export class MonkeyString {
  constructor(value) { this.value = value; }
  type() { return OBJ.STRING; }
  inspect() { return this.value; }
  hashKey() { return `str:${this.value}`; }
}

export class MonkeyReturnValue {
  constructor(value) { this.value = value; }
  type() { return OBJ.RETURN; }
  inspect() { return this.value.inspect(); }
}

export class MonkeyError {
  constructor(message) { this.message = message; }
  type() { return OBJ.ERROR; }
  inspect() { return `ERROR: ${this.message}`; }
}

export class MonkeyFunction {
  constructor(parameters, body, env) {
    this.parameters = parameters;
    this.body = body;
    this.env = env;
  }
  type() { return OBJ.FUNCTION; }
  inspect() { return `fn(${this.parameters.join(', ')}) {\n${this.body}\n}`; }
}

export class MonkeyArray {
  constructor(elements) { this.elements = elements; }
  type() { return OBJ.ARRAY; }
  inspect() { return `[${this.elements.map(e => e.inspect()).join(', ')}]`; }
}

export class MonkeyHash {
  constructor(pairs) { this.pairs = pairs; } // Map<hashKey, {key, value}>
  type() { return OBJ.HASH; }
  inspect() {
    const entries = [];
    for (const [, { key, value }] of this.pairs) {
      entries.push(`${key.inspect()}: ${value.inspect()}`);
    }
    return `{${entries.join(', ')}}`;
  }
}

export class MonkeyBuiltin {
  constructor(fn) { this.fn = fn; }
  type() { return OBJ.BUILTIN; }
  inspect() { return 'builtin function'; }
}

// Environment (scope chain)
export class Environment {
  constructor(outer = null) {
    this.store = new Map();
    this.outer = outer;
  }
  get(name) {
    const val = this.store.get(name);
    if (val !== undefined) return val;
    if (this.outer) return this.outer.get(name);
    return undefined;
  }
  set(name, val) {
    this.store.set(name, val);
    return val;
  }
}

// Singletons
export const TRUE = new MonkeyBoolean(true);
export const FALSE = new MonkeyBoolean(false);
export const NULL = new MonkeyNull();

// Integer cache: pre-allocate MonkeyInteger objects for common values
// Avoids allocation in hot loops (like CPython's small int cache)
const INT_CACHE_MIN = -1;
const INT_CACHE_MAX = 256;
const INT_CACHE = new Array(INT_CACHE_MAX - INT_CACHE_MIN + 1);
for (let i = INT_CACHE_MIN; i <= INT_CACHE_MAX; i++) {
  INT_CACHE[i - INT_CACHE_MIN] = new MonkeyInteger(i);
}

/**
 * Get or create a MonkeyInteger. Uses cache for common values.
 */
export function cachedInteger(value) {
  if (value >= INT_CACHE_MIN && value <= INT_CACHE_MAX && (value | 0) === value) {
    return INT_CACHE[value - INT_CACHE_MIN];
  }
  return new MonkeyInteger(value);
}
