'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('未保存(null)のときはrules:[]を返す', () => {
    expect(ConfigStore.load(null)).toEqual({ rules: [] });
  });

  test('undefinedのときもrules:[]を返す', () => {
    expect(ConfigStore.load(undefined)).toEqual({ rules: [] });
  });

  test('保存済みのrules JSON文字列をパースして返す', () => {
    const rules = [
      {
        sourceType: 'FIELD',
        fieldCode: 'status',
        triggerValues: ['完了'],
        pattern: 'KUSUDAMA',
        message: '',
      },
    ];
    expect(ConfigStore.load({ rules: JSON.stringify(rules) })).toEqual({
      rules,
    });
  });

  test('不正なJSONのときはrules:[]にフォールバックする', () => {
    expect(ConfigStore.load({ rules: '{not json' })).toEqual({ rules: [] });
  });
});

describe('ConfigStore.serialize', () => {
  test('rulesをJSON文字列化したオブジェクトを返す', () => {
    const config = {
      rules: [{ sourceType: 'STATUS', triggerValues: ['承認済'] }],
    };
    expect(ConfigStore.serialize(config)).toEqual({
      rules: JSON.stringify(config.rules),
    });
  });
});
