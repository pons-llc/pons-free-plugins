'use strict';

const TargetFields = require('../js/lib/target-fields');

const formFields = {
  レコード番号: {
    type: 'RECORD_NUMBER',
    code: 'レコード番号',
    label: 'レコード番号',
  },
  作成者: { type: 'CREATOR', code: '作成者', label: '作成者' },
  作成日時: { type: 'CREATED_TIME', code: '作成日時', label: '作成日時' },
  更新者: { type: 'MODIFIER', code: '更新者', label: '更新者' },
  更新日時: { type: 'UPDATED_TIME', code: '更新日時', label: '更新日時' },
  ステータス: { type: 'STATUS', code: 'ステータス', label: 'ステータス' },
  作業者: { type: 'STATUS_ASSIGNEE', code: '作業者', label: '作業者' },
  カテゴリー: { type: 'CATEGORY', code: 'カテゴリー', label: 'カテゴリー' },
  氏名: { type: 'SINGLE_LINE_TEXT', code: '氏名', label: '氏名' },
  金額: { type: 'NUMBER', code: '金額', label: '金額' },
  グループ: { type: 'GROUP', code: 'グループ', label: 'グループ' },
  備考: { type: 'MULTI_LINE_TEXT', code: '備考', label: '備考' },
  明細: {
    type: 'SUBTABLE',
    code: '明細',
    label: '明細',
    fields: { 品名: { type: 'SINGLE_LINE_TEXT', code: '品名', label: '品名' } },
  },
  review_comment_table: {
    type: 'SUBTABLE',
    code: 'review_comment_table',
    label: '指摘履歴',
    fields: {},
  },
  レイアウト外: {
    type: 'SINGLE_LINE_TEXT',
    code: 'レイアウト外',
    label: 'レイアウト外',
  },
};

const layout = [
  {
    type: 'ROW',
    fields: [
      { type: 'LABEL', label: '見出し' },
      { type: 'NUMBER', code: '金額' },
      { type: 'SINGLE_LINE_TEXT', code: '氏名' },
    ],
  },
  {
    type: 'SUBTABLE',
    code: '明細',
    fields: [{ type: 'SINGLE_LINE_TEXT', code: '品名' }],
  },
  {
    type: 'GROUP',
    code: 'グループ',
    layout: [
      { type: 'ROW', fields: [{ type: 'MULTI_LINE_TEXT', code: '備考' }] },
    ],
  },
  { type: 'SUBTABLE', code: 'review_comment_table', fields: [] },
  { type: 'ROW', fields: [{ type: 'RECORD_NUMBER', code: 'レコード番号' }] },
];

describe('listTargetFields', () => {
  test('レイアウト順に、指摘可能なフィールドだけを返す', () => {
    const result = TargetFields.listTargetFields(
      formFields,
      layout,
      'review_comment_table',
    );
    expect(result.map((f) => f.code)).toEqual([
      '金額',
      '氏名',
      '明細',
      '備考',
      'レイアウト外',
    ]);
    expect(result[0]).toEqual({ code: '金額', label: '金額', type: 'NUMBER' });
  });

  test('layoutが無くてもformFieldsから返す', () => {
    const result = TargetFields.listTargetFields(formFields, null, null);
    expect(result.map((f) => f.code)).toContain('review_comment_table');
    expect(result.map((f) => f.code)).not.toContain('ステータス');
    expect(result.map((f) => f.code)).not.toContain('品名');
  });
});

describe('resolveTargets', () => {
  const all = [
    { code: 'a', label: 'A' },
    { code: 'b', label: 'B' },
    { code: 'c', label: 'C' },
  ];

  test('保存値が空ならすべて', () => {
    expect(TargetFields.resolveTargets(all, [])).toEqual(all);
    expect(TargetFields.resolveTargets(all, null)).toEqual(all);
  });

  test('保存値の順ではなく候補(レイアウト)順で、存在するものだけ返す', () => {
    expect(
      TargetFields.resolveTargets(all, ['c', 'a', 'deleted']).map(
        (f) => f.code,
      ),
    ).toEqual(['a', 'c']);
  });
});
