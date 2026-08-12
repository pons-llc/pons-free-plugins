const ConfigStore = require('../js/lib/config-store');

describe('load', () => {
  test('未保存(rawConfigが空)なら既定値', () => {
    expect(ConfigStore.load(null)).toEqual({ displayFieldCodes: [] });
    expect(ConfigStore.load({})).toEqual({ displayFieldCodes: [] });
  });

  test('保存済みの値をパースして返す', () => {
    const raw = { displayFieldCodes: JSON.stringify(['title', 'amount']) };
    expect(ConfigStore.load(raw)).toEqual({
      displayFieldCodes: ['title', 'amount'],
    });
  });

  test('壊れたJSONは空配列にフォールバックする', () => {
    const raw = { displayFieldCodes: '{broken' };
    expect(ConfigStore.load(raw)).toEqual({ displayFieldCodes: [] });
  });
});

describe('serialize', () => {
  test('配列をJSON文字列に変換する', () => {
    expect(ConfigStore.serialize({ displayFieldCodes: ['a'] })).toEqual({
      displayFieldCodes: JSON.stringify(['a']),
    });
  });

  test('配列以外が渡されても空配列として扱う', () => {
    expect(ConfigStore.serialize({})).toEqual({ displayFieldCodes: '[]' });
  });
});
