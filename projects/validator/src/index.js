// ===== Validator Library =====
// Zod-inspired schema validation with chaining

export class ValidationError extends Error {
  constructor(errors) { super(errors.map(e => e.message).join('; ')); this.errors = errors; }
}

class Schema {
  constructor() { this._rules = []; this._optional = false; }

  _addRule(fn, message) { this._rules.push({ fn, message }); return this; }
  optional() { this._optional = true; return this; }

  validate(value) {
    if (value === undefined || value === null) {
      if (this._optional) return { valid: true, value };
      return { valid: false, errors: [{ message: 'Value is required' }] };
    }
    const errors = [];
    for (const rule of this._rules) {
      if (!rule.fn(value)) errors.push({ message: rule.message, value });
    }
    return errors.length === 0 ? { valid: true, value } : { valid: false, errors };
  }

  parse(value) {
    const result = this.validate(value);
    if (!result.valid) throw new ValidationError(result.errors);
    return result.value;
  }
}

// ===== String Schema =====
export class StringSchema extends Schema {
  constructor() { super(); this._addRule(v => typeof v === 'string', 'Must be a string'); }
  min(n) { return this._addRule(v => v.length >= n, `Min length ${n}`); }
  max(n) { return this._addRule(v => v.length <= n, `Max length ${n}`); }
  email() { return this._addRule(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Must be a valid email'); }
  url() { return this._addRule(v => /^https?:\/\/.+/.test(v), 'Must be a valid URL'); }
  pattern(re) { return this._addRule(v => re.test(v), `Must match ${re}`); }
  nonempty() { return this._addRule(v => v.length > 0, 'Must not be empty'); }
}

// ===== Number Schema =====
export class NumberSchema extends Schema {
  constructor() { super(); this._addRule(v => typeof v === 'number' && !isNaN(v), 'Must be a number'); }
  min(n) { return this._addRule(v => v >= n, `Must be >= ${n}`); }
  max(n) { return this._addRule(v => v <= n, `Must be <= ${n}`); }
  integer() { return this._addRule(v => Number.isInteger(v), 'Must be an integer'); }
  positive() { return this._addRule(v => v > 0, 'Must be positive'); }
}

// ===== Boolean Schema =====
export class BooleanSchema extends Schema {
  constructor() { super(); this._addRule(v => typeof v === 'boolean', 'Must be a boolean'); }
}

// ===== Array Schema =====
export class ArraySchema extends Schema {
  constructor(itemSchema) { super(); this._itemSchema = itemSchema; this._addRule(v => Array.isArray(v), 'Must be an array'); }
  min(n) { return this._addRule(v => v.length >= n, `Min length ${n}`); }
  max(n) { return this._addRule(v => v.length <= n, `Max length ${n}`); }
  
  validate(value) {
    const base = super.validate(value);
    if (!base.valid) return base;
    if (!this._itemSchema || !Array.isArray(value)) return base;
    
    const errors = [];
    for (let i = 0; i < value.length; i++) {
      const result = this._itemSchema.validate(value[i]);
      if (!result.valid) errors.push(...result.errors.map(e => ({ ...e, path: `[${i}]`, message: `[${i}]: ${e.message}` })));
    }
    return errors.length === 0 ? { valid: true, value } : { valid: false, errors };
  }
}

// ===== Object Schema =====
export class ObjectSchema extends Schema {
  constructor(shape) { super(); this._shape = shape; this._addRule(v => typeof v === 'object' && v !== null && !Array.isArray(v), 'Must be an object'); }
  
  validate(value) {
    const base = super.validate(value);
    if (!base.valid) return base;
    
    const errors = [];
    for (const [key, schema] of Object.entries(this._shape)) {
      const result = schema.validate(value[key]);
      if (!result.valid) errors.push(...result.errors.map(e => ({ ...e, path: key, message: `${key}: ${e.message}` })));
    }
    return errors.length === 0 ? { valid: true, value } : { valid: false, errors };
  }
}

// ===== Factory =====
export const v = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  array: (item) => new ArraySchema(item),
  object: (shape) => new ObjectSchema(shape),
};
