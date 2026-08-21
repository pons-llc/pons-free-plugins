'use strict';

const FieldValueFormatter = require('../js/lib/field-value-formatter');

describe('formatFieldValue by category', () => {
  test('TEXT: returns the string value as-is', () => {
    expect(
      FieldValueFormatter.formatFieldValue('SINGLE_LINE_TEXT', {
        value: '作業衣等購入',
      }),
    ).toBe('作業衣等購入');
  });

  test('TEXT: empty/missing value becomes an empty string', () => {
    expect(FieldValueFormatter.formatFieldValue('SINGLE_LINE_TEXT', null)).toBe(
      '',
    );
    expect(
      FieldValueFormatter.formatFieldValue('SINGLE_LINE_TEXT', { value: '' }),
    ).toBe('');
  });

  test('NUMBER: stringifies the numeric value, keeping 0', () => {
    expect(FieldValueFormatter.formatFieldValue('NUMBER', { value: '0' })).toBe(
      '0',
    );
    expect(
      FieldValueFormatter.formatFieldValue('NUMBER', { value: '12345' }),
    ).toBe('12345');
  });

  test('DATE: formats "YYYY-MM-DD" without going through a Date object (no timezone shift)', () => {
    expect(
      FieldValueFormatter.formatFieldValue('DATE', { value: '2026-09-03' }),
    ).toBe('2026年09月03日');
  });

  test('DATE: falls back to the raw value when it is not the expected shape', () => {
    expect(
      FieldValueFormatter.formatFieldValue('DATE', { value: 'not-a-date' }),
    ).toBe('not-a-date');
  });

  test('DATETIME: converts to a locale string and does not crash on an invalid value', () => {
    const formatted = FieldValueFormatter.formatFieldValue('DATETIME', {
      value: '2024-06-15T12:00:00Z',
    });
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).not.toBe('2024-06-15T12:00:00Z');
    expect(formatted).toContain('2024');

    expect(
      FieldValueFormatter.formatFieldValue('DATETIME', { value: 'garbage' }),
    ).toBe('garbage');
  });

  test('CREATED_TIME/UPDATED_TIME use the same DATETIME handling', () => {
    const formatted = FieldValueFormatter.formatFieldValue('CREATED_TIME', {
      value: '2024-06-15T12:00:00Z',
    });
    expect(formatted).toContain('2024');
  });

  test('TIME: returns the raw "HH:MM" string without timezone conversion', () => {
    expect(
      FieldValueFormatter.formatFieldValue('TIME', { value: '09:30' }),
    ).toBe('09:30');
  });

  test('CHOICE: returns the selected string value', () => {
    expect(
      FieldValueFormatter.formatFieldValue('DROP_DOWN', {
        value: '物品・委託等',
      }),
    ).toBe('物品・委託等');
  });

  test('MULTI_CHOICE: joins the array with 、', () => {
    expect(
      FieldValueFormatter.formatFieldValue('CHECK_BOX', {
        value: ['繊維', 'ゴム', '皮革製品'],
      }),
    ).toBe('繊維、ゴム、皮革製品');
  });

  test('MULTI_CHOICE: empty array becomes an empty string', () => {
    expect(
      FieldValueFormatter.formatFieldValue('MULTI_SELECT', { value: [] }),
    ).toBe('');
  });

  test('ENTITY: joins entity display names with 、, handling both array and single-object shapes', () => {
    expect(
      FieldValueFormatter.formatFieldValue('USER_SELECT', {
        value: [
          { code: 'sato', name: '佐藤' },
          { code: 'suzuki', name: '鈴木' },
        ],
      }),
    ).toBe('佐藤、鈴木');
    expect(
      FieldValueFormatter.formatFieldValue('CREATOR', {
        value: { code: 'sato', name: '佐藤' },
      }),
    ).toBe('佐藤');
  });

  test('unsupported/unknown type returns an empty string rather than throwing', () => {
    expect(
      FieldValueFormatter.formatFieldValue('SUBTABLE', { value: [] }),
    ).toBe('');
    expect(
      FieldValueFormatter.formatFieldValue('UNKNOWN_TYPE', { value: 'x' }),
    ).toBe('');
  });
});

describe('formatNumericValue', () => {
  test('returns the raw value when neither digit grouping nor a unit is requested', () => {
    expect(
      FieldValueFormatter.formatNumericValue(
        { value: '1234567' },
        { digitGrouping: false, showUnit: false },
      ),
    ).toBe('1234567');
  });

  test('inserts thousands separators into the integer part only', () => {
    expect(
      FieldValueFormatter.formatNumericValue(
        { value: '1234567' },
        { digitGrouping: true, showUnit: false },
      ),
    ).toBe('1,234,567');
  });

  test('groups digits without touching the decimal part (string-based, no float rounding)', () => {
    expect(
      FieldValueFormatter.formatNumericValue(
        { value: '1234567.891234567891' },
        { digitGrouping: true, showUnit: false },
      ),
    ).toBe('1,234,567.891234567891');
  });

  test('handles negative numbers, keeping the minus sign outside the grouped digits', () => {
    expect(
      FieldValueFormatter.formatNumericValue(
        { value: '-1234567' },
        { digitGrouping: true, showUnit: false },
      ),
    ).toBe('-1,234,567');
  });

  test('does not add separators to a number with 3 or fewer integer digits', () => {
    expect(
      FieldValueFormatter.formatNumericValue(
        { value: '567' },
        { digitGrouping: true, showUnit: false },
      ),
    ).toBe('567');
  });

  test('appends the unit after the number when unitPosition is AFTER', () => {
    expect(
      FieldValueFormatter.formatNumericValue(
        { value: '1234567' },
        {
          digitGrouping: true,
          showUnit: true,
          unit: '円',
          unitPosition: 'AFTER',
        },
      ),
    ).toBe('1,234,567円');
  });

  test('prepends the unit before the number when unitPosition is BEFORE', () => {
    expect(
      FieldValueFormatter.formatNumericValue(
        { value: '1234567' },
        {
          digitGrouping: false,
          showUnit: true,
          unit: '$',
          unitPosition: 'BEFORE',
        },
      ),
    ).toBe('$1234567');
  });

  test('showUnit with no unit configured adds nothing', () => {
    expect(
      FieldValueFormatter.formatNumericValue(
        { value: '100' },
        {
          digitGrouping: false,
          showUnit: true,
          unit: '',
          unitPosition: 'AFTER',
        },
      ),
    ).toBe('100');
  });

  test('empty/missing value formats to an empty string regardless of options', () => {
    expect(
      FieldValueFormatter.formatNumericValue(null, {
        digitGrouping: true,
        showUnit: true,
        unit: '円',
      }),
    ).toBe('');
    expect(
      FieldValueFormatter.formatNumericValue(
        { value: '' },
        { digitGrouping: true, showUnit: true, unit: '円' },
      ),
    ).toBe('');
  });

  test('a value that is not a plain number string is returned as-is without grouping (safety fallback)', () => {
    expect(
      FieldValueFormatter.formatNumericValue(
        { value: 'not-a-number' },
        { digitGrouping: true, showUnit: false },
      ),
    ).toBe('not-a-number');
  });

  test('preserves very large integers exactly (no float precision loss)', () => {
    const bigValue = '123456789012345678901234567890';
    expect(
      FieldValueFormatter.formatNumericValue(
        { value: bigValue },
        { digitGrouping: true, showUnit: false },
      ),
    ).toBe('123,456,789,012,345,678,901,234,567,890');
  });
});
