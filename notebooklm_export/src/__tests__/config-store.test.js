'use strict';

const { load, toRawConfig } = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('未設定(初回)は既定値txtになる', () => {
    expect(load(undefined)).toEqual({ outputFormat: 'txt' });
    expect(load({})).toEqual({ outputFormat: 'txt' });
  });

  test('保存済みのmdはそのまま復元する', () => {
    expect(load({ outputFormat: 'md' })).toEqual({ outputFormat: 'md' });
  });

  test('不正な値はtxtにフォールバックする', () => {
    expect(load({ outputFormat: 'invalid' })).toEqual({ outputFormat: 'txt' });
  });
});

describe('ConfigStore.toRawConfig', () => {
  test('mdはそのまま保存する', () => {
    expect(toRawConfig({ outputFormat: 'md' })).toEqual({ outputFormat: 'md' });
  });

  test('txt/不正値/未指定はtxtとして保存する', () => {
    expect(toRawConfig({ outputFormat: 'txt' })).toEqual({
      outputFormat: 'txt',
    });
    expect(toRawConfig({})).toEqual({ outputFormat: 'txt' });
  });
});
