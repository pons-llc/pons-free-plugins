'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validWidget = (overrides) =>
  Object.assign(
    {
      sourceType: 'FIELD',
      fieldCode: 'progress',
      steps: ['申請中', '承認中', '完了'],
      design: 'BLUE',
    },
    overrides,
  );

describe('ConfigValidation.validateWidgets', () => {
  test('accepts an empty array', () => {
    expect(ConfigValidation.validateWidgets([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('rejects a non-array value', () => {
    expect(ConfigValidation.validateWidgets(null).valid).toBe(false);
  });

  test('accepts a well-formed FIELD widget', () => {
    expect(ConfigValidation.validateWidgets([validWidget()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('accepts a well-formed STATUS widget without a fieldCode', () => {
    const result = ConfigValidation.validateWidgets([
      validWidget({ sourceType: 'STATUS', fieldCode: '' }),
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('rejects an unknown sourceType', () => {
    const result = ConfigValidation.validateWidgets([
      validWidget({ sourceType: 'SOMETHING' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('FIELD sourceType requires a fieldCode', () => {
    const result = ConfigValidation.validateWidgets([
      validWidget({ sourceType: 'FIELD', fieldCode: '' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires at least one step', () => {
    const result = ConfigValidation.validateWidgets([
      validWidget({ steps: [] }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects steps with blank entries', () => {
    const result = ConfigValidation.validateWidgets([
      validWidget({ steps: ['申請中', ''] }),
    ]);
    expect(result.valid).toBe(false);
  });
});
