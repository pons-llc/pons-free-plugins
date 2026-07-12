const ConfigStore = require('../js/lib/config-store');

describe('load', () => {
  test('未保存(null)の場合はデフォルト値(空のbuttons)を返す', () => {
    expect(ConfigStore.load(null)).toEqual({ buttons: [] });
  });

  test('undefinedの場合もデフォルト値を返す', () => {
    expect(ConfigStore.load(undefined)).toEqual({ buttons: [] });
  });

  test('保存済みのbuttons(JSON文字列)をパースして返す', () => {
    const buttons = [{ label: 'ボタン1', title: '', items: [] }];
    expect(ConfigStore.load({ buttons: JSON.stringify(buttons) })).toEqual({
      buttons,
    });
  });

  test('壊れたJSON文字列の場合はデフォルト値にフォールバックする', () => {
    expect(ConfigStore.load({ buttons: '{invalid' })).toEqual({
      buttons: [],
    });
  });
});

describe('serialize', () => {
  test('configをkintone.plugin.app.setConfig()用のペイロード(文字列)に変換する', () => {
    const buttons = [{ label: 'ボタン1', title: '', items: [] }];
    expect(ConfigStore.serialize({ buttons })).toEqual({
      buttons: JSON.stringify(buttons),
    });
  });
});
