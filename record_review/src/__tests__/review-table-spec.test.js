'use strict';

const Spec = require('../js/lib/review-table-spec');

const validTable = () => ({
  type: 'SUBTABLE',
  code: 'review_comment_table',
  fields: {
    rr_target_code: { type: 'SINGLE_LINE_TEXT' },
    rr_target_label: { type: 'SINGLE_LINE_TEXT' },
    rr_pointed_at: { type: 'DATETIME' },
    rr_pointed_by: { type: 'USER_SELECT' },
    rr_comment: { type: 'MULTI_LINE_TEXT' },
    rr_status: {
      type: 'DROP_DOWN',
      options: {
        未解決: { label: '未解決', index: '0' },
        解決済み: { label: '解決済み', index: '1' },
      },
    },
    rr_resolution: { type: 'MULTI_LINE_TEXT' },
    rr_resolved_by: { type: 'USER_SELECT' },
    rr_resolved_at: { type: 'DATETIME' },
  },
});

describe('buildReviewTableSpec', () => {
  test('既定コードが空いていれば新規作成する', () => {
    const spec = Spec.buildReviewTableSpec({});
    expect(spec.needsCreate).toBe(true);
    expect(spec.tableCode).toBe('review_comment_table');
    const table = spec.propertiesToAdd.review_comment_table;
    expect(table.type).toBe('SUBTABLE');
    expect(table.label).toBe('指摘履歴');
    expect(Object.keys(table.fields)).toEqual([
      'rr_target_code',
      'rr_target_label',
      'rr_pointed_at',
      'rr_pointed_by',
      'rr_comment',
      'rr_status',
      'rr_resolution',
      'rr_resolved_by',
      'rr_resolved_at',
    ]);
    expect(table.fields.rr_status.defaultValue).toBe('未解決');
    expect(Object.keys(table.fields.rr_status.options)).toEqual([
      '未解決',
      '解決済み',
    ]);
    expect(spec.warnings).toEqual([]);
    expect(spec.fieldCodes).toEqual({
      table: 'review_comment_table',
      targetCode: 'rr_target_code',
      targetLabel: 'rr_target_label',
      pointedAt: 'rr_pointed_at',
      pointedBy: 'rr_pointed_by',
      comment: 'rr_comment',
      status: 'rr_status',
      resolution: 'rr_resolution',
      resolvedBy: 'rr_resolved_by',
      resolvedAt: 'rr_resolved_at',
    });
  });

  test('完全一致するテーブルがあれば再利用する(冪等)', () => {
    const spec = Spec.buildReviewTableSpec({
      review_comment_table: validTable(),
    });
    expect(spec.needsCreate).toBe(false);
    expect(spec.propertiesToAdd).toEqual({});
  });

  test('既定コードが別内容で使われていれば連番で新規作成し警告する', () => {
    const spec = Spec.buildReviewTableSpec({
      review_comment_table: { type: 'SINGLE_LINE_TEXT' },
      review_comment_table_2: { type: 'NUMBER' },
    });
    expect(spec.needsCreate).toBe(true);
    expect(spec.tableCode).toBe('review_comment_table_3');
    expect(spec.fieldCodes.table).toBe('review_comment_table_3');
    expect(spec.warnings).toHaveLength(1);
  });

  test('ドロップダウンの選択肢が足りないテーブルは一致とみなさない', () => {
    const table = validTable();
    delete table.fields.rr_status.options['解決済み'];
    expect(Spec.hasAllInnerFields(table)).toBe(false);
  });

  test('内包フィールドの型が違うテーブルは一致とみなさない', () => {
    const table = validTable();
    table.fields.rr_comment.type = 'SINGLE_LINE_TEXT';
    expect(Spec.hasAllInnerFields(table)).toBe(false);
  });
});

describe('currentFieldCodes', () => {
  test('保存済みコードのテーブルが現存すればそれを返す', () => {
    const saved = Spec.buildReviewTableSpec({}).fieldCodes;
    expect(
      Spec.currentFieldCodes({ review_comment_table: validTable() }, saved),
    ).toEqual(saved);
  });

  test('テーブルが削除されていればnull', () => {
    const saved = Spec.buildReviewTableSpec({}).fieldCodes;
    expect(Spec.currentFieldCodes({}, saved)).toBeNull();
    expect(Spec.currentFieldCodes({}, null)).toBeNull();
  });
});
