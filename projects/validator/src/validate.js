// validate.js — Schema validation library

class ValidationError extends Error {
  constructor(errors) { super(errors.map(e => e.message).join('; ')); this.errors = errors; }
}

class Schema {
  constructor() { this._checks = []; this._optional = false; this._nullable = false; this._default = undefined; this._transform = null; }
  
  optional() { const s = this._clone(); s._optional = true; return s; }
  nullable() { const s = this._clone(); s._nullable = true; return s; }
  default(val) { const s = this._clone(); s._default = val; s._optional = true; return s; }
  transform(fn) { const s = this._clone(); s._transform = fn; return s; }
  
  validate(value, path = '') {
    if (value === undefined) {
      if (this._default !== undefined) value = this._default;
      else if (this._optional) return { valid: true, value: undefined };
      else return { valid: false, errors: [{ path, message: `${path || 'value'} is required` }] };
    }
    if (value === null) {
      if (this._nullable) return { valid: true, value: null };
      return { valid: false, errors: [{ path, message: `${path || 'value'} cannot be null` }] };
    }
    const result = this._validate(value, path);
    if (result.valid && this._transform) result.value = this._transform(result.value);
    return result;
  }

  parse(value) {
    const result = this.validate(value);
    if (!result.valid) throw new ValidationError(result.errors);
    return result.value;
  }

  safeParse(value) { return this.validate(value); }

  _validate() { return { valid: true, value: undefined }; }
  _clone() { const s = new this.constructor(); s._checks = [...this._checks]; s._optional = this._optional; s._nullable = this._nullable; s._default = this._default; s._transform = this._transform; return s; }
}

// ===== String =====
class StringSchema extends Schema {
  _validate(value, path) {
    if (typeof value !== 'string') return { valid: false, errors: [{ path, message: `${path || 'value'} must be a string` }] };
    for (const check of this._checks) {
      const err = check(value, path);
      if (err) return { valid: false, errors: [err] };
    }
    return { valid: true, value };
  }
  min(n) { const s = this._clone(); s._checks.push((v, p) => v.length < n ? { path: p, message: `${p || 'value'} must be at least ${n} characters` } : null); return s; }
  max(n) { const s = this._clone(); s._checks.push((v, p) => v.length > n ? { path: p, message: `${p || 'value'} must be at most ${n} characters` } : null); return s; }
  pattern(re) { const s = this._clone(); s._checks.push((v, p) => !re.test(v) ? { path: p, message: `${p || 'value'} does not match pattern` } : null); return s; }
  email() { return this.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); }
  url() { return this.pattern(/^https?:\/\/.+/); }
  trim() { return this.transform(v => v.trim()); }
  _clone() { const s = new StringSchema(); s._checks = [...this._checks]; s._optional = this._optional; s._nullable = this._nullable; s._default = this._default; s._transform = this._transform; return s; }
}

// ===== Number =====
class NumberSchema extends Schema {
  _validate(value, path) {
    if (typeof value !== 'number' || isNaN(value)) return { valid: false, errors: [{ path, message: `${path || 'value'} must be a number` }] };
    for (const check of this._checks) { const err = check(value, path); if (err) return { valid: false, errors: [err] }; }
    return { valid: true, value };
  }
  min(n) { const s = this._clone(); s._checks.push((v, p) => v < n ? { path: p, message: `${p || 'value'} must be >= ${n}` } : null); return s; }
  max(n) { const s = this._clone(); s._checks.push((v, p) => v > n ? { path: p, message: `${p || 'value'} must be <= ${n}` } : null); return s; }
  int() { const s = this._clone(); s._checks.push((v, p) => !Number.isInteger(v) ? { path: p, message: `${p || 'value'} must be an integer` } : null); return s; }
  positive() { return this.min(0); }
  _clone() { const s = new NumberSchema(); s._checks = [...this._checks]; s._optional = this._optional; s._nullable = this._nullable; s._default = this._default; s._transform = this._transform; return s; }
}

// ===== Boolean =====
class BooleanSchema extends Schema {
  _validate(value, path) {
    if (typeof value !== 'boolean') return { valid: false, errors: [{ path, message: `${path || 'value'} must be a boolean` }] };
    return { valid: true, value };
  }
  _clone() { const s = new BooleanSchema(); s._checks = [...this._checks]; s._optional = this._optional; s._nullable = this._nullable; s._default = this._default; s._transform = this._transform; return s; }
}

// ===== Array =====
class ArraySchema extends Schema {
  constructor(itemSchema) { super(); this._itemSchema = itemSchema; }
  _validate(value, path) {
    if (!Array.isArray(value)) return { valid: false, errors: [{ path, message: `${path || 'value'} must be an array` }] };
    const errors = [];
    const result = [];
    for (let i = 0; i < value.length; i++) {
      if (this._itemSchema) {
        const r = this._itemSchema.validate(value[i], `${path}[${i}]`);
        if (!r.valid) errors.push(...r.errors);
        else result.push(r.value);
      } else result.push(value[i]);
    }
    for (const check of this._checks) { const err = check(value, path); if (err) errors.push(err); }
    if (errors.length) return { valid: false, errors };
    return { valid: true, value: result };
  }
  min(n) { const s = this._clone(); s._checks.push((v, p) => v.length < n ? { path: p, message: `${p || 'value'} must have at least ${n} items` } : null); return s; }
  max(n) { const s = this._clone(); s._checks.push((v, p) => v.length > n ? { path: p, message: `${p || 'value'} must have at most ${n} items` } : null); return s; }
  _clone() { const s = new ArraySchema(this._itemSchema); s._checks = [...this._checks]; s._optional = this._optional; s._nullable = this._nullable; s._default = this._default; s._transform = this._transform; return s; }
}

// ===== Object =====
class ObjectSchema extends Schema {
  constructor(shape) { super(); this._shape = shape || {}; }
  _validate(value, path) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return { valid: false, errors: [{ path, message: `${path || 'value'} must be an object` }] };
    const errors = [];
    const result = {};
    for (const [key, schema] of Object.entries(this._shape)) {
      const r = schema.validate(value[key], path ? `${path}.${key}` : key);
      if (!r.valid) errors.push(...r.errors);
      else if (r.value !== undefined) result[key] = r.value;
    }
    if (errors.length) return { valid: false, errors };
    return { valid: true, value: result };
  }
  _clone() { const s = new ObjectSchema(this._shape); s._checks = [...this._checks]; s._optional = this._optional; s._nullable = this._nullable; s._default = this._default; s._transform = this._transform; return s; }
}

// ===== Custom =====
class CustomSchema extends Schema {
  constructor(fn) { super(); this._fn = fn; }
  _validate(value, path) {
    const result = this._fn(value);
    if (result === true) return { valid: true, value };
    return { valid: false, errors: [{ path, message: typeof result === 'string' ? result : `${path || 'value'} failed validation` }] };
  }
  _clone() { const s = new CustomSchema(this._fn); s._checks = [...this._checks]; s._optional = this._optional; s._nullable = this._nullable; s._default = this._default; s._transform = this._transform; return s; }
}

// ===== Builder functions =====
export const v = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  array: (item) => new ArraySchema(item),
  object: (shape) => new ObjectSchema(shape),
  custom: (fn) => new CustomSchema(fn),
};

export { ValidationError };
