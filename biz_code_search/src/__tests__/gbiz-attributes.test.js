'use strict';

const { ATTRIBUTES, ATTRIBUTE_KEYS } = require('../js/lib/gbiz-attributes');

describe('gbiz-attributes', () => {
  test('ATTRIBUTE_KEYSはATTRIBUTESのkeyと一致する', () => {
    expect(ATTRIBUTE_KEYS).toEqual(ATTRIBUTES.map((a) => a.key));
  });

  test('主要な項目(法人番号詳細取得のスカラー項目)を含む', () => {
    const expectedKeys = [
      'name',
      'kana',
      'name_en',
      'postal_code',
      'location',
      'representative_name',
      'capital_stock',
      'employee_number',
      'founding_year',
      'date_of_establishment',
      'business_summary',
      'company_url',
      'kind',
      'status',
      'update_date',
    ];
    expectedKeys.forEach((key) => {
      expect(ATTRIBUTE_KEYS).toContain(key);
    });
  });

  test('各項目はkeyとlabelを持つ', () => {
    ATTRIBUTES.forEach((attribute) => {
      expect(typeof attribute.key).toBe('string');
      expect(attribute.key.length).toBeGreaterThan(0);
      expect(typeof attribute.label).toBe('string');
      expect(attribute.label.length).toBeGreaterThan(0);
    });
  });

  test('keyに重複がない', () => {
    expect(new Set(ATTRIBUTE_KEYS).size).toBe(ATTRIBUTE_KEYS.length);
  });
});
