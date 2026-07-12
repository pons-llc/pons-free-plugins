(function (root) {
  'use strict';

  // 一括実行ボタンの表示可否を判定する。kintone.user.getGroups()が返すグループコード配列と、
  // 設定画面で指定した許可グループコード配列を突き合わせるだけの純粋関数。
  // 真の権限制御ではない(ボタン表示の出し分けに過ぎない)ことについてはsecurity-checklist.md参照。
  const isAuthorized = (userGroupCodes, allowedGroupCodes) => {
    if (!Array.isArray(allowedGroupCodes) || allowedGroupCodes.length === 0) {
      return false;
    }
    return (userGroupCodes || []).some((code) =>
      allowedGroupCodes.includes(code),
    );
  };

  // 設定画面のカンマ区切り入力("code1, code2,,code3")をトリム済みの配列に変換する。
  const parseGroupCodesInput = (raw) =>
    (raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  const GroupPermission = { isAuthorized, parseGroupCodesInput };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GroupPermission;
  } else {
    root.TimeBandAggregator = root.TimeBandAggregator || {};
    root.TimeBandAggregator.GroupPermission = GroupPermission;
  }
})(typeof window !== 'undefined' ? window : globalThis);
