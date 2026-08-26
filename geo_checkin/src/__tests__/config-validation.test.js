'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const NUMBER_FIELDS = {
  lat_field: { type: 'NUMBER' },
  lng_field: { type: 'NUMBER' },
  text_field: { type: 'SINGLE_LINE_TEXT' },
};

describe('ConfigValidation.validateConfig', () => {
  test('緯度・経度フィールドがともに選択されていれば有効', () => {
    const result = ConfigValidation.validateConfig(
      { latitudeFieldCode: 'lat_field', longitudeFieldCode: 'lng_field' },
      NUMBER_FIELDS,
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('緯度フィールド未選択はエラー', () => {
    const result = ConfigValidation.validateConfig(
      { latitudeFieldCode: '', longitudeFieldCode: 'lng_field' },
      NUMBER_FIELDS,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '緯度を保存するフィールドを選択してください。',
    );
  });

  test('経度フィールド未選択はエラー', () => {
    const result = ConfigValidation.validateConfig(
      { latitudeFieldCode: 'lat_field', longitudeFieldCode: '' },
      NUMBER_FIELDS,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '経度を保存するフィールドを選択してください。',
    );
  });

  test('緯度と経度に同じフィールドを選択するとエラー', () => {
    const result = ConfigValidation.validateConfig(
      { latitudeFieldCode: 'lat_field', longitudeFieldCode: 'lat_field' },
      NUMBER_FIELDS,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '緯度フィールドと経度フィールドには異なるフィールドを選択してください。',
    );
  });

  test('数値フィールド以外を選択するとエラー(fieldInfoByCodeを渡した場合のみチェック)', () => {
    const result = ConfigValidation.validateConfig(
      { latitudeFieldCode: 'text_field', longitudeFieldCode: 'lng_field' },
      NUMBER_FIELDS,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '緯度フィールドは数値フィールドのみ選択できます。',
    );
  });

  test('fieldInfoByCodeを省略した場合は型チェックをスキップする', () => {
    const result = ConfigValidation.validateConfig(
      { latitudeFieldCode: 'lat_field', longitudeFieldCode: 'lng_field' },
      undefined,
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });
});
