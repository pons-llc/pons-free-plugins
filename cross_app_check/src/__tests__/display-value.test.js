const DisplayValue = require('../js/lib/display-value');

describe('formatDisplayValue', () => {
  test('文字列と数値はそのまま文字列にする', () => {
    expect(DisplayValue.formatDisplayValue('山田花子')).toBe('山田花子');
    expect(DisplayValue.formatDisplayValue(123)).toBe('123');
  });

  test('null/undefinedは空文字', () => {
    expect(DisplayValue.formatDisplayValue(null)).toBe('');
    expect(DisplayValue.formatDisplayValue(undefined)).toBe('');
  });

  test('ユーザー選択のような{code,name}はnameを使う', () => {
    expect(
      DisplayValue.formatDisplayValue({ code: 'sato', name: '佐藤' }),
    ).toBe('佐藤');
  });

  test('nameが無ければcodeで代用する', () => {
    expect(DisplayValue.formatDisplayValue({ code: 'sato' })).toBe('sato');
  });

  test('配列はカンマ区切りに潰す', () => {
    expect(
      DisplayValue.formatDisplayValue([
        { code: 'sato', name: '佐藤' },
        { code: 'kato', name: '加藤' },
      ]),
    ).toBe('佐藤, 加藤');
    expect(DisplayValue.formatDisplayValue(['選択肢1', '選択肢2'])).toBe(
      '選択肢1, 選択肢2',
    );
  });

  test('空要素は連結から除く', () => {
    expect(DisplayValue.formatDisplayValue(['a', null, 'b'])).toBe('a, b');
  });
});

describe('extractDisplayValue', () => {
  const record = { 氏名: { type: 'SINGLE_LINE_TEXT', value: '山田花子' } };

  test('レコードから表示名を取り出す', () => {
    expect(DisplayValue.extractDisplayValue(record, '氏名')).toBe('山田花子');
  });

  test('フィールドコード未指定・存在しないときは空文字', () => {
    expect(DisplayValue.extractDisplayValue(record, '')).toBe('');
    expect(DisplayValue.extractDisplayValue(record, '無い')).toBe('');
    expect(DisplayValue.extractDisplayValue(null, '氏名')).toBe('');
  });
});
