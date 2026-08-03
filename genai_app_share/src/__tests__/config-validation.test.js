'use strict';

const { validate } = require('../js/lib/config-validation');

const VALID_BASE = {
  htmlFieldCode: 'h',
  cssFieldCode: 'c',
  jsFieldCode: 'j',
  executionMode: 'blob',
};

describe('validate', () => {
  test('HTMLフィールド未選択はエラー', () => {
    const errors = validate({ ...VALID_BASE, htmlFieldCode: '' });
    expect(errors).toContain('HTMLフィールドを選択してください。');
  });

  test('必須項目がすべて満たされていれば有効', () => {
    expect(validate(VALID_BASE)).toEqual([]);
  });

  test('CSS/JS未選択(空文字列)でもHTMLと実行方式さえあれば有効', () => {
    const errors = validate({
      htmlFieldCode: 'h',
      cssFieldCode: '',
      jsFieldCode: '',
      executionMode: 'data',
    });
    expect(errors).toEqual([]);
  });

  test('同じフィールドをHTML/CSS/JSで重複指定するとエラー', () => {
    const errors = validate({ ...VALID_BASE, cssFieldCode: 'h' });
    expect(errors).toContain(
      'HTML/CSS/JSフィールドに同じフィールドを重複して指定することはできません。',
    );
  });

  test('実行方式が未選択・不正値の場合はエラー', () => {
    expect(validate({ ...VALID_BASE, executionMode: '' })).toContain(
      '実行方式を選択してください。',
    );
    expect(validate({ ...VALID_BASE, executionMode: 'invalid' })).toContain(
      '実行方式を選択してください。',
    );
  });
});
