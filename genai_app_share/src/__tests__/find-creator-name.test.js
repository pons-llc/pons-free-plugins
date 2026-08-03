'use strict';

const {
  findCreatorName,
  FALLBACK_NAME,
} = require('../js/lib/find-creator-name');

describe('findCreatorName', () => {
  test('type === CREATOR のフィールドを見つけて名前を返す(フィールドコードは決め打ちしない)', () => {
    const record = {
      文字列1行_0: { type: 'SINGLE_LINE_TEXT', value: 'x' },
      カスタム作成者コード: {
        type: 'CREATOR',
        value: { code: 'sato', name: '佐藤太郎' },
      },
    };
    expect(findCreatorName(record)).toBe('佐藤太郎');
  });

  test('CREATORフィールドが見つからない場合はフォールバック文言を返す', () => {
    const record = { 文字列1行_0: { type: 'SINGLE_LINE_TEXT', value: 'x' } };
    expect(findCreatorName(record)).toBe(FALLBACK_NAME);
  });

  test('recordがnull/undefinedでも例外を投げずフォールバック文言を返す', () => {
    expect(findCreatorName(null)).toBe(FALLBACK_NAME);
    expect(findCreatorName(undefined)).toBe(FALLBACK_NAME);
  });

  test('CREATORフィールドのvalue.nameが欠けている場合もフォールバック文言を返す', () => {
    const record = { 作成者: { type: 'CREATOR', value: {} } };
    expect(findCreatorName(record)).toBe(FALLBACK_NAME);
  });
});
