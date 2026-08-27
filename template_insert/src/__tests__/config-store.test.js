const {
  DEFAULTS,
  load,
  serialize,
  createTemplateId,
} = require('../js/lib/config-store.js');

describe('load', () => {
  test('未保存(null)の場合は既定値を返す', () => {
    expect(load(null)).toEqual(DEFAULTS);
  });

  test('undefinedの場合も既定値を返す', () => {
    expect(load(undefined)).toEqual(DEFAULTS);
  });

  test('保存済みの値を復元する', () => {
    const saved = {
      mode: 'RADIO_LINKED',
      radioFieldCode: 'status_radio',
      radioMappings: JSON.stringify([
        { optionValue: '承認', templateId: 'tpl_1' },
      ]),
      templates: JSON.stringify([
        {
          id: 'tpl_1',
          name: 'テンプレ1',
          targetFieldCode: 'body',
          body: '本文',
        },
      ]),
    };
    expect(load(saved)).toEqual({
      mode: 'RADIO_LINKED',
      radioFieldCode: 'status_radio',
      radioMappings: [{ optionValue: '承認', templateId: 'tpl_1' }],
      templates: [
        {
          id: 'tpl_1',
          name: 'テンプレ1',
          targetFieldCode: 'body',
          body: '本文',
        },
      ],
    });
  });

  test('壊れたJSONの場合は既定値にフォールバックする', () => {
    const saved = { templates: '{不正なJSON' };
    expect(load(saved).templates).toEqual(DEFAULTS.templates);
  });
});

describe('serialize', () => {
  test('配列項目をJSON文字列化し、文字列項目はそのまま渡す', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [{ id: 'tpl_1', name: 'テンプレ1' }],
    };
    expect(serialize(config)).toEqual({
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: '[]',
      templates: '[{"id":"tpl_1","name":"テンプレ1"}]',
    });
  });
});

describe('createTemplateId', () => {
  test('呼び出すたびに異なるIDを返す', () => {
    const a = createTemplateId();
    const b = createTemplateId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^tpl_/);
  });
});
