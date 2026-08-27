const { validateConfig } = require('../js/lib/config-validation.js');

const fieldCatalog = {
  body_text: { type: 'MULTI_LINE_TEXT', subtableFieldCode: null },
  body_rich: { type: 'RICH_TEXT', subtableFieldCode: null },
  single_text: { type: 'SINGLE_LINE_TEXT', subtableFieldCode: null },
  status_radio: { type: 'RADIO_BUTTON', subtableFieldCode: null },
  items_table: { type: 'SUBTABLE', subtableFieldCode: null },
  item_name: { type: 'SINGLE_LINE_TEXT', subtableFieldCode: 'items_table' },
  other_table: { type: 'SUBTABLE', subtableFieldCode: null },
  other_col: { type: 'SINGLE_LINE_TEXT', subtableFieldCode: 'other_table' },
};

const validTemplate = {
  id: 'tpl_1',
  name: 'テンプレ1',
  targetFieldCode: 'body_text',
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
    expect(validateConfig(config, fieldCatalog)).toEqual({
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
    const result = validateConfig(config, fieldCatalog);
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
    expect(validateConfig(config, fieldCatalog).valid).toBe(false);
  });

  test('挿入先フィールドが文字列(複数行)/リッチエディター以外の場合はエラー', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [{ ...validTemplate, targetFieldCode: 'single_text' }],
    };
    expect(validateConfig(config, fieldCatalog).valid).toBe(false);
  });

  test('挿入先フィールドがリッチエディターでも有効', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [{ ...validTemplate, targetFieldCode: 'body_rich' }],
    };
    expect(validateConfig(config, fieldCatalog).valid).toBe(true);
  });

  test('本文が空の場合はエラー', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [{ ...validTemplate, body: '' }],
    };
    expect(validateConfig(config, fieldCatalog).valid).toBe(false);
  });

  test('[[と]]の対応が崩れている場合はエラー', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [{ ...validTemplate, body: '[[{item_name}様' }],
    };
    const result = validateConfig(config, fieldCatalog);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('[[と]]の対応');
  });

  test('繰り返しブロックがテーブルの列を1つ以上含んでいれば有効', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [{ ...validTemplate, body: '[[・{item_name}]]' }],
    };
    expect(validateConfig(config, fieldCatalog).valid).toBe(true);
  });

  test('繰り返しブロックがどのテーブルも指さない場合はエラー', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [{ ...validTemplate, body: '[[{single_text}]]' }],
    };
    const result = validateConfig(config, fieldCatalog);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain(
      'どのテーブルの繰り返しか特定できません',
    );
  });

  test('繰り返しブロックが複数の異なるテーブルにまたがる場合はエラー', () => {
    const config = {
      mode: 'DROPDOWN',
      radioFieldCode: '',
      radioMappings: [],
      templates: [{ ...validTemplate, body: '[[{item_name} {other_col}]]' }],
    };
    expect(validateConfig(config, fieldCatalog).valid).toBe(false);
  });

  test('RADIO_LINKEDモードでradioFieldCode未選択の場合はエラー', () => {
    const config = {
      mode: 'RADIO_LINKED',
      radioFieldCode: '',
      radioMappings: [],
      templates: [validTemplate],
    };
    expect(validateConfig(config, fieldCatalog).valid).toBe(false);
  });

  test('RADIO_LINKEDモードでラジオボタン以外のフィールドを選んだ場合はエラー', () => {
    const config = {
      mode: 'RADIO_LINKED',
      radioFieldCode: 'single_text',
      radioMappings: [],
      templates: [validTemplate],
    };
    expect(validateConfig(config, fieldCatalog).valid).toBe(false);
  });

  test('RADIO_LINKEDモードで正しく設定されていれば有効', () => {
    const config = {
      mode: 'RADIO_LINKED',
      radioFieldCode: 'status_radio',
      radioMappings: [{ optionValue: '承認', templateId: 'tpl_1' }],
      templates: [validTemplate],
    };
    expect(validateConfig(config, fieldCatalog).valid).toBe(true);
  });

  test('radioMappingsが削除済みのテンプレートIDを参照している場合はエラー', () => {
    const config = {
      mode: 'RADIO_LINKED',
      radioFieldCode: 'status_radio',
      radioMappings: [{ optionValue: '承認', templateId: 'tpl_removed' }],
      templates: [validTemplate],
    };
    expect(validateConfig(config, fieldCatalog).valid).toBe(false);
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
    expect(validateConfig(config, fieldCatalog)).toEqual({
      valid: true,
      errors: [],
    });
  });
});
