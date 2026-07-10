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

const validEra = (overrides) =>
  Object.assign({ name: '和新', startDate: '2040-03-01' }, overrides);

describe('ConfigValidation.validateEras — happy paths', () => {
  test('an empty array of eras is valid (no future era registered yet)', () => {
    expect(ConfigValidation.validateEras([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('a single well-formed era is valid', () => {
    expect(ConfigValidation.validateEras([validEra()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('multiple eras with distinct start dates are valid', () => {
    const eras = [
      validEra({ name: '和新', startDate: '2040-03-01' }),
      validEra({ name: '和心', startDate: '2060-08-15' }),
    ];
    expect(ConfigValidation.validateEras(eras)).toEqual({
      valid: true,
      errors: [],
    });
  });
});

describe('ConfigValidation.validateEras — structural errors', () => {
  test('non-array input is invalid', () => {
    expect(ConfigValidation.validateEras(null).valid).toBe(false);
    expect(ConfigValidation.validateEras(undefined).valid).toBe(false);
    expect(ConfigValidation.validateEras('x').valid).toBe(false);
  });

  test('missing era name is invalid', () => {
    const result = ConfigValidation.validateEras([validEra({ name: '' })]);
    expect(result.valid).toBe(false);
  });

  test('missing/malformed startDate is invalid', () => {
    expect(
      ConfigValidation.validateEras([validEra({ startDate: '' })]).valid,
    ).toBe(false);
    expect(
      ConfigValidation.validateEras([validEra({ startDate: '2040/03/01' })])
        .valid,
    ).toBe(false);
  });
});

describe('ConfigValidation.validateEras — semantic errors', () => {
  test('two eras with the same start date are invalid (ambiguous which era applies)', () => {
    const eras = [
      validEra({ name: '和新', startDate: '2040-03-01' }),
      validEra({ name: '和心', startDate: '2040-03-01' }),
    ];
    const result = ConfigValidation.validateEras(eras);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('all applicable errors are reported together, not just the first one', () => {
    const eras = [validEra({ name: '' }), validEra({ startDate: 'bogus' })];
    const result = ConfigValidation.validateEras(eras);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
