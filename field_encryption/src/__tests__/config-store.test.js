'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore', () => {
  test('load()はnull/undefinedでも既定値を返す', () => {
    expect(ConfigStore.load(null)).toEqual({
      targetFields: [],
      spaceElementId: '',
      minPassphraseLength: 8,
    });
    expect(ConfigStore.load(undefined)).toEqual({
      targetFields: [],
      spaceElementId: '',
      minPassphraseLength: 8,
    });
  });

  test('load()は保存済みJSON文字列・数値文字列をパースする', () => {
    const loaded = ConfigStore.load({
      targetFields: JSON.stringify(['secret_1', 'secret_2']),
      spaceElementId: 'fe_space',
      minPassphraseLength: '12',
    });
    expect(loaded).toEqual({
      targetFields: ['secret_1', 'secret_2'],
      spaceElementId: 'fe_space',
      minPassphraseLength: 12,
    });
  });

  test('load()は壊れたJSONを既定値にフォールバックする', () => {
    const loaded = ConfigStore.load({ targetFields: '{invalid' });
    expect(loaded.targetFields).toEqual([]);
  });

  test('load()はminPassphraseLengthが数値でなければ既定値にフォールバックする', () => {
    const loaded = ConfigStore.load({ minPassphraseLength: 'abc' });
    expect(loaded.minPassphraseLength).toBe(8);
  });

  test('serialize()はsetConfig()にそのまま渡せる文字列のみのペイロードを返す', () => {
    const config = {
      targetFields: ['secret_1'],
      spaceElementId: 'fe_space',
      minPassphraseLength: 10,
    };
    expect(ConfigStore.serialize(config)).toEqual({
      targetFields: JSON.stringify(['secret_1']),
      spaceElementId: 'fe_space',
      minPassphraseLength: '10',
    });
  });
});
