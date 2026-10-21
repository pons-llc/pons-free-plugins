const ConfigStore = require('../js/lib/config-store.js');

describe('load', () => {
  test('未設定なら既定値(完了)', () => {
    expect(ConfigStore.load(null)).toEqual({ completeStatus: '完了' });
    expect(ConfigStore.load({})).toEqual({ completeStatus: '完了' });
  });

  test('保存値を読む', () => {
    expect(ConfigStore.load({ completeStatus: '反映済み' })).toEqual({
      completeStatus: '反映済み',
    });
  });
});

describe('validate / serialize', () => {
  test('空・64文字超はエラー', () => {
    expect(ConfigStore.validate({ completeStatus: ' ' }).length).toBe(1);
    expect(
      ConfigStore.validate({ completeStatus: 'あ'.repeat(65) }).length,
    ).toBe(1);
    expect(ConfigStore.validate({ completeStatus: '完了' })).toEqual([]);
  });

  test('前後の空白を除いて保存する', () => {
    expect(ConfigStore.serialize({ completeStatus: ' 完了 ' })).toEqual({
      completeStatus: '完了',
    });
  });
});
