'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('未保存(rawConfigがfalsy)の場合はデフォルト値を返す', () => {
    expect(ConfigStore.load(null)).toEqual({
      targetFieldCode: '',
      query: '',
      groupCodes: [],
    });
    expect(ConfigStore.load(undefined)).toEqual({
      targetFieldCode: '',
      query: '',
      groupCodes: [],
    });
  });

  test('保存済みの値を読み込む', () => {
    const raw = {
      targetFieldCode: 'base_date',
      query: 'status = "active"',
      groupCodes: JSON.stringify(['g1', 'g2']),
    };
    expect(ConfigStore.load(raw)).toEqual({
      targetFieldCode: 'base_date',
      query: 'status = "active"',
      groupCodes: ['g1', 'g2'],
    });
  });

  test('groupCodesが壊れたJSONの場合は空配列にフォールバックする', () => {
    const raw = {
      targetFieldCode: 'base_date',
      query: '',
      groupCodes: '{invalid',
    };
    expect(ConfigStore.load(raw).groupCodes).toEqual([]);
  });

  test('groupCodesが配列以外にparseされた場合は空配列にフォールバックする', () => {
    const raw = {
      targetFieldCode: 'base_date',
      query: '',
      groupCodes: JSON.stringify({ a: 1 }),
    };
    expect(ConfigStore.load(raw).groupCodes).toEqual([]);
  });

  test('groupCodesが未指定の場合は空配列になる', () => {
    const raw = { targetFieldCode: 'base_date', query: '' };
    expect(ConfigStore.load(raw).groupCodes).toEqual([]);
  });
});

describe('ConfigStore.serialize', () => {
  test('文字列ペイロードに変換する', () => {
    const config = {
      targetFieldCode: 'base_date',
      query: 'q',
      groupCodes: ['g1'],
    };
    expect(ConfigStore.serialize(config)).toEqual({
      targetFieldCode: 'base_date',
      query: 'q',
      groupCodes: JSON.stringify(['g1']),
    });
  });

  test('groupCodesが未指定/配列以外の場合は空配列としてシリアライズする', () => {
    expect(ConfigStore.serialize({}).groupCodes).toBe(JSON.stringify([]));
  });
});
