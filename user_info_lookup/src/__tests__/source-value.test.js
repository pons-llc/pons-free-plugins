'use strict';

const SourceValue = require('../js/lib/source-value');

describe('SourceValue.extractUserCode', () => {
  test('文字列1行フィールドの値をそのまま返す', () => {
    expect(
      SourceValue.extractUserCode({ value: 'sato' }, 'SINGLE_LINE_TEXT'),
    ).toBe('sato');
  });

  test('文字列1行フィールドの前後の空白を除去する', () => {
    expect(
      SourceValue.extractUserCode({ value: '  sato  ' }, 'SINGLE_LINE_TEXT'),
    ).toBe('sato');
  });

  test('文字列1行フィールドが空文字列なら空文字列を返す', () => {
    expect(SourceValue.extractUserCode({ value: '' }, 'SINGLE_LINE_TEXT')).toBe(
      '',
    );
  });

  test('ユーザー選択フィールドは1人目のcodeを返す', () => {
    expect(
      SourceValue.extractUserCode(
        { value: [{ code: 'sato' }, { code: 'suzuki' }] },
        'USER_SELECT',
      ),
    ).toBe('sato');
  });

  test('ユーザー選択フィールドが未選択なら空文字列を返す', () => {
    expect(SourceValue.extractUserCode({ value: [] }, 'USER_SELECT')).toBe('');
  });

  test('フィールド自体が存在しない場合は空文字列を返す', () => {
    expect(SourceValue.extractUserCode(undefined, 'SINGLE_LINE_TEXT')).toBe('');
  });
});
