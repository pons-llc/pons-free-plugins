'use strict';

const {
  normalizeValue,
  buildPatch,
} = require('../js/lib/record-patch-builder');

describe('normalizeValue', () => {
  test('日付/時刻は空文字列・nullをnullに正規化する', () => {
    expect(normalizeValue('DATE', '')).toBeNull();
    expect(normalizeValue('DATE', null)).toBeNull();
    expect(normalizeValue('TIME', '')).toBeNull();
    expect(normalizeValue('DATE', '2026-01-05')).toBe('2026-01-05');
  });

  test('チェックボックス/複数選択は配列のまま(未配列は空配列に)正規化する', () => {
    expect(normalizeValue('CHECK_BOX', ['a', 'b'])).toEqual(['a', 'b']);
    expect(normalizeValue('MULTI_SELECT', null)).toEqual([]);
    expect(normalizeValue('CHECK_BOX', undefined)).toEqual([]);
  });

  test('それ以外の型はnull/undefinedを空文字列に正規化する', () => {
    expect(normalizeValue('SINGLE_LINE_TEXT', null)).toBe('');
    expect(normalizeValue('NUMBER', undefined)).toBe('');
    expect(normalizeValue('SINGLE_LINE_TEXT', 'hello')).toBe('hello');
    expect(normalizeValue('DATETIME', '2026-01-05T09:30:00Z')).toBe(
      '2026-01-05T09:30:00Z',
    );
  });
});

describe('buildPatch', () => {
  test('現在のフォームに存在するフィールドだけをパッチに含める', () => {
    const targets = [
      { fieldCode: 'text1', value: 'hello' },
      { fieldCode: 'date1', value: '' },
      { fieldCode: 'deleted1', value: 'x' },
    ];
    const formFieldsByCode = {
      text1: { type: 'SINGLE_LINE_TEXT' },
      date1: { type: 'DATE' },
    };
    const { patch, skippedFieldCodes } = buildPatch(targets, formFieldsByCode);
    expect(patch).toEqual({
      text1: { value: 'hello' },
      date1: { value: null },
    });
    expect(skippedFieldCodes).toEqual(['deleted1']);
  });

  test('targetsが空の場合は空のパッチを返す', () => {
    expect(buildPatch([], {})).toEqual({ patch: {}, skippedFieldCodes: [] });
    expect(buildPatch(null, {})).toEqual({ patch: {}, skippedFieldCodes: [] });
  });
});
