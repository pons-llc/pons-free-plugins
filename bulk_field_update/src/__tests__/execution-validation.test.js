'use strict';

const {
  isBlank,
  validateTargetValues,
} = require('../js/lib/execution-validation');

const formFieldsByCode = {
  text1: {
    type: 'SINGLE_LINE_TEXT',
    code: 'text1',
    label: '文字列1',
    required: false,
  },
  requiredText1: {
    type: 'SINGLE_LINE_TEXT',
    code: 'requiredText1',
    label: '必須文字列',
    required: true,
  },
  radio1: {
    type: 'RADIO_BUTTON',
    code: 'radio1',
    label: 'ラジオ1',
    required: false,
    options: { a: { label: 'A', index: '0' } },
  },
  checkbox1: {
    type: 'CHECK_BOX',
    code: 'checkbox1',
    label: 'チェック1',
    required: true,
    options: { a: { label: 'A', index: '0' } },
  },
};

describe('isBlank', () => {
  test('空文字列・null・undefined・空配列はblank', () => {
    expect(isBlank('')).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank([])).toBe(true);
  });

  test('値がある場合はblankではない', () => {
    expect(isBlank('a')).toBe(false);
    expect(isBlank(['a'])).toBe(false);
    expect(isBlank('0')).toBe(false);
  });
});

describe('validateTargetValues', () => {
  test('任意項目(required:false)は空でもエラーにならない', () => {
    const result = validateTargetValues(
      [{ fieldCode: 'text1', value: '' }],
      formFieldsByCode,
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('必須項目(required:true)が空だとエラー', () => {
    const result = validateTargetValues(
      [{ fieldCode: 'requiredText1', value: '' }],
      formFieldsByCode,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '「必須文字列」は必須フィールドのため、値を入力してください。',
    );
  });

  test('必須項目に値があればエラーにならない', () => {
    const result = validateTargetValues(
      [{ fieldCode: 'requiredText1', value: 'hello' }],
      formFieldsByCode,
    );
    expect(result.valid).toBe(true);
  });

  test('選択肢系フィールド(ラジオボタン)はrequired:falseでも空だとエラー', () => {
    const result = validateTargetValues(
      [{ fieldCode: 'radio1', value: '' }],
      formFieldsByCode,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '「ラジオ1」は選択肢の中から値を選択してください。',
    );
  });

  test('必須の複数選択(チェックボックス)は0件選択だとエラー', () => {
    const result = validateTargetValues(
      [{ fieldCode: 'checkbox1', value: [] }],
      formFieldsByCode,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      '「チェック1」は必須フィールドのため、値を入力してください。',
    );
  });

  test('フォームから削除されたフィールドコードは検証をスキップする', () => {
    const result = validateTargetValues(
      [{ fieldCode: 'deleted1', value: '' }],
      formFieldsByCode,
    );
    expect(result.valid).toBe(true);
  });

  test('targetsが空の場合は有効', () => {
    expect(validateTargetValues([], formFieldsByCode)).toEqual({
      valid: true,
      errors: [],
    });
    expect(validateTargetValues(null, formFieldsByCode)).toEqual({
      valid: true,
      errors: [],
    });
  });
});
