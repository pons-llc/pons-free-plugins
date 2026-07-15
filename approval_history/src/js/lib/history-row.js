(function (root) {
  'use strict';

  // approval-table-spec.jsのfieldCodesと、収集済みの値からサブテーブルに追記する1行分の
  // 行オブジェクトを組み立てる(kintoneのテーブルへ行を追加する形式。フィールドの値を書き換える
  // 際は各フィールドにtypeの指定が必要。overview/field-types「テーブルを操作する際の注意事項」参照)。
  const buildHistoryRow = (
    fieldCodes,
    {
      statusBefore,
      statusAfter,
      executedByCode,
      executedByName,
      executedByTitle,
      executedAtIso,
    },
  ) => ({
    value: {
      [fieldCodes.statusBefore]: {
        type: 'SINGLE_LINE_TEXT',
        value: statusBefore || '',
      },
      [fieldCodes.statusAfter]: {
        type: 'SINGLE_LINE_TEXT',
        value: statusAfter || '',
      },
      [fieldCodes.executedBy]: {
        type: 'USER_SELECT',
        value: executedByCode
          ? [{ code: executedByCode, name: executedByName || '' }]
          : [],
      },
      [fieldCodes.executedByTitle]: {
        type: 'SINGLE_LINE_TEXT',
        value: executedByTitle || '',
      },
      [fieldCodes.executedAt]: {
        type: 'DATETIME',
        value: executedAtIso || '',
      },
    },
  });

  const HistoryRow = { buildHistoryRow };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HistoryRow;
  } else {
    root.ApprovalHistory = root.ApprovalHistory || {};
    root.ApprovalHistory.HistoryRow = HistoryRow;
  }
})(typeof window !== 'undefined' ? window : globalThis);
