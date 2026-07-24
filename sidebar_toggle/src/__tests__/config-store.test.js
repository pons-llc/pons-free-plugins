'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('savedがnull(未設定のアプリ)の場合、既定値の空配列を返す', () => {
    expect(ConfigStore.load(null)).toEqual({ rules: [] });
  });

  test('savedがundefinedの場合も既定値を返す', () => {
    expect(ConfigStore.load(undefined)).toEqual({ rules: [] });
  });

  test('保存済みのrules JSON文字列をパースする', () => {
    const saved = {
      rules: JSON.stringify([
        {
          mode: 'ALWAYS',
          action: 'CLOSED',
        },
      ]),
    };
    const config = ConfigStore.load(saved);
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0].mode).toBe('ALWAYS');
  });

  test('保存済みJSONが壊れている場合は既定値にフォールバックする', () => {
    expect(ConfigStore.load({ rules: '{not valid json' })).toEqual({
      rules: [],
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('rules配列をJSON文字列のペイロードにする', () => {
    const config = {
      rules: [{ mode: 'ALWAYS', action: 'CLOSED' }],
    };
    const payload = ConfigStore.serialize(config);
    expect(typeof payload.rules).toBe('string');
    expect(JSON.parse(payload.rules)).toEqual(config.rules);
  });
});
