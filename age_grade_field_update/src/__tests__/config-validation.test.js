'use strict';

const { validateConfig } = require('../js/lib/config-validation');

describe('validateConfig', () => {
  test('対象フィールド・実行可能グループが両方あれば有効', () => {
    const result = validateConfig({
      targetFieldCode: 'base_date',
      query: '',
      groupCodes: ['g1'],
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('対象フィールド未選択はエラー', () => {
    const result = validateConfig({
      targetFieldCode: '',
      query: '',
      groupCodes: ['g1'],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('対象フィールドを選択してください。');
  });

  test('実行可能グループ0件はエラー', () => {
    const result = validateConfig({
      targetFieldCode: 'base_date',
      query: '',
      groupCodes: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '実行可能グループを1つ以上指定してください。',
    );
  });

  test('両方不正なら両方のエラーを返す', () => {
    const result = validateConfig({
      targetFieldCode: '',
      query: '',
      groupCodes: [],
    });
    expect(result.errors).toHaveLength(2);
  });

  test('configがnull/undefinedでも例外を投げない', () => {
    expect(validateConfig(null).valid).toBe(false);
    expect(validateConfig(undefined).valid).toBe(false);
  });

  test('groupCodesが配列でない場合もエラー扱いにする', () => {
    const result = validateConfig({
      targetFieldCode: 'base_date',
      query: '',
      groupCodes: 'not-an-array',
    });
    expect(result.valid).toBe(false);
  });
});
