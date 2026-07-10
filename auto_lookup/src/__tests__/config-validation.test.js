'use strict';

const ConfigValidation = require('../js/lib/config-validation');

describe('ConfigValidation.validateTargetFieldCodes', () => {
  test('accepts an empty array', () => {
    expect(ConfigValidation.validateTargetFieldCodes([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('accepts a list of non-empty field codes', () => {
    const result = ConfigValidation.validateTargetFieldCodes(['a', 'b']);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('rejects a non-array value', () => {
    expect(ConfigValidation.validateTargetFieldCodes(null).valid).toBe(false);
  });

  test('rejects a blank entry', () => {
    const result = ConfigValidation.validateTargetFieldCodes(['a', '']);
    expect(result.valid).toBe(false);
  });

  test('rejects duplicate field codes', () => {
    const result = ConfigValidation.validateTargetFieldCodes(['a', 'a']);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });
});
