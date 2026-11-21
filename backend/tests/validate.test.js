const {
  requireString, requireEmail, requirePassword, requirePasswordInput, requireCode,
  optionalString, optionalDate, optionalInt, invalid,
} = require('../src/utils/validate');

const arabic = (count) => 'ب'.repeat(count);

describe('invalid', () => {
  test('makes a 400 VALIDATION_ERROR with the message', () => {
    const error = invalid('name is required.');
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('name is required.');
  });
});

describe('requireString', () => {
  test('returns the text without spaces around it', () => {
    expect(requireString('  Kitchen  ', 'name')).toBe('Kitchen');
  });

  test('rejects a missing value, a number, and spaces only', () => {
    expect(() => requireString(undefined, 'name')).toThrow('name is required.');
    expect(() => requireString(5, 'name')).toThrow('name is required.');
    expect(() => requireString('   ', 'name')).toThrow('name is required.');
  });

  test('names the minimum when it is more than 1', () => {
    expect(() => requireString('ab', 'name', { min: 3 })).toThrow('name must be at least 3 characters.');
    expect(requireString('abc', 'name', { min: 3 })).toBe('abc');
  });

  test('accepts 255 characters and rejects 256', () => {
    expect(requireString('a'.repeat(255), 'name')).toHaveLength(255);
    expect(() => requireString('a'.repeat(256), 'name')).toThrow('name must be at most 255 characters.');
  });

  test('measures the length after removing the spaces around it', () => {
    expect(requireString('  ab  ', 'name', { max: 2 })).toBe('ab');
  });
});

describe('requireEmail', () => {
  test('trims and lowercases the email', () => {
    expect(requireEmail('  Ali@Mail.COM ')).toBe('ali@mail.com');
  });

  test('rejects an email without a dot after the @', () => {
    expect(() => requireEmail('ali@mail')).toThrow('email is not a valid email address.');
  });

  test('rejects a missing email', () => {
    expect(() => requireEmail(undefined)).toThrow('email is required.');
  });
});

describe('requirePassword', () => {
  test('rejects 7 characters and accepts 8', () => {
    expect(() => requirePassword('abc1234')).toThrow('at least 8');
    expect(requirePassword('12345678')).toBe('12345678');
  });

  test('keeps the spaces in the password', () => {
    expect(requirePassword('  my pass  ')).toBe('  my pass  ');
  });

  test('accepts 36 Arabic letters (72 bytes) and rejects one byte more', () => {
    expect(requirePassword(arabic(36))).toBe(arabic(36));
    expect(() => requirePassword(`${arabic(36)}a`)).toThrow('at most 72 bytes');
  });

  test('counts an emoji as 4 bytes', () => {
    expect(requirePassword('🔥'.repeat(18))).toBe('🔥'.repeat(18));
    expect(() => requirePassword('🔥'.repeat(19))).toThrow('at most 72 bytes');
  });

  test('rejects a value that is not text', () => {
    expect(() => requirePassword(12345678)).toThrow('at least 8');
  });
});

describe('requirePasswordInput', () => {
  test('accepts a short password, because old passwords may be short', () => {
    expect(requirePasswordInput('a', 'current_password')).toBe('a');
  });

  test('rejects an empty or missing password', () => {
    expect(() => requirePasswordInput('', 'current_password')).toThrow('current_password is required.');
    expect(() => requirePasswordInput(undefined, 'current_password')).toThrow('current_password is required.');
  });

  test('rejects more than 72 bytes', () => {
    expect(() => requirePasswordInput(`${arabic(36)}a`, 'current_password')).toThrow('current_password must be at most 72 bytes.');
  });

  test('keeps the spaces in the password', () => {
    expect(requirePasswordInput(' secret ', 'current_password')).toBe(' secret ');
  });
});

describe('requireCode', () => {
  test('returns the code without spaces', () => {
    expect(requireCode('123 456')).toBe('123456');
  });

  test('rejects a code with 5 digits', () => {
    expect(() => requireCode('12345')).toThrow('6 digits');
  });

  test('rejects a code with 7 digits', () => {
    expect(() => requireCode('1234567')).toThrow('6 digits');
  });

  test('rejects letters and a value that is not text', () => {
    expect(() => requireCode('12a456')).toThrow('6 digits');
    expect(() => requireCode(123456)).toThrow('6 digits');
  });
});

describe('optionalString', () => {
  test('returns null when there is no value', () => {
    expect(optionalString(undefined, 'location', 150)).toBeNull();
    expect(optionalString(null, 'location', 150)).toBeNull();
    expect(optionalString('', 'location', 150)).toBeNull();
  });

  test('returns the text without spaces around it', () => {
    expect(optionalString('  Restaurant A ', 'location', 150)).toBe('Restaurant A');
  });

  test('rejects text longer than the maximum', () => {
    expect(() => optionalString('a'.repeat(151), 'location', 150)).toThrow('location must be at most 150 characters.');
  });
});

describe('optionalDate', () => {
  test('returns null when there is no value', () => {
    expect(optionalDate(undefined, 'from')).toBeNull();
    expect(optionalDate('', 'from')).toBeNull();
  });

  test('turns an ISO 8601 text into a date', () => {
    expect(optionalDate('2026-11-16T10:00:00Z', 'from').toISOString()).toBe('2026-11-16T10:00:00.000Z');
  });

  test('rejects text that is not a date, and a number', () => {
    expect(() => optionalDate('yesterday', 'from')).toThrow('from must be a valid ISO 8601 date.');
    expect(() => optionalDate(1763287200000, 'from')).toThrow('from must be a valid ISO 8601 date.');
  });
});

describe('optionalInt', () => {
  const limits = { min: 1, max: 100, fallback: 20 };

  test('returns the fallback when there is no value', () => {
    expect(optionalInt(undefined, 'limit', limits)).toBe(20);
    expect(optionalInt('', 'limit', limits)).toBe(20);
  });

  test('turns the text into a number', () => {
    expect(optionalInt('5', 'limit', limits)).toBe(5);
  });

  test('accepts the minimum and the maximum, and rejects one past each', () => {
    expect(optionalInt('1', 'limit', limits)).toBe(1);
    expect(optionalInt('100', 'limit', limits)).toBe(100);
    expect(() => optionalInt('0', 'limit', limits)).toThrow('limit must be between 1 and 100.');
    expect(() => optionalInt('101', 'limit', limits)).toThrow('limit must be between 1 and 100.');
  });

  test('uses 1 as the minimum when none is given', () => {
    expect(() => optionalInt('0', 'limit', { max: 100, fallback: 20 })).toThrow('limit must be between 1 and 100.');
  });

  test('rejects a fraction, a negative number, letters, and a value that is not text', () => {
    expect(() => optionalInt('1.5', 'limit', limits)).toThrow('limit must be a whole number.');
    expect(() => optionalInt('-1', 'limit', limits)).toThrow('limit must be a whole number.');
    expect(() => optionalInt('5a', 'limit', limits)).toThrow('limit must be a whole number.');
    expect(() => optionalInt(5, 'limit', limits)).toThrow('limit must be a whole number.');
  });
});