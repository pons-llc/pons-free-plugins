'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validFixedRule = (overrides) =>
  Object.assign(
    {
      baseFieldCode: 'apply_date',
      targetFieldCode: 'due_date',
      unit: 'DAYS',
      offsetSource: 'FIXED',
      fixedValue: 10,
      offsetFieldCode: '',
    },
    overrides,
  );

const validFieldRule = (overrides) =>
  Object.assign(
    {
      baseFieldCode: 'apply_date',
      targetFieldCode: 'due_date',
      unit: 'DAYS',
      offsetSource: 'FIELD',
      fixedValue: null,
      offsetFieldCode: 'urgency_days',
    },
    overrides,
  );

const fieldInfoByCode = {
  apply_date: { type: 'DATE' },
  due_date: { type: 'DATE' },
  apply_datetime: { type: 'DATETIME' },
  due_datetime: { type: 'DATETIME' },
  urgency_days: { type: 'NUMBER' },
  urgency_calc_number: { type: 'CALC', format: 'NUMBER' },
  urgency_calc_digit: { type: 'CALC', format: 'NUMBER_DIGIT' },
  urgency_calc_date: { type: 'CALC', format: 'DATE' },
  text_field: { type: 'SINGLE_LINE_TEXT' },
};

describe('ConfigValidation.validateRules', () => {
  test('accepts an empty array', () => {
    expect(ConfigValidation.validateRules([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('rejects a non-array value', () => {
    expect(ConfigValidation.validateRules(null).valid).toBe(false);
  });

  test('accepts a well-formed FIXED rule (structural check only)', () => {
    expect(ConfigValidation.validateRules([validFixedRule()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('accepts a well-formed FIELD rule (structural check only)', () => {
    expect(ConfigValidation.validateRules([validFieldRule()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('requires baseFieldCode', () => {
    expect(
      ConfigValidation.validateRules([validFixedRule({ baseFieldCode: '' })])
        .valid,
    ).toBe(false);
  });

  test('requires targetFieldCode', () => {
    expect(
      ConfigValidation.validateRules([validFixedRule({ targetFieldCode: '' })])
        .valid,
    ).toBe(false);
  });

  test('rejects a target field equal to the base field', () => {
    const result = ConfigValidation.validateRules([
      validFixedRule({ targetFieldCode: 'apply_date' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('基準フィールド'))).toBe(true);
  });

  test('rejects duplicate target field codes across rules', () => {
    const result = ConfigValidation.validateRules([
      validFixedRule({ targetFieldCode: 'due_date' }),
      validFixedRule({ targetFieldCode: 'due_date' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('rejects an unknown unit', () => {
    expect(
      ConfigValidation.validateRules([validFixedRule({ unit: 'HOURS' })]).valid,
    ).toBe(false);
  });

  test('rejects an unknown offsetSource', () => {
    expect(
      ConfigValidation.validateRules([
        validFixedRule({ offsetSource: 'RANDOM' }),
      ]).valid,
    ).toBe(false);
  });

  test('FIXED requires a finite fixedValue', () => {
    expect(
      ConfigValidation.validateRules([validFixedRule({ fixedValue: NaN })])
        .valid,
    ).toBe(false);
    expect(
      ConfigValidation.validateRules([
        validFixedRule({ fixedValue: undefined }),
      ]).valid,
    ).toBe(false);
  });

  test('FIXED allows negative and decimal fixedValue', () => {
    expect(
      ConfigValidation.validateRules([validFixedRule({ fixedValue: -5.5 })])
        .valid,
    ).toBe(true);
  });

  test('FIELD requires offsetFieldCode', () => {
    expect(
      ConfigValidation.validateRules([validFieldRule({ offsetFieldCode: '' })])
        .valid,
    ).toBe(false);
  });

  describe('with fieldInfoByCode (semantic checks)', () => {
    test('accepts a DATE-to-DATE rule with a NUMBER offset field', () => {
      const result = ConfigValidation.validateRules(
        [validFieldRule()],
        fieldInfoByCode,
      );
      expect(result).toEqual({ valid: true, errors: [] });
    });

    test('accepts a numeric-format CALC field as the offset source', () => {
      const result = ConfigValidation.validateRules(
        [validFieldRule({ offsetFieldCode: 'urgency_calc_number' })],
        fieldInfoByCode,
      );
      expect(result.valid).toBe(true);

      const digitResult = ConfigValidation.validateRules(
        [validFieldRule({ offsetFieldCode: 'urgency_calc_digit' })],
        fieldInfoByCode,
      );
      expect(digitResult.valid).toBe(true);
    });

    test('rejects a non-numeric-format CALC field as the offset source', () => {
      const result = ConfigValidation.validateRules(
        [validFieldRule({ offsetFieldCode: 'urgency_calc_date' })],
        fieldInfoByCode,
      );
      expect(result.valid).toBe(false);
    });

    test('rejects a text field as the offset source', () => {
      const result = ConfigValidation.validateRules(
        [validFieldRule({ offsetFieldCode: 'text_field' })],
        fieldInfoByCode,
      );
      expect(result.valid).toBe(false);
    });

    test('rejects a base field that is not DATE/DATETIME', () => {
      const result = ConfigValidation.validateRules(
        [validFixedRule({ baseFieldCode: 'text_field' })],
        fieldInfoByCode,
      );
      expect(result.valid).toBe(false);
    });

    test('rejects a base/target type mismatch', () => {
      const result = ConfigValidation.validateRules(
        [validFixedRule({ targetFieldCode: 'due_datetime' })],
        fieldInfoByCode,
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('型'))).toBe(true);
    });

    test('accepts a DATETIME-to-DATETIME rule with SECONDS unit', () => {
      const result = ConfigValidation.validateRules(
        [
          validFixedRule({
            baseFieldCode: 'apply_datetime',
            targetFieldCode: 'due_datetime',
            unit: 'SECONDS',
          }),
        ],
        fieldInfoByCode,
      );
      expect(result).toEqual({ valid: true, errors: [] });
    });

    test('rejects SECONDS unit on a DATE base field', () => {
      const result = ConfigValidation.validateRules(
        [validFixedRule({ unit: 'SECONDS' })],
        fieldInfoByCode,
      );
      expect(result.valid).toBe(false);
    });

    test('rejects an unknown field code as the base field', () => {
      const result = ConfigValidation.validateRules(
        [validFixedRule({ baseFieldCode: 'missing_field' })],
        fieldInfoByCode,
      );
      expect(result.valid).toBe(false);
    });
  });
});
