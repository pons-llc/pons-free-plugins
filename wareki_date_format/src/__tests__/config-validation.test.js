const ConfigValidation = require('../js/lib/config-validation');

const validPair = (overrides) =>
  Object.assign(
    {
      sourceFieldCode: 'day1',
      targetFieldCode: 'wareki1',
      preset: 'WAREKI_ONLY',
      zenkaku: false,
    },
    overrides,
  );

describe('ConfigValidation.validatePairs — happy paths', () => {
  test('an empty array of pairs is valid (plugin configured with no conversions yet)', () => {
    expect(ConfigValidation.validatePairs([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('a single well-formed pair is valid', () => {
    expect(ConfigValidation.validatePairs([validPair()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('multiple pairs with distinct source/target fields are valid', () => {
    const pairs = [
      validPair({ sourceFieldCode: 'day1', targetFieldCode: 'wareki1' }),
      validPair({
        sourceFieldCode: 'day2',
        targetFieldCode: 'wareki2',
        preset: 'WAREKI_WITH_SEIREKI',
      }),
    ];
    expect(ConfigValidation.validatePairs(pairs)).toEqual({
      valid: true,
      errors: [],
    });
  });
});

describe('ConfigValidation.validatePairs — structural errors', () => {
  test('non-array input is invalid', () => {
    expect(ConfigValidation.validatePairs(null).valid).toBe(false);
    expect(ConfigValidation.validatePairs(undefined).valid).toBe(false);
    expect(ConfigValidation.validatePairs('x').valid).toBe(false);
  });

  test('missing sourceFieldCode is invalid', () => {
    const result = ConfigValidation.validatePairs([
      validPair({ sourceFieldCode: '' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('missing targetFieldCode is invalid', () => {
    const result = ConfigValidation.validatePairs([
      validPair({ targetFieldCode: '' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('unknown preset value is invalid', () => {
    const result = ConfigValidation.validatePairs([
      validPair({ preset: 'NOT_A_PRESET' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('non-boolean zenkaku is invalid', () => {
    const result = ConfigValidation.validatePairs([
      validPair({ zenkaku: 'yes' }),
    ]);
    expect(result.valid).toBe(false);
  });
});

describe('ConfigValidation.validatePairs — semantic errors', () => {
  test('a pair whose source and target field are the same is invalid', () => {
    const result = ConfigValidation.validatePairs([
      validPair({ sourceFieldCode: 'same', targetFieldCode: 'same' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('同じ'))).toBe(true);
  });

  test('two pairs writing to the same target field are invalid (ambiguous overwrite order)', () => {
    const pairs = [
      validPair({ sourceFieldCode: 'day1', targetFieldCode: 'wareki_shared' }),
      validPair({ sourceFieldCode: 'day2', targetFieldCode: 'wareki_shared' }),
    ];
    const result = ConfigValidation.validatePairs(pairs);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('two pairs sharing the same source field but different targets are valid', () => {
    const pairs = [
      validPair({ sourceFieldCode: 'day1', targetFieldCode: 'wareki1' }),
      validPair({
        sourceFieldCode: 'day1',
        targetFieldCode: 'wareki1_seireki',
        preset: 'WAREKI_WITH_SEIREKI',
      }),
    ];
    expect(ConfigValidation.validatePairs(pairs)).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('all applicable errors are reported together, not just the first one', () => {
    const pairs = [
      validPair({ sourceFieldCode: '', targetFieldCode: '' }),
      validPair({ preset: 'BOGUS' }),
    ];
    const result = ConfigValidation.validatePairs(pairs);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
