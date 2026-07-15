'use strict';

const HistoryRow = require('../js/lib/history-row');

describe('buildHistoryRow', () => {
  const fieldCodes = {
    table: 'approval_history_table',
    statusBefore: 'status_before',
    statusAfter: 'status_after',
    executedBy: 'executed_by',
    executedByTitle: 'executed_by_title',
    executedAt: 'executed_at',
  };

  test('入力値がすべて型付きで行オブジェクトに変換される', () => {
    const row = HistoryRow.buildHistoryRow(fieldCodes, {
      statusBefore: '未処理',
      statusAfter: '承認済',
      executedByCode: 'sato',
      executedByName: 'Noboru Sato',
      executedByTitle: '課長',
      executedAtIso: '2026-07-16T01:23:45.000Z',
    });

    expect(row).toEqual({
      value: {
        status_before: { type: 'SINGLE_LINE_TEXT', value: '未処理' },
        status_after: { type: 'SINGLE_LINE_TEXT', value: '承認済' },
        executed_by: {
          type: 'USER_SELECT',
          value: [{ code: 'sato', name: 'Noboru Sato' }],
        },
        executed_by_title: { type: 'SINGLE_LINE_TEXT', value: '課長' },
        executed_at: {
          type: 'DATETIME',
          value: '2026-07-16T01:23:45.000Z',
        },
      },
    });
  });

  test('役職・実行ユーザーコードが無くても例外にせず空値で埋める', () => {
    const row = HistoryRow.buildHistoryRow(fieldCodes, {
      statusBefore: '未処理',
      statusAfter: '承認済',
      executedByCode: '',
      executedByName: '',
      executedByTitle: '',
      executedAtIso: '2026-07-16T01:23:45.000Z',
    });

    expect(row.value.executed_by.value).toEqual([]);
    expect(row.value.executed_by_title.value).toBe('');
  });
});
