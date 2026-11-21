import { strict as assert } from 'assert';

// Input validation using a minimal schema validator (zod-like)
// In production, use zod or joi

type Validator<T> = (input: unknown) => T;

function string(opts?: { minLength?: number; maxLength?: number; pattern?: RegExp }): Validator<string> {
  return (input) => {
    if (typeof input !== 'string') throw new Error('Expected string');
    if (opts?.minLength && input.length < opts.minLength) {
      throw new Error(`Must be at least ${opts.minLength} characters`);
    }
    if (opts?.maxLength && input.length > opts.maxLength) {
      throw new Error(`Must not exceed ${opts.maxLength} characters`);
    }
    if (opts?.pattern && !opts.pattern.test(input)) {
      throw new Error('Invalid format');
    }
    return input;
  };
}

function number(opts?: { min?: number; max?: number }): Validator<number> {
  return (input) => {
    const n = Number(input);
    if (Number.isNaN(n)) throw new Error('Expected number');
    if (opts?.min !== undefined && n < opts.min) throw new Error(`Must be >= ${opts.min}`);
    if (opts?.max !== undefined && n > opts.max) throw new Error(`Must be <= ${opts.max}`);
    return n;
  };
}

function object<T extends Record<string, Validator<unknown>>>(
  schema: T
): Validator<{ [K in keyof T]: ReturnType<T[K]> }> {
  return (input) => {
    if (typeof input !== 'object' || input === null) throw new Error('Expected object');
    const result: Record<string, unknown> = {};
    const errors: string[] = [];
    for (const [key, validator] of Object.entries(schema)) {
      try {
        result[key] = validator((input as Record<string, unknown>)[key]);
      } catch (err) {
        errors.push(`${key}: ${(err as Error).message}`);
      }
    }
    if (errors.length > 0) throw new Error(errors.join('; '));
    return result as never;
  };
}

// Schema for user registration
const registerSchema = object({
  email: string({ minLength: 5, maxLength: 254, pattern: /^[^s@]+@[^s@]+.[^s@]+$/ }),
  username: string({ minLength: 3, maxLength: 30, pattern: /^[a-zA-Z0-9_-]+$/ }),
  age: number({ min: 13, max: 120 }),
});

// Valid input
const valid = registerSchema({ email: 'alice@example.com', username: 'alice_dev', age: 25 });
assert.equal(valid.email, 'alice@example.com');

// Invalid email
assert.throws(() => registerSchema({ email: 'not-an-email', username: 'bob', age: 20 }), /email/i);

// SQL injection attempt in username field
assert.throws(
  () => registerSchema({ email: 'c@d.com', username: "'; DROP TABLE users;--", age: 20 }),
  /username/i,
  'Username with SQL injection must fail pattern validation'
);

// Age out of range
assert.throws(() => registerSchema({ email: 'x@y.com', username: 'x', age: 5 }), /min/i);

console.log('Input validation tests passed');
