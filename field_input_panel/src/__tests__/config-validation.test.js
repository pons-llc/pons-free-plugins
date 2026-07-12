const ConfigValidation = require('../js/lib/config-validation');

const validButton = () => ({
  label: '基本情報',
  title: '',
  items: [{ type: 'FIELD', fieldCode: 'text1' }],
});

describe('validateButtons', () => {
  test('buttonsが配列でない場合はエラー', () => {
    const result = ConfigValidation.validateButtons(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['設定(buttons)が配列ではありません。']);
  });

  test('buttonsが空配列の場合はエラー', () => {
    const result = ConfigValidation.validateButtons([]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('ボタンが1件も設定されていません。');
  });

  test('正常なボタン設定はvalid: true', () => {
    const result = ConfigValidation.validateButtons([validButton()]);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('ラベル未入力はエラー', () => {
    const button = { ...validButton(), label: '' };
    const result = ConfigValidation.validateButtons([button]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '1番目のボタン: ボタンのラベルが入力されていません。',
    );
  });

  test('フィールド項目が0件はエラー(空白のみは不可)', () => {
    const button = { ...validButton(), items: [{ type: 'SPACER' }] };
    const result = ConfigValidation.validateButtons([button]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '1番目のボタン: フィールドが1件も選択されていません。',
    );
  });

  test('FIELD項目でfieldCode未選択はエラー', () => {
    const button = {
      ...validButton(),
      items: [{ type: 'FIELD', fieldCode: '' }],
    };
    const result = ConfigValidation.validateButtons([button]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '1番目のボタンの1番目の項目: フィールドが選択されていません。',
    );
  });

  test('同一ボタン内でのフィールドコード重複はエラー', () => {
    const button = {
      ...validButton(),
      items: [
        { type: 'FIELD', fieldCode: 'text1' },
        { type: 'FIELD', fieldCode: 'text1' },
      ],
    };
    const result = ConfigValidation.validateButtons([button]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '1番目のボタン: フィールド「text1」が重複して選択されています。',
    );
  });

  test('不正な項目種類はエラー', () => {
    const button = {
      ...validButton(),
      items: [...validButton().items, { type: 'UNKNOWN' }],
    };
    const result = ConfigValidation.validateButtons([button]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '1番目のボタンの2番目の項目: 項目の種類が不正です。',
    );
  });

  test('SPACER項目はfieldCode不要でエラーにならない', () => {
    const button = {
      ...validButton(),
      items: [{ type: 'SPACER' }, ...validButton().items],
    };
    const result = ConfigValidation.validateButtons([button]);
    expect(result.valid).toBe(true);
  });

  test('fieldInfoByCodeを渡した場合、選択不可なフィールド型はエラー', () => {
    const button = {
      ...validButton(),
      items: [{ type: 'FIELD', fieldCode: 'user1' }],
    };
    const result = ConfigValidation.validateButtons([button], {
      user1: { type: 'USER_SELECT' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '1番目のボタンの1番目の項目: 「user1」は選択できないフィールドです。',
    );
  });

  test('fieldInfoByCodeを渡さない場合は型チェックをスキップする', () => {
    const button = {
      ...validButton(),
      items: [{ type: 'FIELD', fieldCode: 'user1' }],
    };
    const result = ConfigValidation.validateButtons([button]);
    expect(result.valid).toBe(true);
  });
});
