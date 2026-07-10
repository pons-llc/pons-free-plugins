'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validLookup = (overrides) =>
  Object.assign(
    {
      subtableFieldCode: 'history',
      mode: 'PARTIAL_MATCH',
      conditionFieldCode: 'inspection_type',
      matchValue: '定期',
      direction: 'TOP_TO_BOTTOM',
      fieldMappings: [
        { subtableColumnCode: 'result', targetFieldCode: 'latest_result' },
      ],
    },
    overrides,
  );

describe('ConfigValidation.validateLookups', () => {
  test('accepts an empty array', () => {
    expect(ConfigValidation.validateLookups([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('rejects a non-array value', () => {
    const result = ConfigValidation.validateLookups(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('accepts a well-formed PARTIAL_MATCH lookup', () => {
    const result = ConfigValidation.validateLookups([validLookup()]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('requires subtableFieldCode', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({ subtableFieldCode: '' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects an unknown mode', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({ mode: 'SOMETHING' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires conditionFieldCode and matchValue for PARTIAL_MATCH/EXACT_MATCH', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        mode: 'EXACT_MATCH',
        conditionFieldCode: '',
        matchValue: '',
      }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('検索対象列'))).toBe(true);
    expect(result.errors.some((e) => e.includes('一致させる値'))).toBe(true);
  });

  test('requires conditionFieldCode but not matchValue for LATEST/OLDEST', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        mode: 'LATEST',
        conditionFieldCode: 'inspection_date',
        matchValue: '',
      }),
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('LATEST without conditionFieldCode is invalid', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({ mode: 'LATEST', conditionFieldCode: '', matchValue: '' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('TOP_ROW/BOTTOM_ROW do not require conditionFieldCode or matchValue', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        mode: 'TOP_ROW',
        conditionFieldCode: '',
        matchValue: '',
      }),
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('requires at least one field mapping', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({ fieldMappings: [] }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires each field mapping to have both column and target codes', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        fieldMappings: [
          { subtableColumnCode: '', targetFieldCode: 'latest_result' },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects duplicate target field codes within the same lookup', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        fieldMappings: [
          { subtableColumnCode: 'result', targetFieldCode: 'latest_result' },
          {
            subtableColumnCode: 'inspection_date',
            targetFieldCode: 'latest_result',
          },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('rejects duplicate target field codes across different lookups', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        fieldMappings: [
          { subtableColumnCode: 'result', targetFieldCode: 'latest_result' },
        ],
      }),
      validLookup({
        subtableFieldCode: 'other_history',
        fieldMappings: [
          { subtableColumnCode: 'note', targetFieldCode: 'latest_result' },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });
});
