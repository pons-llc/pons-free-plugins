(function (root) {
  'use strict';

  // 「すべての予算を確認」ボタンを表示してよいかどうかを判定する。
  //
  // kintone.user.getGroups()の戻り値(ログインユーザーの所属グループ)のいずれかが、
  // 許可グループコード一覧に含まれていればtrue。許可グループコードが1件も設定されていない場合は、
  // 誰が所属していてもfalse(「空 = 全員許可」ではなく「空 = 誰も許可しない」が安全側のデフォルト。
  // related_record_summaryの一括集計ボタンと同じ方針)。
  //
  // これはクライアント側の表示ゲートに過ぎず、真の権限制御ではない(idea.md「グループ制限の限界」参照)。
  const isAuthorized = (groups, allowedGroupCodes) => {
    if (!allowedGroupCodes || allowedGroupCodes.length === 0) {
      return false;
    }
    return (groups || []).some((group) =>
      allowedGroupCodes.includes(group.code),
    );
  };

  const GroupAuthorization = { isAuthorized };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GroupAuthorization;
  } else {
    root.BudgetMeter = root.BudgetMeter || {};
    root.BudgetMeter.GroupAuthorization = GroupAuthorization;
  }
})(typeof window !== 'undefined' ? window : globalThis);
