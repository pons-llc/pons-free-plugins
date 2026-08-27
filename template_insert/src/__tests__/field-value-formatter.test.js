const {
  formatFieldValueForPlaceholder,
  isPlaceholderEligibleFieldType,
} = require('../js/lib/field-value-formatter.js');

describe('formatFieldValueForPlaceholder', () => {
  test('SINGLE_LINE_TEXTはそのまま文字列を返す', () => {
    expect(
      formatFieldValueForPlaceholder({
        type: 'SINGLE_LINE_TEXT',
        value: 'テストです。',
      }),
    ).toBe('テストです。');
  });

  test('MULTI_LINE_TEXTの改行はそのまま保持する', () => {
    expect(
      formatFieldValueForPlaceholder({
        type: 'MULTI_LINE_TEXT',
        value: '1行目\n2行目',
      }),
    ).toBe('1行目\n2行目');
  });

  test('NUMBERは文字列化する', () => {
    expect(
      formatFieldValueForPlaceholder({ type: 'NUMBER', value: '123' }),
    ).toBe('123');
  });

  test('値が空文字列の場合は空文字列を返す', () => {
    expect(
      formatFieldValueForPlaceholder({ type: 'SINGLE_LINE_TEXT', value: '' }),
    ).toBe('');
  });

  test('値がundefined(追加画面での未入力)の場合は空文字列を返す', () => {
    expect(
      formatFieldValueForPlaceholder({
        type: 'SINGLE_LINE_TEXT',
        value: undefined,
      }),
    ).toBe('');
  });

  test('CHECK_BOXは選択肢を「、」で連結する', () => {
    expect(
      formatFieldValueForPlaceholder({
        type: 'CHECK_BOX',
        value: ['選択肢1', '選択肢2'],
      }),
    ).toBe('選択肢1、選択肢2');
  });

  test('CHECK_BOXが空配列の場合は空文字列を返す', () => {
    expect(
      formatFieldValueForPlaceholder({ type: 'CHECK_BOX', value: [] }),
    ).toBe('');
  });

  test('USER_SELECTは表示名を「、」で連結する', () => {
    expect(
      formatFieldValueForPlaceholder({
        type: 'USER_SELECT',
        value: [
          { code: 'sato', name: 'Noboru Sato' },
          { code: 'kato', name: 'Misaki Kato' },
        ],
      }),
    ).toBe('Noboru Sato、Misaki Kato');
  });

  test('CREATORは表示名のみを返す', () => {
    expect(
      formatFieldValueForPlaceholder({
        type: 'CREATOR',
        value: { code: 'sato', name: 'Noboru Sato' },
      }),
    ).toBe('Noboru Sato');
  });

  test('FILEはファイル名を「、」で連結する', () => {
    expect(
      formatFieldValueForPlaceholder({
        type: 'FILE',
        value: [{ name: 'a.txt' }, { name: 'b.txt' }],
      }),
    ).toBe('a.txt、b.txt');
  });

  test('フィールド自体が存在しない場合は空文字列を返す', () => {
    expect(formatFieldValueForPlaceholder(undefined)).toBe('');
  });
});

describe('isPlaceholderEligibleFieldType', () => {
  test('SINGLE_LINE_TEXTは対象になる', () => {
    expect(isPlaceholderEligibleFieldType('SINGLE_LINE_TEXT')).toBe(true);
  });

  test('SUBTABLEは対象外(直下の値を持たないため)', () => {
    expect(isPlaceholderEligibleFieldType('SUBTABLE')).toBe(false);
  });

  test('LABEL・SPACER・HR・GROUP・REFERENCE_TABLEは対象外', () => {
    ['LABEL', 'SPACER', 'HR', 'GROUP', 'REFERENCE_TABLE'].forEach((type) => {
      expect(isPlaceholderEligibleFieldType(type)).toBe(false);
    });
  });
});
