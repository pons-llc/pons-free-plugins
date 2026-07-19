'use strict';

const ConfigStore = require('../js/lib/config-store');

describe('load', () => {
  test('未保存(null)ならデフォルト値', () => {
    expect(ConfigStore.load(null)).toEqual(ConfigStore.DEFAULTS);
    expect(ConfigStore.load(undefined)).toEqual(ConfigStore.DEFAULTS);
  });

  test('保存値がデフォルトを上書きする', () => {
    const loaded = ConfigStore.load({
      role: 'answer',
      requestAppId: '202',
      listViewName: '一覧A',
    });
    expect(loaded.role).toBe('answer');
    expect(loaded.requestAppId).toBe('202');
    expect(loaded.listViewName).toBe('一覧A');
    expect(loaded.formSpaceId).toBe('form_space');
  });
});

describe('serialize', () => {
  test('全キーが文字列で出力され、アプリIDはトリムされる', () => {
    const out = ConfigStore.serialize({
      role: 'request',
      answerAppId: ' 203 ',
    });
    expect(out.role).toBe('request');
    expect(out.answerAppId).toBe('203');
    expect(out.previewSpaceId).toBe('preview');
    Object.values(out).forEach((v) => expect(typeof v).toBe('string'));
  });
});

describe('validate', () => {
  test('役割未選択はエラー', () => {
    const result = ConfigStore.validate(ConfigStore.load(null));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('役割');
  });

  test('依頼アプリは回答アプリIDが数値必須', () => {
    const base = { ...ConfigStore.load(null), role: 'request' };
    expect(ConfigStore.validate({ ...base, answerAppId: '' }).valid).toBe(
      false,
    );
    expect(ConfigStore.validate({ ...base, answerAppId: 'abc' }).valid).toBe(
      false,
    );
    expect(ConfigStore.validate({ ...base, answerAppId: '0' }).valid).toBe(
      false,
    );
    expect(ConfigStore.validate({ ...base, answerAppId: '203' }).valid).toBe(
      true,
    );
  });

  test('回答アプリは依頼アプリIDと一覧名等が必須', () => {
    const base = {
      ...ConfigStore.load(null),
      role: 'answer',
      requestAppId: '202',
    };
    expect(ConfigStore.validate(base).valid).toBe(true);
    expect(ConfigStore.validate({ ...base, requestAppId: '' }).valid).toBe(
      false,
    );
    expect(ConfigStore.validate({ ...base, listViewName: ' ' }).valid).toBe(
      false,
    );
    expect(ConfigStore.validate({ ...base, formSpaceId: '' }).valid).toBe(
      false,
    );
    expect(ConfigStore.validate({ ...base, analysisViewName: '' }).valid).toBe(
      false,
    );
  });
});
