(function (root) {
  'use strict';

  const StatusActions =
    typeof module !== 'undefined' && module.exports
      ? require('./status-actions')
      : root.BulkApproval.StatusActions;

  // モーダルでチェックボックス選択されたレコードを、選んだアクション名に対して
  // 「実行できる(eligible)」「実行できない(ineligible、理由付き)」に振り分ける純粋ロジック
  // (idea.md「アクション選択とレコードの振り分け」参照)。
  //
  // records: [{ id, revision, [statusFieldCode]: { value: 'ステータス名' }, ... }]
  // statusSettings: kintone.app.getStatus()の戻り値そのもの({ enable, states, actions })

  const currentStatusOf = (record, statusFieldCode) => {
    const field = record[statusFieldCode];
    return field ? field.value : undefined;
  };

  // 選択中レコードの現在のステータスから実行できる(かつassignee指定が不要な)アクション名の
  // 和集合を返す。順序はstatusSettings.actionsの並び順(=プロセス管理設定画面の並び順)を保つ。
  const collectAvailableActionNames = (
    records,
    statusFieldCode,
    statusSettings,
  ) => {
    const actions = (statusSettings && statusSettings.actions) || [];
    const states = (statusSettings && statusSettings.states) || {};
    const result = [];
    actions.forEach((action) => {
      if (result.includes(action.name)) {
        return;
      }
      if (StatusActions.isAssigneeRequired(states, action.to)) {
        return;
      }
      const applies = (records || []).some(
        (record) => currentStatusOf(record, statusFieldCode) === action.from,
      );
      if (applies) {
        result.push(action.name);
      }
    });
    return result;
  };

  // actionName: 実行するアクション名(ドロップダウンで選択された値)
  // 戻り値: { eligible: [{ id, revision, action }], ineligible: [{ id, reason }] }
  //   reason: 'STATUS_MISMATCH'(現在のステータスからこのアクション名を実行できない)
  //         | 'ASSIGNEE_REQUIRED'(実行はできるが次の作業者の選択が必須で自動実行の対象外)
  const partitionForAction = (
    records,
    statusFieldCode,
    actionName,
    statusSettings,
  ) => {
    const actions = (statusSettings && statusSettings.actions) || [];
    const states = (statusSettings && statusSettings.states) || {};
    const eligible = [];
    const ineligible = [];

    (records || []).forEach((record) => {
      const currentStatus = currentStatusOf(record, statusFieldCode);
      const action = actions.find(
        (a) => a.name === actionName && a.from === currentStatus,
      );
      if (!action) {
        ineligible.push({ id: record.id, reason: 'STATUS_MISMATCH' });
        return;
      }
      if (StatusActions.isAssigneeRequired(states, action.to)) {
        ineligible.push({ id: record.id, reason: 'ASSIGNEE_REQUIRED' });
        return;
      }
      eligible.push({
        id: record.id,
        revision: record.revision,
        action: actionName,
      });
    });

    return { eligible, ineligible };
  };

  const SelectionPartitioner = {
    collectAvailableActionNames,
    partitionForAction,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelectionPartitioner;
  } else {
    root.BulkApproval = root.BulkApproval || {};
    root.BulkApproval.SelectionPartitioner = SelectionPartitioner;
  }
})(typeof window !== 'undefined' ? window : globalThis);
