'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validLookup = (overrides) =>
  Object.assign(
    {
      selfKeyFieldCode: 'customer_code',
      otherKeyFieldCode: 'code',
      buttonSpaceElementId: 'space_1',
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

  test('requires buttonSpaceElementId', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({ buttonSpaceElementId: '' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects duplicate buttonSpaceElementId across different lookups', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({ buttonSpaceElementId: 'space_1' }),
      validLookup({
        selfKeyFieldCode: 'other_code',
        buttonSpaceElementId: 'space_1',
        fieldMappings: [
          { sourceFieldCode: 'title', targetFieldCode: 'other_name' },
        ],
      }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('accepts different buttonSpaceElementId across different lookups', () => {
    const result = ConfigValidation.validateLookups([
      validLookup({ buttonSpaceElementId: 'space_1' }),
      validLookup({
        selfKeyFieldCode: 'other_code',
        buttonSpaceElementId: 'space_2',
        fieldMappings: [
          { sourceFieldCode: 'title', targetFieldCode: 'other_name' },
        ],
      }),
    ]);
    expect(result.valid).toBe(true);
  });

  describe('otherKeyFieldCode with fieldInfoByCode', () => {
    test('accepts a SINGLE_LINE_TEXT field', () => {
      const result = ConfigValidation.validateLookups(
        [validLookup({ otherKeyFieldCode: 'code' })],
        { code: { type: 'SINGLE_LINE_TEXT' } },
      );
      expect(result.valid).toBe(true);
    });

    test('accepts a LINK field', () => {
      const result = ConfigValidation.validateLookups(
        [validLookup({ otherKeyFieldCode: 'url' })],
        { url: { type: 'LINK' } },
      );
      expect(result.valid).toBe(true);
    });

    test('rejects a RECORD_NUMBER field (like operator is not usable)', () => {
      const result = ConfigValidation.validateLookups(
        [validLookup({ otherKeyFieldCode: 'レコード番号' })],
        { レコード番号: { type: 'RECORD_NUMBER' } },
      );
      expect(result.valid).toBe(false);
    });

    test('rejects a NUMBER field (like operator is not usable)', () => {
      const result = ConfigValidation.validateLookups(
        [validLookup({ otherKeyFieldCode: 'code' })],
        { code: { type: 'NUMBER' } },
      );
      expect(result.valid).toBe(false);
    });

    test('skips the check when fieldInfoByCode is not given', () => {
      const result = ConfigValidation.validateLookups([
        validLookup({ otherKeyFieldCode: 'code' }),
      ]);
      expect(result.valid).toBe(true);
    });
  });

  describe('modalFieldCodes', () => {
    test('accepts an empty/omitted list (falls back to field mapping source fields)', () => {
      expect(
        ConfigValidation.validateLookups([validLookup({ modalFieldCodes: [] })])
          .valid,
      ).toBe(true);
      expect(
        ConfigValidation.validateLookups([
          validLookup({ modalFieldCodes: undefined }),
        ]).valid,
      ).toBe(true);
    });

    test('accepts a list of non-empty field codes', () => {
      expect(
        ConfigValidation.validateLookups([
          validLookup({ modalFieldCodes: ['name', 'code'] }),
        ]).valid,
      ).toBe(true);
    });

    test('rejects an empty entry in the list', () => {
      const result = ConfigValidation.validateLookups([
        validLookup({ modalFieldCodes: ['name', ''] }),
      ]);
      expect(result.valid).toBe(false);
    });
  });
});
