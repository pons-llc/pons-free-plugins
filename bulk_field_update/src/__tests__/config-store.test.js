'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('未保存(rawConfigがfalsy)の場合はデフォルト値を返す', () => {
    expect(ConfigStore.load(null)).toEqual({
      targetFieldCodes: [],
      groupCodes: [],
    });
    expect(ConfigStore.load(undefined)).toEqual({
      targetFieldCodes: [],
      groupCodes: [],
    });
  });

  test('保存済みの値を読み込む', () => {
    const raw = {
      targetFieldCodes: JSON.stringify(['text1', 'check1']),
      groupCodes: JSON.stringify(['g1', 'g2']),
    };
    expect(ConfigStore.load(raw)).toEqual({
      targetFieldCodes: ['text1', 'check1'],
      groupCodes: ['g1', 'g2'],
    });
  });

  test('壊れたJSONの場合は空配列にフォールバックする', () => {
    const raw = { targetFieldCodes: '{invalid', groupCodes: '{invalid' };
    expect(ConfigStore.load(raw)).toEqual({
      targetFieldCodes: [],
      groupCodes: [],
    });
  });

  test('配列以外にparseされた場合は空配列にフォールバックする', () => {
    const raw = {
      targetFieldCodes: JSON.stringify({ a: 1 }),
      groupCodes: JSON.stringify('not-array'),
    };
    expect(ConfigStore.load(raw)).toEqual({
      targetFieldCodes: [],
      groupCodes: [],
    });
  });
});

describe('ConfigStore.serialize', () => {
  test('文字列ペイロードに変換する', () => {
    const config = { targetFieldCodes: ['text1'], groupCodes: ['g1'] };
    expect(ConfigStore.serialize(config)).toEqual({
      targetFieldCodes: JSON.stringify(['text1']),
      groupCodes: JSON.stringify(['g1']),
    });
  });

  test('未指定/配列以外の場合は空配列としてシリアライズする', () => {
    expect(ConfigStore.serialize({})).toEqual({
      targetFieldCodes: JSON.stringify([]),
      groupCodes: JSON.stringify([]),
    });
  });
});
