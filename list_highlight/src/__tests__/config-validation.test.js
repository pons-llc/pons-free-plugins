'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validRule = (overrides) =>
  Object.assign(
    {
      condition: {
        conditionOperator: 'AND',
        children: [{ fieldCode: 'status', operator: 'EQ', value: '対応中' }],
      },
      backgroundColor: '#ff0000',
    },
    overrides,
  );

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

  test('accepts a well-formed rule', () => {
    expect(ConfigValidation.validateRules([validRule()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('requires at least one condition clause', () => {
    const result = ConfigValidation.validateRules([
      validRule({ condition: { conditionOperator: 'AND', children: [] } }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires a fieldCode on each clause', () => {
    const result = ConfigValidation.validateRules([
      validRule({
        condition: {
          conditionOperator: 'AND',
          children: [{ fieldCode: '', operator: 'EQ', value: 'x' }],
        },
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects an unknown operator', () => {
    const result = ConfigValidation.validateRules([
      validRule({
        condition: {
          conditionOperator: 'AND',
          children: [
            { fieldCode: 'status', operator: 'SOMETHING', value: 'x' },
          ],
        },
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires a valid 6-digit hex color', () => {
    expect(
      ConfigValidation.validateRules([validRule({ backgroundColor: '' })])
        .valid,
    ).toBe(false);
    expect(
      ConfigValidation.validateRules([validRule({ backgroundColor: 'red' })])
        .valid,
    ).toBe(false);
    expect(
      ConfigValidation.validateRules([validRule({ backgroundColor: '#fff' })])
        .valid,
    ).toBe(false);
  });

  test('accepts uppercase hex colors', () => {
    const result = ConfigValidation.validateRules([
      validRule({ backgroundColor: '#FF00AA' }),
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });
});
