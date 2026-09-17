'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('getConfig()がnull/undefinedの場合は既定値(rules: [])を返す', () => {
    expect(ConfigStore.load(null)).toEqual({ rules: [] });
    expect(ConfigStore.load(undefined)).toEqual({ rules: [] });
    expect(ConfigStore.load({})).toEqual({ rules: [] });
  });

  test('保存済みのrules(JSON文字列)を読み込む', () => {
    const rules = [
      {
        fieldCode: 'name',
        forbid: { fullWidthHiragana: true },
      },
    ];
    const saved = { rules: JSON.stringify(rules) };
    expect(ConfigStore.load(saved)).toEqual({ rules });
  });

  test('rulesが不正なJSONの場合は既定値(空配列)にフォールバックする', () => {
    expect(ConfigStore.load({ rules: 'not-json' })).toEqual({ rules: [] });
  });

  test('rulesが配列でないJSONの場合は既定値(空配列)にフォールバックする', () => {
    expect(ConfigStore.load({ rules: '{"a":1}' })).toEqual({ rules: [] });
  });
});

describe('ConfigStore.serialize', () => {
  test('setConfig()用にrulesをJSON文字列化する', () => {
    const rules = [{ fieldCode: 'name', forbid: { halfWidthAlnum: true } }];
    const serialized = ConfigStore.serialize({ rules });
    expect(serialized).toEqual({ rules: JSON.stringify(rules) });
    expect(typeof serialized.rules).toBe('string');
  });
});
