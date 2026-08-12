(function (root) {
  'use strict';

  // レコードを現在のステータスごとにグループ化し、グループ単位で選んだアクションから
  // 実行対象レコードの一覧を組み立てる純粋ロジック(idea.md「対象レコードのグループ化」参照)。
  //
  // records: [{ id, revision, [statusFieldCode]: { value: 'ステータス名' }, ... }]
  // statusSettings: kintone.app.getStatus()の戻り値そのもの({ enable, states, actions })

  const currentStatusOf = (record, statusFieldCode) => {
    const field = record[statusFieldCode];
    return field ? field.value : undefined;
  };

  // レコードを現在のステータスごとにグループ化する。グループの並び順はプロセス管理の
  // ステータス順(states[status].index の昇順)。states側にステータス定義が見つからない場合
  // (通常発生しないが念のため)は末尾に回す。
  const groupRecordsByStatus = (records, statusFieldCode, statusSettings) => {
    const states = (statusSettings && statusSettings.states) || {};
    const byStatus = new Map();
    (records || []).forEach((record) => {
      const status = currentStatusOf(record, statusFieldCode);
      if (!byStatus.has(status)) {
        byStatus.set(status, []);
      }
      byStatus.get(status).push(record);
    });

    const indexOf = (status) => {
      const state = states[status];
      const index = state ? Number(state.index) : NaN;
      return Number.isNaN(index) ? Number.MAX_SAFE_INTEGER : index;
    };

    return Array.from(byStatus.entries())
      .map(([status, groupRecords]) => ({ status, records: groupRecords }))
      .sort((a, b) => indexOf(a.status) - indexOf(b.status));
  };

  // groupSelections: [{ actionName, records: [{ id, revision }] }]
  //   呼び出し側(js/bulk-approval.js)で、グループごとに「アクションが選ばれているか」
  //   「チェック済みレコードがあるか」を判定して絞り込んでから渡す想定
  //   (アクション未選択・チェック0件のグループはここへ渡す前に除外しておくこと)。
  // 戻り値: PUT /k/v1/records/status.jsonへ渡すレコード一覧 [{ id, revision, action }]
  const buildExecutionBatch = (groupSelections) =>
    (groupSelections || []).flatMap((selection) =>
      (selection.records || []).map((record) => ({
        id: record.id,
        revision: record.revision,
        action: selection.actionName,
      })),
    );

  const RecordGrouping = { groupRecordsByStatus, buildExecutionBatch };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = RecordGrouping;
  } else {
    root.BulkApproval = root.BulkApproval || {};
    root.BulkApproval.RecordGrouping = RecordGrouping;
  }
})(typeof window !== 'undefined' ? window : globalThis);
