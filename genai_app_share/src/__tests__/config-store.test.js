'use strict';

const { load, serialize, DEFAULTS } = require('../js/lib/config-store');

describe('ConfigStore.load', () => {
  test('未保存(null/undefined)の場合は既定値を返す', () => {
    expect(load(undefined)).toEqual(DEFAULTS);
    expect(load(null)).toEqual(DEFAULTS);
  });

  test('保存済みの値をそのまま復元する', () => {
    const raw = {
      htmlFieldCode: 'html_field',
      cssFieldCode: 'css_field',
      jsFieldCode: 'js_field',
      executionMode: 'data',
      enableReact: 'true',
    };
    expect(load(raw)).toEqual({
      htmlFieldCode: 'html_field',
      cssFieldCode: 'css_field',
      jsFieldCode: 'js_field',
      executionMode: 'data',
      enableReact: true,
    });
  });

  test('一部のキーが欠けている場合は既定値で補う', () => {
    expect(load({ htmlFieldCode: 'html_field' })).toEqual({
      htmlFieldCode: 'html_field',
      cssFieldCode: '',
      jsFieldCode: '',
      executionMode: 'blob',
      enableReact: false,
    });
  });

  test('executionModeが不正な値の場合は既定値(blob)にフォールバックする', () => {
    expect(load({ executionMode: 'invalid' }).executionMode).toBe('blob');
  });

  test("enableReactは文字列'true'のときだけtrueになる", () => {
    expect(load({ enableReact: 'true' }).enableReact).toBe(true);
    expect(load({ enableReact: 'false' }).enableReact).toBe(false);
    expect(load({ enableReact: undefined }).enableReact).toBe(false);
  });
});

describe('ConfigStore.serialize', () => {
  test('setConfig()へ渡す形(文字列のみ)へ変換する', () => {
    expect(
      serialize({
        htmlFieldCode: 'h',
        cssFieldCode: '',
        jsFieldCode: 'j',
        executionMode: 'data',
        enableReact: true,
      }),
    ).toEqual({
      htmlFieldCode: 'h',
      cssFieldCode: '',
      jsFieldCode: 'j',
      executionMode: 'data',
      enableReact: 'true',
    });
  });

  test('executionModeが不正な値・enableReactが偽値の場合は既定値へフォールバックして文字列化する', () => {
    expect(
      serialize({
        htmlFieldCode: 'h',
        cssFieldCode: '',
        jsFieldCode: '',
        executionMode: 'invalid',
        enableReact: false,
      }),
    ).toEqual({
      htmlFieldCode: 'h',
      cssFieldCode: '',
      jsFieldCode: '',
      executionMode: 'blob',
      enableReact: 'false',
    });
  });
});
