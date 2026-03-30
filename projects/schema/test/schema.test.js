import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z, ValidationError } from '../src/index.js';

describe('String', () => {
  it('validates strings', () => {
    assert.equal(z.string().parse('hello'), 'hello');
  });
  it('rejects non-strings', () => {
    assert.throws(() => z.string().parse(42));
  });
  it('min/max', () => {
    assert.throws(() => z.string().min(5).parse('hi'));
    assert.equal(z.string().min(2).parse('hi'), 'hi');
    assert.throws(() => z.string().max(3).parse('toolong'));
  });
  it('email', () => {
    assert.equal(z.string().email().parse('a@b.com'), 'a@b.com');
    assert.throws(() => z.string().email().parse('invalid'));
  });
  it('trim transform', () => {
    assert.equal(z.string().trim().parse('  hello  '), 'hello');
  });
});

describe('Number', () => {
  it('validates numbers', () => assert.equal(z.number().parse(42), 42));
  it('rejects NaN', () => assert.throws(() => z.number().parse(NaN)));
  it('min/max', () => {
    assert.throws(() => z.number().min(5).parse(3));
    assert.equal(z.number().max(10).parse(5), 5);
  });
  it('int', () => {
    assert.equal(z.number().int().parse(5), 5);
    assert.throws(() => z.number().int().parse(5.5));
  });
  it('positive', () => assert.throws(() => z.number().positive().parse(-1)));
});

describe('Boolean', () => {
  it('validates booleans', () => {
    assert.equal(z.boolean().parse(true), true);
    assert.throws(() => z.boolean().parse('true'));
  });
});

describe('Array', () => {
  it('validates arrays', () => {
    assert.deepEqual(z.array(z.number()).parse([1, 2, 3]), [1, 2, 3]);
  });
  it('rejects invalid items', () => {
    assert.throws(() => z.array(z.number()).parse([1, 'two', 3]));
  });
  it('min/max', () => {
    assert.throws(() => z.array(z.number()).min(3).parse([1, 2]));
  });
  it('nonempty', () => {
    assert.throws(() => z.array(z.number()).nonempty().parse([]));
  });
});

describe('Object', () => {
  it('validates objects', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const data = schema.parse({ name: 'Alice', age: 30 });
    assert.equal(data.name, 'Alice');
    assert.equal(data.age, 30);
  });
  it('rejects invalid fields', () => {
    const schema = z.object({ name: z.string() });
    assert.throws(() => schema.parse({ name: 42 }));
  });
  it('partial', () => {
    const schema = z.object({ name: z.string(), age: z.number() }).partial();
    const data = schema.parse({ name: 'Alice' });
    assert.equal(data.name, 'Alice');
  });
  it('pick', () => {
    const schema = z.object({ name: z.string(), age: z.number(), email: z.string() });
    const picked = schema.pick('name', 'email');
    const data = picked.parse({ name: 'A', email: 'a@b.com' });
    assert.equal(data.name, 'A');
  });
  it('omit', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const omitted = schema.omit('age');
    const data = omitted.parse({ name: 'Alice' });
    assert.equal(data.name, 'Alice');
  });
  it('extend', () => {
    const base = z.object({ name: z.string() });
    const extended = base.extend({ age: z.number() });
    const data = extended.parse({ name: 'Alice', age: 30 });
    assert.equal(data.age, 30);
  });
});

describe('Optional/Nullable', () => {
  it('optional allows undefined', () => {
    assert.equal(z.string().optional().parse(undefined), undefined);
  });
  it('nullable allows null', () => {
    assert.equal(z.string().nullable().parse(null), null);
  });
  it('default provides fallback', () => {
    assert.equal(z.number().default(42).parse(undefined), 42);
  });
});

describe('Enum', () => {
  it('validates enum values', () => {
    const schema = z.enum(['red', 'green', 'blue']);
    assert.equal(schema.parse('red'), 'red');
    assert.throws(() => schema.parse('yellow'));
  });
});

describe('Union', () => {
  it('matches first valid schema', () => {
    const schema = z.union([z.string(), z.number()]);
    assert.equal(schema.parse('hello'), 'hello');
    assert.equal(schema.parse(42), 42);
    assert.throws(() => schema.parse(true));
  });
});

describe('safeParse', () => {
  it('returns success', () => {
    const result = z.string().safeParse('hello');
    assert.equal(result.success, true);
    assert.equal(result.data, 'hello');
  });
  it('returns failure', () => {
    const result = z.string().safeParse(42);
    assert.equal(result.success, false);
    assert.ok(result.issues.length > 0);
  });
});

describe('Complex schemas', () => {
  it('nested object with array', () => {
    const schema = z.object({
      name: z.string().min(1),
      tags: z.array(z.string()).min(1),
      meta: z.object({ created: z.number() }).optional(),
    });

    const data = schema.parse({ name: 'Project', tags: ['js', 'web'], meta: { created: 2024 } });
    assert.equal(data.name, 'Project');
    assert.equal(data.tags.length, 2);
    assert.equal(data.meta.created, 2024);
  });
});
