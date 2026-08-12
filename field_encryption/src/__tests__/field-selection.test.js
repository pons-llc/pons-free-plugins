'use strict';

const FieldSelection = require('../js/lib/field-selection');

describe('FieldSelection', () => {
  test('filterEligibleFields()はSINGLE_LINE_TEXT/MULTI_LINE_TEXTのみ抽出する', () => {
    const formFields = {
      名前: { code: '名前', label: '名前', type: 'SINGLE_LINE_TEXT' },
      メモ: { code: 'メモ', label: 'メモ', type: 'MULTI_LINE_TEXT' },
      数値: { code: '数値', label: '数値', type: 'NUMBER' },
      日付: { code: '日付', label: '日付', type: 'DATE' },
      テーブル: { code: 'テーブル', label: 'テーブル', type: 'SUBTABLE' },
    };

    const result = FieldSelection.filterEligibleFields(formFields);
    const codes = result.map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(['名前', 'メモ']));
    expect(codes).not.toContain('数値');
    expect(codes).not.toContain('日付');
    expect(codes).not.toContain('テーブル');
  });

  test('空のフォームなら空配列を返す', () => {
    expect(FieldSelection.filterEligibleFields({})).toEqual([]);
  });

  test('ラベルの昇順でソートされる(UIでの表示順を安定させるため)', () => {
    const formFields = {
      b: { code: 'b', label: 'ぶどう', type: 'SINGLE_LINE_TEXT' },
      a: { code: 'a', label: 'あんず', type: 'SINGLE_LINE_TEXT' },
    };
    const result = FieldSelection.filterEligibleFields(formFields);
    expect(result.map((f) => f.code)).toEqual(['a', 'b']);
  });

  test('各要素はcode/label/typeのみを持つ', () => {
    const formFields = {
      a: {
        code: 'a',
        label: 'ラベル',
        type: 'SINGLE_LINE_TEXT',
        noLabel: false,
      },
    };
    const result = FieldSelection.filterEligibleFields(formFields);
    expect(result).toEqual([
      { code: 'a', label: 'ラベル', type: 'SINGLE_LINE_TEXT' },
    ]);
  });
});
