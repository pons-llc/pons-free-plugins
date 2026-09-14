'use strict';

const ConfigValidation = require('../js/lib/config-validation');

const validConfig = () => ({
  defaultView: 'NATIVE',
  defaultNativeState: 'COMMENTS',
  panelWidth: 400,
  targetAppId: '12',
});

describe('ConfigValidation.validateConfig', () => {
  test('正常な設定はvalid:trueを返す', () => {
    expect(ConfigValidation.validateConfig(validConfig())).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('targetAppIdは空文字(未指定=実行時に現在のアプリIDを使う)を許可する', () => {
    const config = { ...validConfig(), targetAppId: '' };
    expect(ConfigValidation.validateConfig(config).valid).toBe(true);
  });

  test('defaultViewが不正な場合はエラー', () => {
    const config = { ...validConfig(), defaultView: 'FOO' };
    const result = ConfigValidation.validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('defaultNativeStateが不正な場合はエラー', () => {
    const config = { ...validConfig(), defaultNativeState: 'FOO' };
    expect(ConfigValidation.validateConfig(config).valid).toBe(false);
  });

  test.each([-1, 0, 100, 3000, NaN, 'abc'])(
    'panelWidthが許容範囲外(%p)の場合はエラー',
    (panelWidth) => {
      const config = { ...validConfig(), panelWidth };
      expect(ConfigValidation.validateConfig(config).valid).toBe(false);
    },
  );

  test.each([240, 400, 900])(
    'panelWidthが許容範囲内(%p)なら valid',
    (panelWidth) => {
      const config = { ...validConfig(), panelWidth };
      expect(ConfigValidation.validateConfig(config).valid).toBe(true);
    },
  );

  test.each(['0', '-1', 'abc', '1.5'])(
    'targetAppIdが正の整数文字列でない場合(%p)はエラー',
    (targetAppId) => {
      const config = { ...validConfig(), targetAppId };
      expect(ConfigValidation.validateConfig(config).valid).toBe(false);
    },
  );
});
