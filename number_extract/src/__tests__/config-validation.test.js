'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validExtract = (overrides) =>
  Object.assign(
    {
      sourceFieldCode: 'address',
      includeFullWidth: true,
      includeKanji: false,
      targetFieldCodes: ['chome', 'banchi'],
    },
    overrides,
  );

describe('ConfigValidation.validateExtracts', () => {
  test('accepts an empty array', () => {
    expect(ConfigValidation.validateExtracts([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('rejects a non-array value', () => {
    expect(ConfigValidation.validateExtracts(null).valid).toBe(false);
  });

  test('accepts a well-formed extract', () => {
    expect(ConfigValidation.validateExtracts([validExtract()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('requires sourceFieldCode', () => {
    const result = ConfigValidation.validateExtracts([
      validExtract({ sourceFieldCode: '' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires at least one target field', () => {
    const result = ConfigValidation.validateExtracts([
      validExtract({ targetFieldCodes: [] }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects duplicate target field codes within the same extract', () => {
    const result = ConfigValidation.validateExtracts([
      validExtract({ targetFieldCodes: ['chome', 'chome'] }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('rejects duplicate target field codes across different extracts', () => {
    const result = ConfigValidation.validateExtracts([
      validExtract({ targetFieldCodes: ['chome'] }),
      validExtract({ sourceFieldCode: 'other', targetFieldCodes: ['chome'] }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects a target field that is the same as the source field', () => {
    const result = ConfigValidation.validateExtracts([
      validExtract({
        sourceFieldCode: 'address',
        targetFieldCodes: ['address'],
      }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('元フィールド'))).toBe(true);
  });
});
