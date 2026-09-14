const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore', () => {
  test('load()はnull/undefinedを渡すとデフォルト値(空のrules)を返す', () => {
    expect(ConfigStore.load(null)).toEqual({ rules: [] });
    expect(ConfigStore.load(undefined)).toEqual({ rules: [] });
  });

  test('load()は保存済みのJSON文字列をパースする', () => {
    const rules = [
      { targetFieldCode: 'text_0', operation: 'CLEAR', filter: {} },
    ];
    const result = ConfigStore.load({ rules: JSON.stringify(rules) });
    expect(result.rules).toEqual(rules);
  });

  test('load()は不正なJSONの場合デフォルト値にフォールバックする', () => {
    const result = ConfigStore.load({ rules: '{invalid json' });
    expect(result.rules).toEqual([]);
  });

  test('serialize()はrulesをJSON文字列化する', () => {
    const config = {
      rules: [{ targetFieldCode: 'text_0', operation: 'CLEAR', filter: {} }],
    };
    const serialized = ConfigStore.serialize(config);
    expect(serialized.rules).toBe(JSON.stringify(config.rules));
  });

  test('load()とserialize()は往復可能(round-trip)', () => {
    const original = {
      rules: [
        {
          filter: {
            actionNames: ['承認する'],
            fromStatuses: [],
            toStatuses: ['承認済'],
          },
          targetFieldCode: 'date_0',
          operation: 'SET',
          source: { type: 'NOW_OFFSET', unit: 'DAYS', magnitude: 7 },
        },
      ],
    };
    const roundTripped = ConfigStore.load(ConfigStore.serialize(original));
    expect(roundTripped).toEqual(original);
  });
});
