const { validateConfig } = require('../js/lib/config-validation.js');

const fieldInfoByCode = {
  body_text: { type: 'MULTI_LINE_TEXT' },
  body_rich: { type: 'RICH_TEXT' },
  single_text: { type: 'SINGLE_LINE_TEXT' },
  status_radio: { type: 'RADIO_BUTTON' },
  items_table: { type: 'SUBTABLE' },
};

const validTemplate = {
  id: 'tpl_1',
  name: 'テンプレ1',
  targetFieldCode: 'body_text',
  kind: 'NORMAL',
  body: '本文です',
};

describe('validateConfig', () => {
  test('正常な通常モードの設定はvalid: trueを返す', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [validTemplate],
    };
    expect(validateConfig(config, fieldInfoByCode)).toEqual({
      valid: true,
      errors: [],
    });
  });

  test('テンプレートが0件の場合はエラー', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [],
    };
    const result = validateConfig(config, fieldInfoByCode);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('テンプレートを1件以上追加してください。');
  });

  test('テンプレート名が空の場合はエラー', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [{ ...validTemplate, name: '' }],
    };
    expect(validateConfig(config, fieldInfoByCode).valid).toBe(false);
  });

  test('挿入先フィールドが文字列(複数行)/リッチエディター以外の場合はエラー', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [{ ...validTemplate, targetFieldCode: 'single_text' }],
    };
    expect(validateConfig(config, fieldInfoByCode).valid).toBe(false);
  });

  test('挿入先フィールドがリッチエディターでも有効', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [{ ...validTemplate, targetFieldCode: 'body_rich' }],
    };
    expect(validateConfig(config, fieldInfoByCode).valid).toBe(true);
  });

  test('本文が空の場合はエラー', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [{ ...validTemplate, body: '' }],
    };
    expect(validateConfig(config, fieldInfoByCode).valid).toBe(false);
  });

  test('SUBTABLE_REPEAT種別で対象サブテーブル未選択の場合はエラー', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [
        { ...validTemplate, kind: 'SUBTABLE_REPEAT', subtableFieldCode: '' },
      ],
    };
    expect(validateConfig(config, fieldInfoByCode).valid).toBe(false);
  });

  test('SUBTABLE_REPEAT種別でSUBTABLE型のフィールドを選んでいれば有効', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [
        {
          ...validTemplate,
          kind: 'SUBTABLE_REPEAT',
          subtableFieldCode: 'items_table',
        },
      ],
    };
    expect(validateConfig(config, fieldInfoByCode).valid).toBe(true);
  });

  test('RADIO_LINKEDモードでradioFieldCode未選択の場合はエラー', () => {
    const config = {
      mode: 'RADIO_LINKED',
      radioFieldCode: '',
      radioMappings: [],
      templates: [validTemplate],
    };
    expect(validateConfig(config, fieldInfoByCode).valid).toBe(false);
  });

  test('RADIO_LINKEDモードでラジオボタン以外のフィールドを選んだ場合はエラー', () => {
    const config = {
      mode: 'RADIO_LINKED',
      radioFieldCode: 'single_text',
      radioMappings: [],
      templates: [validTemplate],
    };
    expect(validateConfig(config, fieldInfoByCode).valid).toBe(false);
  });

  test('RADIO_LINKEDモードで正しく設定されていれば有効', () => {
    const config = {
      mode: 'RADIO_LINKED',
      radioFieldCode: 'status_radio',
      radioMappings: [{ optionValue: '承認', templateId: 'tpl_1' }],
      templates: [validTemplate],
    };
    expect(validateConfig(config, fieldInfoByCode).valid).toBe(true);
  });

  test('radioMappingsが削除済みのテンプレートIDを参照している場合はエラー', () => {
    const config = {
      mode: 'RADIO_LINKED',
      radioFieldCode: 'status_radio',
      radioMappings: [{ optionValue: '承認', templateId: 'tpl_removed' }],
      templates: [validTemplate],
    };
    expect(validateConfig(config, fieldInfoByCode).valid).toBe(false);
  });

  test('radioMappingsのtemplateIdが空文字列(挿入しない)の場合はエラーにしない', () => {
    const config = {
      mode: 'RADIO_LINKED',
      radioFieldCode: 'status_radio',
      radioMappings: [
        { optionValue: '承認', templateId: 'tpl_1' },
        { optionValue: '却下', templateId: '' },
      ],
      templates: [validTemplate],
    };
    expect(validateConfig(config, fieldInfoByCode)).toEqual({
      valid: true,
      errors: [],
    });
  });
});
