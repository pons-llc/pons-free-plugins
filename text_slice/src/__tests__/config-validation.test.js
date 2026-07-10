'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validSlice = (overrides) =>
  Object.assign(
    {
      sourceFieldCode: 'code',
      func: 'LEFT',
      start: 1,
      length: 3,
      targetFieldCode: 'prefix',
    },
    overrides,
  );

describe('ConfigValidation.validateSlices', () => {
  test('accepts an empty array', () => {
    expect(ConfigValidation.validateSlices([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('rejects a non-array value', () => {
    expect(ConfigValidation.validateSlices(null).valid).toBe(false);
  });

  test('accepts a well-formed LEFT rule', () => {
    expect(ConfigValidation.validateSlices([validSlice()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('accepts a well-formed MID rule', () => {
    const result = ConfigValidation.validateSlices([
      validSlice({ func: 'MID', start: 2, length: 3 }),
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('requires sourceFieldCode', () => {
    const result = ConfigValidation.validateSlices([
      validSlice({ sourceFieldCode: '' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects an unknown function', () => {
    const result = ConfigValidation.validateSlices([
      validSlice({ func: 'SOMETHING' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires length to be a positive integer', () => {
    expect(
      ConfigValidation.validateSlices([validSlice({ length: 0 })]).valid,
    ).toBe(false);
    expect(
      ConfigValidation.validateSlices([validSlice({ length: -1 })]).valid,
    ).toBe(false);
    expect(
      ConfigValidation.validateSlices([validSlice({ length: 1.5 })]).valid,
    ).toBe(false);
  });

  test('MID additionally requires start to be a positive integer', () => {
    const result = ConfigValidation.validateSlices([
      validSlice({ func: 'MID', start: 0, length: 2 }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('LEFT/RIGHT do not require a start parameter', () => {
    const result = ConfigValidation.validateSlices([
      validSlice({ func: 'RIGHT', start: undefined, length: 2 }),
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('requires a target field', () => {
    const result = ConfigValidation.validateSlices([
      validSlice({ targetFieldCode: '' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects a target field that is the same as the source field', () => {
    const result = ConfigValidation.validateSlices([
      validSlice({ sourceFieldCode: 'code', targetFieldCode: 'code' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('元フィールド'))).toBe(true);
  });

  test('rejects duplicate target field codes across different rules', () => {
    const result = ConfigValidation.validateSlices([
      validSlice({ targetFieldCode: 'prefix' }),
      validSlice({ sourceFieldCode: 'other', targetFieldCode: 'prefix' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });
});
