'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('getConfig()がnull/undefinedの場合は既定値を返す', () => {
    expect(ConfigStore.load(null)).toEqual(ConfigStore.DEFAULTS);
    expect(ConfigStore.load(undefined)).toEqual(ConfigStore.DEFAULTS);
    expect(ConfigStore.load({})).toEqual(ConfigStore.DEFAULTS);
  });

  test('保存済みの値を読み込む', () => {
    const saved = {
      defaultView: 'IFRAME',
      defaultNativeState: 'HISTORY',
      panelWidth: '500',
      targetAppId: '12',
    };
    expect(ConfigStore.load(saved)).toEqual({
      defaultView: 'IFRAME',
      defaultNativeState: 'HISTORY',
      panelWidth: 500,
      targetAppId: '12',
    });
  });

  test('panelWidthが数値化できない場合は既定値にフォールバックする', () => {
    const saved = { panelWidth: 'not-a-number' };
    expect(ConfigStore.load(saved).panelWidth).toBe(
      ConfigStore.DEFAULTS.panelWidth,
    );
  });
});

describe('ConfigStore.serialize', () => {
  test('setConfig()用に全て文字列化する', () => {
    const serialized = ConfigStore.serialize({
      defaultView: 'NATIVE',
      defaultNativeState: 'COMMENTS',
      panelWidth: 400,
      targetAppId: '5',
    });
    expect(serialized).toEqual({
      defaultView: 'NATIVE',
      defaultNativeState: 'COMMENTS',
      panelWidth: '400',
      targetAppId: '5',
    });
    Object.values(serialized).forEach((v) => expect(typeof v).toBe('string'));
  });
});
