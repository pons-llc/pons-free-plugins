'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validLookup = (overrides) =>
  Object.assign(
    {
      selfKeyFieldCode: 'customer_code',
      otherKeyFieldCode: 'code',
      conditions: [
        {
          fieldCode: 'category',
          operator: 'EXACT_MATCH',
          valueSource: 'FIXED',
          value: 'A',
        },
      ],
      fieldMappings: [
        { sourceFieldCode: 'name', targetFieldCode: 'customer_name' },
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
    expect(ConfigValidation.validateLookups(null).valid).toBe(false);
  });

  test('accepts a well-formed lookup', () => {
    expect(ConfigValidation.validateLookups([validLookup()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('accepts a lookup with no additional conditions', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({ conditions: [] }),
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('requires selfKeyFieldCode and otherKeyFieldCode', () => {
    expect(
      ConfigValidation.validateLookups([validLookup({ selfKeyFieldCode: '' })])
        .valid,
    ).toBe(false);
    expect(
      ConfigValidation.validateLookups([validLookup({ otherKeyFieldCode: '' })])
        .valid,
    ).toBe(false);
  });

  test('rejects an unknown condition operator', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        conditions: [
          {
            fieldCode: 'category',
            operator: 'SOMETHING',
            valueSource: 'FIXED',
            value: 'A',
          },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires a fieldCode on each condition', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        conditions: [
          {
            fieldCode: '',
            operator: 'EXACT_MATCH',
            valueSource: 'FIXED',
            value: 'A',
          },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('FIXED value source requires a non-empty value', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        conditions: [
          {
            fieldCode: 'category',
            operator: 'EXACT_MATCH',
            valueSource: 'FIXED',
            value: '',
          },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('SELF_FIELD value source requires a non-empty selfFieldCode', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        conditions: [
          {
            fieldCode: 'category',
            operator: 'EXACT_MATCH',
            valueSource: 'SELF_FIELD',
            selfFieldCode: '',
          },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires at least one field mapping', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({ fieldMappings: [] }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires each field mapping to have both source and target codes', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        fieldMappings: [
          { sourceFieldCode: '', targetFieldCode: 'customer_name' },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects duplicate target field codes across different lookups', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({
        fieldMappings: [
          { sourceFieldCode: 'name', targetFieldCode: 'customer_name' },
        ],
      }),
      validLookup({
        selfKeyFieldCode: 'other_code',
        fieldMappings: [
          { sourceFieldCode: 'title', targetFieldCode: 'customer_name' },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });
});
