'use strict';

const { validateRules } = require('../js/lib/config-validation');

const validFieldRule = () => ({
  sourceType: 'FIELD',
  fieldCode: 'status',
  triggerValues: ['完了'],
  pattern: 'KUSUDAMA',
  message: '',
});

const validStatusRule = () => ({
  sourceType: 'STATUS',
  fieldCode: '',
  triggerValues: ['承認済'],
  pattern: 'RANDOM',
  message: '達成しました!',
});

describe('validateRules', () => {
  test('正しいFIELDルールは valid: true', () => {
    expect(validateRules([validFieldRule()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('正しいSTATUSルールは valid: true', () => {
    expect(validateRules([validStatusRule()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('複数の正しいルールは valid: true', () => {
    expect(validateRules([validFieldRule(), validStatusRule()])).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('配列でないときは invalid', () => {
    const result = validateRules(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
  });

  test('空配列(ルール0件)は invalid', () => {
    const result = validateRules([]);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['お祝いルールが1つも設定されていません。']);
  });

  test('対象種別が不正なときは invalid', () => {
    const rule = { ...validFieldRule(), sourceType: 'INVALID' };
    const result = validateRules([rule]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/対象種別/);
  });

  test('FIELDで対象フィールド未選択のときは invalid', () => {
    const rule = { ...validFieldRule(), fieldCode: '' };
    const result = validateRules([rule]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/対象フィールド/);
  });

  test('STATUSでは対象フィールド未選択でも valid', () => {
    const rule = { ...validStatusRule(), fieldCode: '' };
    expect(validateRules([rule]).valid).toBe(true);
  });

  test('お祝い対象の値が0件のときは invalid', () => {
    const rule = { ...validFieldRule(), triggerValues: [] };
    const result = validateRules([rule]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/お祝い対象の値/);
  });

  test('お祝い対象の値に空文字が混ざるときは invalid', () => {
    const rule = { ...validFieldRule(), triggerValues: ['完了', ''] };
    const result = validateRules([rule]);
    expect(result.valid).toBe(false);
  });

  test('演出パターンが不正なときは invalid', () => {
    const rule = { ...validFieldRule(), pattern: 'FIREWORKS' };
    const result = validateRules([rule]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/演出パターン/);
  });

  test('複数のルールでそれぞれのエラーが集約される', () => {
    const result = validateRules([
      { ...validFieldRule(), fieldCode: '' },
      { ...validFieldRule(), triggerValues: [] },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0]).toMatch(/^1件目/);
    expect(result.errors[1]).toMatch(/^2件目/);
  });
});
