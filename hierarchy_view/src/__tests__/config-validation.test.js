'use strict';

const ConfigValidation = require('../js/lib/config-validation');

describe('ConfigValidation.validateConfig', () => {
  test('accepts a well-formed config', () => {
    const result = ConfigValidation.validateConfig({
      parentFieldCode: 'parent_code',
      matchFieldCode: '$id',
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('requires parentFieldCode', () => {
    const result = ConfigValidation.validateConfig({
      parentFieldCode: '',
      matchFieldCode: '$id',
    });
    expect(result.valid).toBe(false);
  });

  test('requires matchFieldCode', () => {
    const result = ConfigValidation.validateConfig({
      parentFieldCode: 'parent_code',
      matchFieldCode: '',
    });
    expect(result.valid).toBe(false);
  });

  test('rejects using the same field for both parent and match fields', () => {
    const result = ConfigValidation.validateConfig({
      parentFieldCode: 'code_a',
      matchFieldCode: 'code_a',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('同じ'))).toBe(true);
  });

  test('rejects a missing config object', () => {
    expect(ConfigValidation.validateConfig(null).valid).toBe(false);
  });
});
