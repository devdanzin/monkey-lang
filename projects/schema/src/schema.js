// Schema Validator — Zod/Joi-like chainable validation
// Supports: string, number, boolean, array, object, optional, nullable, custom, transform

class ValidationError extends Error {
  constructor(issues) {
    super(issues.map(i => i.message).join('; '));
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

class Schema {
  constructor() {
    this._checks = [];
    this._optional = false;
    this._nullable = false;
    this._default = undefined;
    this._transform = null;
  }

  _clone() {
    const s = new this.constructor();
    s._checks = [...this._checks];
    s._optional = this._optional;
    s._nullable = this._nullable;
    s._default = this._default;
    s._transform = this._transform;
    return s;
  }

  optional() { const s = this._clone(); s._optional = true; return s; }
  nullable() { const s = this._clone(); s._nullable = true; return s; }
  default(val) { const s = this._clone(); s._default = val; s._optional = true; return s; }
  transform(fn) { const s = this._clone(); s._transform = fn; return s; }

  refine(fn, message = 'Validation failed') {
    const s = this._clone();
    s._checks.push({ fn, message });
    return s;
  }

  parse(value) {
    const result = this.safeParse(value);
    if (!result.success) throw new ValidationError(result.issues);
    return result.data;
  }

  safeParse(value) {
    // Handle undefined
    if (value === undefined) {
      if (this._default !== undefined) value = this._default;
      else if (this._optional) return { success: true, data: undefined };
      else return { success: false, issues: [{ message: 'Required' }] };
    }

    // Handle null
    if (value === null) {
      if (this._nullable) return { success: true, data: null };
      return { success: false, issues: [{ message: 'Cannot be null' }] };
    }

    // Type-specific validation
    const typeResult = this._validate(value);
    if (!typeResult.success) return typeResult;

    let data = typeResult.data;

    // Custom checks
    for (const check of this._checks) {
      if (!check.fn(data)) {
        return { success: false, issues: [{ message: check.message }] };
      }
    }

    // Transform
    if (this._transform) data = this._transform(data);

    return { success: true, data };
  }

  _validate() { return { success: true, data: arguments[0] }; }
}

class StringSchema extends Schema {
  _validate(value) {
    if (typeof value !== 'string') return { success: false, issues: [{ message: `Expected string, got ${typeof value}` }] };
    return { success: true, data: value };
  }

  min(n) { return this.refine(v => v.length >= n, `String must be at least ${n} characters`); }
  max(n) { return this.refine(v => v.length <= n, `String must be at most ${n} characters`); }
  email() { return this.refine(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email'); }
  url() { return this.refine(v => /^https?:\/\/.+/.test(v), 'Invalid URL'); }
  regex(re, msg) { return this.refine(v => re.test(v), msg || `Must match ${re}`); }
  trim() { return this.transform(v => v.trim()); }
  toLowerCase() { return this.transform(v => v.toLowerCase()); }
  nonempty() { return this.refine(v => v.length > 0, 'String cannot be empty'); }
}

class NumberSchema extends Schema {
  _validate(value) {
    if (typeof value !== 'number' || isNaN(value)) return { success: false, issues: [{ message: `Expected number, got ${typeof value}` }] };
    return { success: true, data: value };
  }

  min(n) { return this.refine(v => v >= n, `Must be >= ${n}`); }
  max(n) { return this.refine(v => v <= n, `Must be <= ${n}`); }
  int() { return this.refine(v => Number.isInteger(v), 'Must be integer'); }
  positive() { return this.refine(v => v > 0, 'Must be positive'); }
  negative() { return this.refine(v => v < 0, 'Must be negative'); }
  nonnegative() { return this.refine(v => v >= 0, 'Must be non-negative'); }
}

class BooleanSchema extends Schema {
  _validate(value) {
    if (typeof value !== 'boolean') return { success: false, issues: [{ message: `Expected boolean, got ${typeof value}` }] };
    return { success: true, data: value };
  }
}

class ArraySchema extends Schema {
  constructor(itemSchema) {
    super();
    this._itemSchema = itemSchema;
  }

  _clone() {
    const s = new ArraySchema(this._itemSchema);
    s._checks = [...this._checks];
    s._optional = this._optional;
    s._nullable = this._nullable;
    s._default = this._default;
    s._transform = this._transform;
    return s;
  }

  _validate(value) {
    if (!Array.isArray(value)) return { success: false, issues: [{ message: `Expected array, got ${typeof value}` }] };
    if (!this._itemSchema) return { success: true, data: value };

    const data = [];
    const issues = [];
    for (let i = 0; i < value.length; i++) {
      const result = this._itemSchema.safeParse(value[i]);
      if (result.success) data.push(result.data);
      else issues.push(...result.issues.map(iss => ({ ...iss, path: [i, ...(iss.path || [])] })));
    }

    if (issues.length) return { success: false, issues };
    return { success: true, data };
  }

  min(n) { return this.refine(v => v.length >= n, `Array must have at least ${n} items`); }
  max(n) { return this.refine(v => v.length <= n, `Array must have at most ${n} items`); }
  nonempty() { return this.refine(v => v.length > 0, 'Array cannot be empty'); }
}

class ObjectSchema extends Schema {
  constructor(shape) {
    super();
    this._shape = shape;
    this._strict = false;
  }

  _clone() {
    const s = new ObjectSchema({ ...this._shape });
    s._checks = [...this._checks];
    s._optional = this._optional;
    s._nullable = this._nullable;
    s._default = this._default;
    s._transform = this._transform;
    s._strict = this._strict;
    return s;
  }

  _validate(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { success: false, issues: [{ message: `Expected object, got ${Array.isArray(value) ? 'array' : typeof value}` }] };
    }

    const data = {};
    const issues = [];

    for (const [key, schema] of Object.entries(this._shape)) {
      const result = schema.safeParse(value[key]);
      if (result.success) {
        if (result.data !== undefined) data[key] = result.data;
      } else {
        issues.push(...result.issues.map(iss => ({ ...iss, path: [key, ...(iss.path || [])], message: `${key}: ${iss.message}` })));
      }
    }

    // Pass through extra keys (unless strict)
    if (!this._strict) {
      for (const key of Object.keys(value)) {
        if (!(key in this._shape)) data[key] = value[key];
      }
    }

    if (issues.length) return { success: false, issues };
    return { success: true, data };
  }

  strict() { const s = this._clone(); s._strict = true; return s; }

  extend(shape) {
    return new ObjectSchema({ ...this._shape, ...shape });
  }

  pick(...keys) {
    const shape = {};
    for (const key of keys) if (this._shape[key]) shape[key] = this._shape[key];
    return new ObjectSchema(shape);
  }

  omit(...keys) {
    const shape = { ...this._shape };
    for (const key of keys) delete shape[key];
    return new ObjectSchema(shape);
  }

  partial() {
    const shape = {};
    for (const [key, schema] of Object.entries(this._shape)) {
      shape[key] = schema.optional();
    }
    return new ObjectSchema(shape);
  }
}

class EnumSchema extends Schema {
  constructor(values) { super(); this._values = values; }
  _validate(value) {
    if (!this._values.includes(value)) return { success: false, issues: [{ message: `Must be one of: ${this._values.join(', ')}` }] };
    return { success: true, data: value };
  }
  _clone() { const s = new EnumSchema([...this._values]); s._checks = [...this._checks]; s._optional = this._optional; s._nullable = this._nullable; return s; }
}

class UnionSchema extends Schema {
  constructor(schemas) { super(); this._schemas = schemas; }
  _validate(value) {
    for (const schema of this._schemas) {
      const result = schema.safeParse(value);
      if (result.success) return result;
    }
    return { success: false, issues: [{ message: 'No matching type in union' }] };
  }
  _clone() { const s = new UnionSchema([...this._schemas]); s._checks = [...this._checks]; s._optional = this._optional; s._nullable = this._nullable; return s; }
}

// ===== Factory functions =====
export const z = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  array: (schema) => new ArraySchema(schema),
  object: (shape) => new ObjectSchema(shape),
  enum: (values) => new EnumSchema(values),
  union: (schemas) => new UnionSchema(schemas),
  any: () => new Schema(),
};

export { Schema, StringSchema, NumberSchema, BooleanSchema, ArraySchema, ObjectSchema, EnumSchema, UnionSchema, ValidationError };
