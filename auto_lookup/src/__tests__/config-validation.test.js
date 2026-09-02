'use strict';

const ConfigValidation = require('../js/lib/config-validation');

describe('ConfigValidation.validateFieldTriggers', () => {
  test('accepts an empty map (no target fields)', () => {
    expect(ConfigValidation.validateFieldTriggers({})).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('accepts a map of field codes to allowed trigger events', () => {
    const result = ConfigValidation.validateFieldTriggers({
      lookup_customer: ['edit.show'],
      history: ['create.show', 'edit.show'],
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('rejects a non-object value', () => {
    expect(ConfigValidation.validateFieldTriggers(null).valid).toBe(false);
    expect(ConfigValidation.validateFieldTriggers([]).valid).toBe(false);
  });

  test('rejects a field with an empty trigger events array', () => {
    const result = ConfigValidation.validateFieldTriggers({
      lookup_customer: [],
    });
    expect(result.valid).toBe(false);
  });

  test('rejects a field with a disallowed trigger event value', () => {
    const result = ConfigValidation.validateFieldTriggers({
      lookup_customer: ['create.submit'],
    });
    expect(result.valid).toBe(false);
  });
});
