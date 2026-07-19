const ConfigStore = require('../js/lib/config-store.js');

describe('load', () => {
  test('未保存(null)の場合は既定値を返す', () => {
    expect(ConfigStore.load(null)).toEqual({
      aiSearchEnabled: false,
      syncGroupCodes: [],
    });
  });

  test('保存済みの値を復元する', () => {
    const saved = {
      aiSearchEnabled: 'true',
      syncGroupCodes: JSON.stringify(['admins', 'plugin_managers']),
    };
    expect(ConfigStore.load(saved)).toEqual({
      aiSearchEnabled: true,
      syncGroupCodes: ['admins', 'plugin_managers'],
    });
  });

  test('syncGroupCodesが壊れたJSONの場合は既定値(空配列)にフォールバックする', () => {
    const saved = { aiSearchEnabled: 'false', syncGroupCodes: '{not json' };
    expect(ConfigStore.load(saved).syncGroupCodes).toEqual([]);
  });
});

describe('serialize', () => {
  test('setConfig()に渡す文字列のみのオブジェクトを組み立てる', () => {
    const serialized = ConfigStore.serialize({
      aiSearchEnabled: true,
      syncGroupCodes: ['admins'],
    });
    expect(serialized).toEqual({
      aiSearchEnabled: 'true',
      syncGroupCodes: '["admins"]',
    });
  });

  test('syncGroupCodes省略時は空配列としてシリアライズする', () => {
    const serialized = ConfigStore.serialize({ aiSearchEnabled: false });
    expect(serialized.syncGroupCodes).toBe('[]');
  });
});
