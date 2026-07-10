'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validRule = (overrides) =>
  Object.assign(
    {
      triggerEvent: 'EDIT_SUBMIT',
      title: '確認',
      body: '保存しますか?',
      okButtonText: '',
      cancelButtonText: '',
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

  test('rejects an unknown triggerEvent', () => {
    const result = ConfigValidation.validateRules([
      validRule({ triggerEvent: 'SOMETHING' }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('requires a non-empty body', () => {
    const result = ConfigValidation.validateRules([validRule({ body: '' })]);
    expect(result.valid).toBe(false);
  });

  test('does not require title/okButtonText/cancelButtonText', () => {
    const result = ConfigValidation.validateRules([
      validRule({ title: '', okButtonText: '', cancelButtonText: '' }),
    ]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('accepts each of the four known trigger events', () => {
    [
      'CREATE_SUBMIT',
      'EDIT_SUBMIT',
      'INDEX_DELETE_SUBMIT',
      'PROCESS_PROCEED',
    ].forEach((triggerEvent) => {
      const result = ConfigValidation.validateRules([
        validRule({ triggerEvent }),
      ]);
      expect(result.valid).toBe(true);
    });
  });
});
