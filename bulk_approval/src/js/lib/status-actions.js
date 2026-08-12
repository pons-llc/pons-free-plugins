(function (root) {
  'use strict';

  // kintone.app.getStatus()で取得したプロセス管理の設定(states/actions)から、
  // 「現在のステータスから実行できるアクション」「そのアクションの実行にassignee指定が
  // 必須かどうか」を判定する純粋ロジック(idea.md「取得・参照するプロセス管理情報」参照)。

  // actions: kintone.app.getStatus()のactions配列({name, from, to, filterCond, type, ...})
  // statusName: レコードの現在のステータス名(ステータスフィールドのvalue)
  const listActionsForStatus = (actions, statusName) =>
    (actions || []).filter((action) => action.from === statusName);

  // states: kintone.app.getStatus()のstatesオブジェクト({ステータス名: {index, assignee, ...}})
  // toStatusName: アクション実行後のステータス名(action.to)
  //
  // REST API「複数のレコードのステータスを更新する」の必須条件をそのまま判定する。
  //   - 遷移先ステータスの作業者が「次のユーザーから作業者を選択(ONE)」で、かつ選択可能な
  //     ユーザーが1人以上いる場合
  //   - 遷移先が最初のステータス(index === "0")で、かつ作業者が設定されている場合
  // (「最初のステータスに戻す」ケースは、type問わずentitiesが1人以上いれば必須になる)
  const isAssigneeRequired = (states, toStatusName) => {
    const toState = (states || {})[toStatusName];
    if (!toState || !toState.assignee) {
      return false;
    }
    const entities = toState.assignee.entities || [];
    if (entities.length === 0) {
      return false;
    }
    if (toState.assignee.type === 'ONE') {
      return true;
    }
    return String(toState.index) === '0';
  };

  // 指定したステータスから実行できる(かつassignee指定が不要な)アクション名の一覧を返す。
  // 一括承認のモーダルはステータスごとにグループ分けして表示するため、グループ単位で
  // アクション候補を決められる(idea.md「対象レコードのグループ化」参照)。
  const listExecutableActionNames = (statusSettings, statusName) => {
    const actions = (statusSettings && statusSettings.actions) || [];
    const states = (statusSettings && statusSettings.states) || {};
    return listActionsForStatus(actions, statusName)
      .filter((action) => !isAssigneeRequired(states, action.to))
      .map((action) => action.name);
  };

  const StatusActions = {
    listActionsForStatus,
    isAssigneeRequired,
    listExecutableActionNames,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatusActions;
  } else {
    root.BulkApproval = root.BulkApproval || {};
    root.BulkApproval.StatusActions = StatusActions;
  }
})(typeof window !== 'undefined' ? window : globalThis);
