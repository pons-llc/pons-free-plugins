'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validSplit = (overrides) =>
  Object.assign(
    {
      sourceFieldCode: 'address',
      delimiterMode: 'CHARACTERS',
      delimiters: ['-'],
      pattern: '',
      targetFieldCodes: ['chome', 'banchi'],
    },
    overrides,
  );

describe('ConfigValidation.validateSplits', () => {
  test('accepts an empty array', () => {
    expect(ConfigValidation.validateSplits([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('rejects a non-array value', () => {
    const result = ConfigValidation.validateSplits(null);
    expect(result.valid).toBe(false);
  });

  test('accepts a well-formed CHARACTERS split', () => {
    expect(ConfigValidation.validateSplits([validSplit()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('accepts a well-formed REGEX split', () => {
    const result = ConfigValidation.validateSplits([
      validSplit({ delimiterMode: 'REGEX', delimiters: [], pattern: '[-/]' }),
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('requires sourceFieldCode', () => {
    const result = ConfigValidation.validateSplits([
      validSplit({ sourceFieldCode: '' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects an unknown delimiterMode', () => {
    const result = ConfigValidation.validateSplits([
      validSplit({ delimiterMode: 'SOMETHING' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('CHARACTERS mode requires at least one delimiter', () => {
    const result = ConfigValidation.validateSplits([
      validSplit({ delimiters: [] }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('REGEX mode requires a non-empty pattern', () => {
    const result = ConfigValidation.validateSplits([
      validSplit({ delimiterMode: 'REGEX', delimiters: [], pattern: '' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('REGEX mode rejects a pattern that fails to compile', () => {
    const result = ConfigValidation.validateSplits([
      validSplit({
        delimiterMode: 'REGEX',
        delimiters: [],
        pattern: '(unclosed',
      }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('正規表現'))).toBe(true);
  });

  test('requires at least one target field', () => {
    const result = ConfigValidation.validateSplits([
      validSplit({ targetFieldCodes: [] }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects duplicate target field codes within the same split', () => {
    const result = ConfigValidation.validateSplits([
      validSplit({ targetFieldCodes: ['chome', 'chome'] }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('rejects duplicate target field codes across different splits', () => {
    const result = ConfigValidation.validateSplits([
      validSplit({ targetFieldCodes: ['chome'] }),
      validSplit({ sourceFieldCode: 'other', targetFieldCodes: ['chome'] }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('rejects a target field that is the same as the source field', () => {
    const result = ConfigValidation.validateSplits([
      validSplit({ sourceFieldCode: 'address', targetFieldCodes: ['address'] }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('元フィールド'))).toBe(true);
  });
});
