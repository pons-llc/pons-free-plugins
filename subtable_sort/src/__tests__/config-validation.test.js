'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validRule = (overrides) =>
  Object.assign(
    {
      subtableFieldCode: 'history',
      sortKeys: [{ columnCode: 'date', order: 'ASC', valueType: 'STRING' }],
      triggerMode: 'SUBMIT',
      sortedFlagFieldCode: '',
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

  test('accepts a well-formed SUBMIT rule', () => {
    expect(ConfigValidation.validateRules([validRule()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('accepts a well-formed MANUAL rule with a sortedFlagFieldCode', () => {
    const result = ConfigValidation.validateRules([
      validRule({ triggerMode: 'MANUAL', sortedFlagFieldCode: 'sort_status' }),
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('requires subtableFieldCode', () => {
    const result = ConfigValidation.validateRules([
      validRule({ subtableFieldCode: '' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects an unknown triggerMode', () => {
    const result = ConfigValidation.validateRules([
      validRule({ triggerMode: 'SOMETHING' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires at least one sort key', () => {
    const result = ConfigValidation.validateRules([
      validRule({ sortKeys: [] }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires a columnCode on each sort key', () => {
    const result = ConfigValidation.validateRules([
      validRule({
        sortKeys: [{ columnCode: '', order: 'ASC', valueType: 'STRING' }],
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('rejects an unknown order or valueType on a sort key', () => {
    expect(
      ConfigValidation.validateRules([
        validRule({
          sortKeys: [
            { columnCode: 'date', order: 'SOMETHING', valueType: 'STRING' },
          ],
        }),
      ]).valid,
    ).toBe(false);
    expect(
      ConfigValidation.validateRules([
        validRule({
          sortKeys: [
            { columnCode: 'date', order: 'ASC', valueType: 'SOMETHING' },
          ],
        }),
      ]).valid,
    ).toBe(false);
  });

  test('MANUAL mode does not require sortedFlagFieldCode', () => {
    const result = ConfigValidation.validateRules([
      validRule({ triggerMode: 'MANUAL', sortedFlagFieldCode: '' }),
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });
});
