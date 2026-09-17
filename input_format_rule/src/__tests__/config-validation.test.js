'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const makeRule = (overrides) => ({
  fieldCode: 'name',
  forbid: { halfWidthAlnum: true },
  ...overrides,
});

describe('ConfigValidation.validateRules', () => {
  test('正常なルールはvalid:trueを返す', () => {
    expect(ConfigValidation.validateRules([makeRule()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('rulesが配列でない場合はエラー', () => {
    const result = ConfigValidation.validateRules(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('ルールが0件でもvalid:true(何もチェックしないだけ)', () => {
    expect(ConfigValidation.validateRules([])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('対象フィールドが未選択の場合はエラー', () => {
    const result = ConfigValidation.validateRules([
      makeRule({ fieldCode: '' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('1件目');
  });

  test('禁止する文字種が1つも選ばれていない場合はエラー', () => {
    const result = ConfigValidation.validateRules([makeRule({ forbid: {} })]);
    expect(result.valid).toBe(false);
  });

  test('forbidの値が全てfalseの場合もエラー', () => {
    const result = ConfigValidation.validateRules([
      makeRule({
        forbid: {
          fullWidthHiragana: false,
          fullWidthKatakana: false,
          halfWidthKatakana: false,
          fullWidthAlnum: false,
          halfWidthAlnum: false,
          fullWidthSymbol: false,
          halfWidthSymbol: false,
        },
      }),
    ]);
    expect(result.valid).toBe(false);
  });

  test('同じフィールドに複数のルールが設定されている場合はエラー', () => {
    const result = ConfigValidation.validateRules([
      makeRule({ fieldCode: 'dup' }),
      makeRule({ fieldCode: 'dup' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('複数の不正が同時にあれば複数件エラーを返す', () => {
    const result = ConfigValidation.validateRules([
      makeRule({ fieldCode: '' }),
      makeRule({ forbid: {} }),
    ]);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
