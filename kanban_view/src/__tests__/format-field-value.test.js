const { formatFieldValue } = require('../js/lib/format-field-value');

describe('formatFieldValue', () => {
  test('returns an empty string for a missing field', () => {
    expect(formatFieldValue(undefined)).toBe('');
  });

  test('returns an empty string when value is null/undefined', () => {
    expect(formatFieldValue({ type: 'SINGLE_LINE_TEXT', value: null })).toBe(
      '',
    );
  });

  test('stringifies scalar values (text/number/drop-down)', () => {
    expect(formatFieldValue({ type: 'SINGLE_LINE_TEXT', value: 'hello' })).toBe(
      'hello',
    );
    expect(formatFieldValue({ type: 'NUMBER', value: '42' })).toBe('42');
  });

  test('joins CHECK_BOX/MULTI_SELECT (array of strings) with commas', () => {
    expect(formatFieldValue({ type: 'CHECK_BOX', value: ['a', 'b'] })).toBe(
      'a, b',
    );
  });

  test('joins USER_SELECT/ORGANIZATION_SELECT/GROUP_SELECT (array of objects) by name', () => {
    expect(
      formatFieldValue({
        type: 'USER_SELECT',
        value: [
          { code: 'alice', name: 'Alice' },
          { code: 'bob', name: 'Bob' },
        ],
      }),
    ).toBe('Alice, Bob');
  });

  test('falls back to code when name is missing on an object value', () => {
    expect(
      formatFieldValue({ type: 'USER_SELECT', value: [{ code: 'alice' }] }),
    ).toBe('alice');
  });

  test('returns an empty string for an empty array value', () => {
    expect(formatFieldValue({ type: 'CHECK_BOX', value: [] })).toBe('');
  });
});
