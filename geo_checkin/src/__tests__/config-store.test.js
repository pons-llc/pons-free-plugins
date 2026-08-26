'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('未保存(null)の場合は既定値を返す', () => {
    expect(ConfigStore.load(null)).toEqual({
      latitudeFieldCode: '',
      longitudeFieldCode: '',
      showMap: false,
    });
  });

  test('未保存(undefined)の場合も既定値を返す', () => {
    expect(ConfigStore.load(undefined)).toEqual({
      latitudeFieldCode: '',
      longitudeFieldCode: '',
      showMap: false,
    });
  });

  test('保存済みの値を復元する', () => {
    expect(
      ConfigStore.load({
        latitudeFieldCode: 'lat_field',
        longitudeFieldCode: 'lng_field',
        showMap: 'true',
      }),
    ).toEqual({
      latitudeFieldCode: 'lat_field',
      longitudeFieldCode: 'lng_field',
      showMap: true,
    });
  });

  test('showMapが"true"以外の文字列(未保存時の"false"等)はfalseになる', () => {
    expect(
      ConfigStore.load({
        latitudeFieldCode: 'lat_field',
        longitudeFieldCode: 'lng_field',
        showMap: 'false',
      }).showMap,
    ).toBe(false);
  });
});

describe('ConfigStore.serialize', () => {
  test('setConfig()に渡すペイロード(値はすべて文字列)へ変換する', () => {
    expect(
      ConfigStore.serialize({
        latitudeFieldCode: 'lat_field',
        longitudeFieldCode: 'lng_field',
        showMap: true,
      }),
    ).toEqual({
      latitudeFieldCode: 'lat_field',
      longitudeFieldCode: 'lng_field',
      showMap: 'true',
    });
  });

  test('showMap: falseはserializeすると文字列"false"になる', () => {
    expect(
      ConfigStore.serialize({
        latitudeFieldCode: '',
        longitudeFieldCode: '',
        showMap: false,
      }).showMap,
    ).toBe('false');
  });
});
