'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validRow = () => ({
  sourceFieldCode: 'datetime_field',
  bandWidthMinutes: 60,
});

describe('ConfigValidation.validateRows', () => {
  test('配列でなければ即エラー', () => {
    const result = ConfigValidation.validateRows(null);
    expect(result.valid).toBe(false);
  });

  test('空配列はエラー(設定行が1件も無い)', () => {
    const result = ConfigValidation.validateRows([]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('設定行'))).toBe(true);
  });

  test('妥当な1行は有効', () => {
    expect(ConfigValidation.validateRows([validRow()]).valid).toBe(true);
  });

  test('変換元フィールド未選択はエラー', () => {
    const row = { ...validRow(), sourceFieldCode: '' };
    const result = ConfigValidation.validateRows([row]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('変換元フィールド'))).toBe(
      true,
    );
  });

  test('区切り幅が不正な値ならエラー', () => {
    const row = { ...validRow(), bandWidthMinutes: 45 };
    const result = ConfigValidation.validateRows([row]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('区切り幅'))).toBe(true);
  });

  test('同じ変換元フィールドが複数行で重複していればエラー', () => {
    const rowA = validRow();
    const rowB = validRow();
    const result = ConfigValidation.validateRows([rowA, rowB]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });

  test('fieldInfoByCodeを渡すと変換元フィールドの型を検証する(DATETIME/TIME以外はエラー)', () => {
    const row = validRow();
    const fieldInfoByCode = { datetime_field: { type: 'SINGLE_LINE_TEXT' } };
    const result = ConfigValidation.validateRows([row], fieldInfoByCode);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('日時または時刻'))).toBe(true);
  });

  test('fieldInfoByCodeがDATETIME型なら有効', () => {
    const row = validRow();
    const fieldInfoByCode = { datetime_field: { type: 'DATETIME' } };
    expect(ConfigValidation.validateRows([row], fieldInfoByCode).valid).toBe(
      true,
    );
  });

  test('fieldInfoByCodeがTIME型なら有効', () => {
    const row = validRow();
    const fieldInfoByCode = { datetime_field: { type: 'TIME' } };
    expect(ConfigValidation.validateRows([row], fieldInfoByCode).valid).toBe(
      true,
    );
  });
});

describe('ConfigValidation.validateTrigger', () => {
  test('CHANGE/SUBMITのみ有効', () => {
    expect(ConfigValidation.validateTrigger('CHANGE')).toBe(true);
    expect(ConfigValidation.validateTrigger('SUBMIT')).toBe(true);
    expect(ConfigValidation.validateTrigger('OTHER')).toBe(false);
  });
});

describe('ConfigValidation.validateBulkGroupCodes', () => {
  test('一括実行が無効なら常に有効', () => {
    expect(ConfigValidation.validateBulkGroupCodes(false, []).valid).toBe(true);
  });

  test('一括実行が有効でグループコード0件はエラー', () => {
    const result = ConfigValidation.validateBulkGroupCodes(true, []);
    expect(result.valid).toBe(false);
  });

  test('一括実行が有効でグループコード1件以上なら有効', () => {
    expect(
      ConfigValidation.validateBulkGroupCodes(true, ['group_a']).valid,
    ).toBe(true);
  });
});
