const DisplayFieldEligibility = require('../js/lib/display-field-eligibility');

describe('listEligibleFields', () => {
  test('テーブル・関連レコード一覧・装飾フィールドを除外する', () => {
    const formFields = {
      title: { type: 'SINGLE_LINE_TEXT', code: 'title' },
      table: { type: 'SUBTABLE', code: 'table' },
      ref: { type: 'REFERENCE_TABLE', code: 'ref' },
      label: { type: 'LABEL', code: 'label' },
      spacer: { type: 'SPACER', code: 'spacer' },
      hr: { type: 'HR', code: 'hr' },
      group: { type: 'GROUP', code: 'group' },
      amount: { type: 'NUMBER', code: 'amount' },
    };
    const result = DisplayFieldEligibility.listEligibleFields(formFields);
    expect(result.map((f) => f.code).sort()).toEqual(['amount', 'title']);
  });

  test('未定義や空でも空配列', () => {
    expect(DisplayFieldEligibility.listEligibleFields(undefined)).toEqual([]);
    expect(DisplayFieldEligibility.listEligibleFields({})).toEqual([]);
  });
});
