const { formatFieldValue } = require('../js/lib/field-value-formatter');

describe('formatFieldValue', () => {
  test('文字列(1行)はそのまま', () => {
    expect(
      formatFieldValue({ type: 'SINGLE_LINE_TEXT', value: 'テスト' }),
    ).toBe('テスト');
  });

  test('数値はそのまま文字列化', () => {
    expect(formatFieldValue({ type: 'NUMBER', value: '123' })).toBe('123');
  });

  test('ユーザー選択は名前を「、」区切りで結合', () => {
    expect(
      formatFieldValue({
        type: 'USER_SELECT',
        value: [
          { code: 'sato', name: 'Noboru Sato' },
          { code: 'kato', name: 'Misaki Kato' },
        ],
      }),
    ).toBe('Noboru Sato、Misaki Kato');
  });

  test('組織選択は名前を結合', () => {
    expect(
      formatFieldValue({
        type: 'ORGANIZATION_SELECT',
        value: [{ code: 'kaihatsu', name: '開発部' }],
      }),
    ).toBe('開発部');
  });

  test('チェックボックスは選択肢を結合', () => {
    expect(
      formatFieldValue({ type: 'CHECK_BOX', value: ['選択肢1', '選択肢2'] }),
    ).toBe('選択肢1、選択肢2');
  });

  test('添付ファイルはファイル名を結合', () => {
    expect(
      formatFieldValue({
        type: 'FILE',
        value: [{ name: 'a.txt' }, { name: 'b.txt' }],
      }),
    ).toBe('a.txt、b.txt');
  });

  test('作成者は名前のみ', () => {
    expect(
      formatFieldValue({
        type: 'CREATOR',
        value: { code: 'sato', name: 'Noboru Sato' },
      }),
    ).toBe('Noboru Sato');
  });

  test('空値は空文字列', () => {
    expect(formatFieldValue({ type: 'SINGLE_LINE_TEXT', value: '' })).toBe('');
    expect(formatFieldValue({ type: 'CHECK_BOX', value: [] })).toBe('');
    expect(formatFieldValue({ type: 'USER_SELECT', value: [] })).toBe('');
  });

  test('SUBTABLEは空文字列', () => {
    expect(
      formatFieldValue({ type: 'SUBTABLE', value: [{ id: '1', value: {} }] }),
    ).toBe('');
  });

  test('fieldがnullなら空文字列', () => {
    expect(formatFieldValue(null)).toBe('');
  });
});
