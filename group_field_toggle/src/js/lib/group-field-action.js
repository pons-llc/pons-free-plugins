(function (root) {
  'use strict';

  // 一致したルール(またはルール無し=null)から、kintone.app.record.setGroupFieldOpen()に渡す
  // isOpen(真偽値)を組み立てる。ルールが無い場合はnullを返し、呼び出し側は何もしない
  // (kintone既定の開閉状態のまま、idea.mdの「発動する画面・タイミング」参照)。
  const ACTION_TO_IS_OPEN = {
    OPEN: true,
    CLOSED: false,
  };

  const resolveIsOpen = (matchedRule) => {
    if (!matchedRule || !(matchedRule.action in ACTION_TO_IS_OPEN)) {
      return null;
    }
    return ACTION_TO_IS_OPEN[matchedRule.action];
  };

  const GroupFieldAction = { ACTION_TO_IS_OPEN, resolveIsOpen };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GroupFieldAction;
  } else {
    root.GroupFieldToggle = root.GroupFieldToggle || {};
    root.GroupFieldToggle.GroupFieldAction = GroupFieldAction;
  }
})(typeof window !== 'undefined' ? window : globalThis);
