'use strict';

const { validateConfig } = require('../js/lib/config-validation');

describe('validateConfig', () => {
  test('対象フィールド・実行可能グループが両方あれば有効', () => {
    const result = validateConfig({
      targetFieldCodes: ['text1'],
      groupCodes: ['g1'],
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('対象フィールド0件はエラー', () => {
    const result = validateConfig({ targetFieldCodes: [], groupCodes: ['g1'] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '一括更新の対象フィールドを1つ以上指定してください。',
    );
  });

  test('実行可能グループ0件はエラー', () => {
    const result = validateConfig({
      targetFieldCodes: ['text1'],
      groupCodes: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '実行可能グループを1つ以上指定してください。',
    );
  });

  test('両方0件なら両方のエラーを返す', () => {
    const result = validateConfig({ targetFieldCodes: [], groupCodes: [] });
    expect(result.errors).toHaveLength(2);
  });

  test('configがnull/undefinedでも例外を投げない', () => {
    expect(validateConfig(null).valid).toBe(false);
    expect(validateConfig(undefined).valid).toBe(false);
  });
});
