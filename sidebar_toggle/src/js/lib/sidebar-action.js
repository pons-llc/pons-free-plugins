(function (root) {
  'use strict';

  // 一致したルール(またはルール無し=null)から、kintone.app.record.showSideBar()に渡す
  // state引数を組み立てる。ルールが無い場合はnullを返し、呼び出し側は何もしない
  // (kintone既定の表示のまま、idea.mdの「発動する画面・タイミング」参照)。
  const ACTION_TO_STATE = {
    CLOSED: 'CLOSED',
    OPEN_COMMENTS: 'COMMENTS',
    OPEN_HISTORY: 'HISTORY',
  };

  const resolveShowSideBarState = (matchedRule) => {
    if (!matchedRule) {
      return null;
    }
    return ACTION_TO_STATE[matchedRule.action] || null;
  };

  const SidebarAction = { ACTION_TO_STATE, resolveShowSideBarState };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SidebarAction;
  } else {
    root.SidebarToggle = root.SidebarToggle || {};
    root.SidebarToggle.SidebarAction = SidebarAction;
  }
})(typeof window !== 'undefined' ? window : globalThis);
