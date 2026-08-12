'use strict';

const { validateConfig } = require('../js/lib/config-validation');

describe('validateConfig', () => {
  test('テンプレート対象フィールド・実行可能グループが両方あれば有効(対象者/日付は任意)', () => {
    const result = validateConfig({
      assigneeFieldCode: '',
      dateFieldCode: '',
      templateFieldCodes: ['title'],
      groupCodes: ['g1'],
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('テンプレート対象フィールド0件はエラー', () => {
    const result = validateConfig({
      templateFieldCodes: [],
      groupCodes: ['g1'],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'テンプレート対象フィールドを1つ以上指定してください。',
    );
  });

  test('実行可能グループ0件はエラー', () => {
    const result = validateConfig({
      templateFieldCodes: ['title'],
      groupCodes: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '実行可能グループを1つ以上指定してください。',
    );
  });

  test('両方0件なら両方のエラーを返す', () => {
    const result = validateConfig({ templateFieldCodes: [], groupCodes: [] });
    expect(result.errors).toHaveLength(2);
  });

  test('configがnull/undefinedでも例外を投げない', () => {
    expect(validateConfig(null).valid).toBe(false);
    expect(validateConfig(undefined).valid).toBe(false);
  });
});
