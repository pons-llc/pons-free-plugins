'use strict';

const ApprovalTableSpec = require('../js/lib/approval-table-spec');

describe('buildApprovalTableSpec', () => {
  test('既存フィールドが無ければ既定コードで新規作成する', () => {
    const result = ApprovalTableSpec.buildApprovalTableSpec({});

    expect(result.needsCreate).toBe(true);
    expect(result.tableCode).toBe('approval_history_table');
    expect(result.warnings).toEqual([]);
    expect(result.fieldCodes).toEqual({
      table: 'approval_history_table',
      statusBefore: 'status_before',
      statusAfter: 'status_after',
      executedBy: 'executed_by',
      executedByTitle: 'executed_by_title',
      executedAt: 'executed_at',
    });

    const table = result.propertiesToAdd.approval_history_table;
    expect(table.type).toBe('SUBTABLE');
    expect(table.label).toBe('決裁履歴');
    expect(Object.keys(table.fields).sort()).toEqual(
      [
        'status_before',
        'status_after',
        'executed_by',
        'executed_by_title',
        'executed_at',
      ].sort(),
    );
    expect(table.fields.status_before.type).toBe('SINGLE_LINE_TEXT');
    expect(table.fields.executed_by.type).toBe('USER_SELECT');
    expect(table.fields.executed_at.type).toBe('DATETIME');
  });

  test('既定コードに完全一致するテーブルが既にあれば再利用し、作成不要とする(冪等)', () => {
    const existingFields = {
      approval_history_table: {
        type: 'SUBTABLE',
        fields: {
          status_before: { type: 'SINGLE_LINE_TEXT' },
          status_after: { type: 'SINGLE_LINE_TEXT' },
          executed_by: { type: 'USER_SELECT' },
          executed_by_title: { type: 'SINGLE_LINE_TEXT' },
          executed_at: { type: 'DATETIME' },
        },
      },
    };

    const result = ApprovalTableSpec.buildApprovalTableSpec(existingFields);

    expect(result.needsCreate).toBe(false);
    expect(result.tableCode).toBe('approval_history_table');
    expect(result.propertiesToAdd).toEqual({});
    expect(result.warnings).toEqual([]);
  });

  test('既定コードが別型のフィールドで使われている場合は連番を付けた新しいコードで作成する', () => {
    const existingFields = {
      approval_history_table: { type: 'SINGLE_LINE_TEXT' },
    };

    const result = ApprovalTableSpec.buildApprovalTableSpec(existingFields);

    expect(result.needsCreate).toBe(true);
    expect(result.tableCode).toBe('approval_history_table_2');
    expect(result.warnings).toHaveLength(1);
    expect(result.propertiesToAdd.approval_history_table_2).toBeDefined();
  });

  test('既定コードが内包フィールド不足のテーブルで使われている場合も連番を付ける', () => {
    const existingFields = {
      approval_history_table: {
        type: 'SUBTABLE',
        fields: {
          status_before: { type: 'SINGLE_LINE_TEXT' },
          // 他の内包フィールドが欠けている
        },
      },
    };

    const result = ApprovalTableSpec.buildApprovalTableSpec(existingFields);

    expect(result.needsCreate).toBe(true);
    expect(result.tableCode).toBe('approval_history_table_2');
  });

  test('連番の候補も埋まっていればさらに先の番号を採用する', () => {
    const existingFields = {
      approval_history_table: { type: 'SINGLE_LINE_TEXT' },
      approval_history_table_2: { type: 'NUMBER' },
    };

    const result = ApprovalTableSpec.buildApprovalTableSpec(existingFields);

    expect(result.tableCode).toBe('approval_history_table_3');
  });
});

describe('currentFieldCodes', () => {
  const savedFieldCodes = {
    table: 'approval_history_table',
    statusBefore: 'status_before',
    statusAfter: 'status_after',
    executedBy: 'executed_by',
    executedByTitle: 'executed_by_title',
    executedAt: 'executed_at',
  };

  test('保存済みのテーブルが現存し内包フィールドを満たしていればそのまま返す', () => {
    const existingFields = {
      approval_history_table: {
        type: 'SUBTABLE',
        fields: {
          status_before: { type: 'SINGLE_LINE_TEXT' },
          status_after: { type: 'SINGLE_LINE_TEXT' },
          executed_by: { type: 'USER_SELECT' },
          executed_by_title: { type: 'SINGLE_LINE_TEXT' },
          executed_at: { type: 'DATETIME' },
        },
      },
    };

    expect(
      ApprovalTableSpec.currentFieldCodes(existingFields, savedFieldCodes),
    ).toEqual(savedFieldCodes);
  });

  test('保存済みの設定がない場合はnullを返す', () => {
    expect(ApprovalTableSpec.currentFieldCodes({}, null)).toBeNull();
  });

  test('保存済みのテーブルが削除されている場合はnullを返す', () => {
    expect(ApprovalTableSpec.currentFieldCodes({}, savedFieldCodes)).toBeNull();
  });
});
