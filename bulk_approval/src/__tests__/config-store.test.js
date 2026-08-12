const ConfigStore = require('../js/lib/config-store');

describe('load', () => {
  test('未保存(rawConfigが空)なら既定値', () => {
    expect(ConfigStore.load(null)).toEqual({
      displayFieldCodes: [],
      groupCodes: [],
    });
    expect(ConfigStore.load({})).toEqual({
      displayFieldCodes: [],
      groupCodes: [],
    });
  });

  test('保存済みの値をパースして返す', () => {
    const raw = {
      displayFieldCodes: JSON.stringify(['title', 'amount']),
      groupCodes: JSON.stringify(['managers']),
    };
    expect(ConfigStore.load(raw)).toEqual({
      displayFieldCodes: ['title', 'amount'],
      groupCodes: ['managers'],
    });
  });

  test('壊れたJSONは空配列にフォールバックする', () => {
    const raw = { displayFieldCodes: '{broken', groupCodes: '[]' };
    expect(ConfigStore.load(raw)).toEqual({
      displayFieldCodes: [],
      groupCodes: [],
    });
  });
});

describe('serialize', () => {
  test('配列をJSON文字列に変換する', () => {
    expect(
      ConfigStore.serialize({
        displayFieldCodes: ['a'],
        groupCodes: ['g1', 'g2'],
      }),
    ).toEqual({
      displayFieldCodes: JSON.stringify(['a']),
      groupCodes: JSON.stringify(['g1', 'g2']),
    });
  });

  test('配列以外が渡されても空配列として扱う', () => {
    expect(ConfigStore.serialize({})).toEqual({
      displayFieldCodes: '[]',
      groupCodes: '[]',
    });
  });
});
