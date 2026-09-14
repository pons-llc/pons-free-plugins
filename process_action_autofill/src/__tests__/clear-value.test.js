const { resolveClearValue } = require('../js/lib/clear-value');

describe('resolveClearValue', () => {
  test.each([
    ['SINGLE_LINE_TEXT', ''],
    ['MULTI_LINE_TEXT', ''],
    ['NUMBER', ''],
    ['DROP_DOWN', ''],
  ])('%sは空文字列になる', (type, expected) => {
    expect(resolveClearValue(type)).toBe(expected);
  });

  test.each([
    ['DATE', null],
    ['DATETIME', null],
  ])('%sはnullになる', (type, expected) => {
    expect(resolveClearValue(type)).toBe(expected);
  });

  test.each([
    'CHECK_BOX',
    'MULTI_SELECT',
    'USER_SELECT',
    'ORGANIZATION_SELECT',
    'GROUP_SELECT',
  ])('%sは空配列になる', (type) => {
    expect(resolveClearValue(type)).toEqual([]);
  });

  test('RADIO_BUTTONは空文字列を返す(初期値の選択肢に戻る仕様上の制約)', () => {
    expect(resolveClearValue('RADIO_BUTTON')).toBe('');
  });

  test('対応外の型はundefinedを返す', () => {
    expect(resolveClearValue('LINK')).toBeUndefined();
    expect(resolveClearValue('SUBTABLE')).toBeUndefined();
  });
});
