'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore', () => {
  test('未設定(null)なら既定値', () => {
    expect(ConfigStore.load(null)).toEqual({
      fieldCodes: null,
      targetFields: [],
    });
    expect(ConfigStore.isConfigured(ConfigStore.load(null))).toBe(false);
  });

  test('serializeとloadが往復する', () => {
    const config = {
      fieldCodes: { table: 'review_comment_table', comment: 'rr_comment' },
      targetFields: ['氏名', '住所'],
    };
    const raw = ConfigStore.serialize(config);
    expect(typeof raw.fieldCodes).toBe('string');
    expect(typeof raw.targetFields).toBe('string');
    expect(ConfigStore.load(raw)).toEqual(config);
    expect(ConfigStore.isConfigured(ConfigStore.load(raw))).toBe(true);
  });

  test('壊れたJSONは既定値にフォールバックする', () => {
    expect(
      ConfigStore.load({ fieldCodes: '{broken', targetFields: 'x' }),
    ).toEqual({ fieldCodes: null, targetFields: [] });
  });

  test('targetFieldsが配列でなければ空配列', () => {
    expect(
      ConfigStore.load({ targetFields: JSON.stringify({ a: 1 }) }).targetFields,
    ).toEqual([]);
  });
});
