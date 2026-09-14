(function (root) {
  'use strict';

  // レコード画面(desktop.js)の「コメント・変更履歴」⇔「モバイル版プレビュー」の
  // 表示切り替えに関する純粋ロジック(DOM・kintone APIへの依存なし)。
  const VIEWS = ['NATIVE', 'IFRAME'];

  const resolveInitialView = (config) =>
    config && config.defaultView === 'IFRAME' ? 'IFRAME' : 'NATIVE';

  const toggleView = (currentView) =>
    currentView === 'IFRAME' ? 'NATIVE' : 'IFRAME';

  const resolveNativeSideBarState = (config) =>
    config && config.defaultNativeState === 'HISTORY' ? 'HISTORY' : 'COMMENTS';

  // 現在の表示状態から「押すと切り替わる先」を示すボタンラベルを返す。
  const resolveToggleButtonLabel = (currentView) =>
    currentView === 'IFRAME' ? 'コメント・変更履歴を表示' : 'モバイル版を表示';

  const PanelState = {
    VIEWS,
    resolveInitialView,
    toggleView,
    resolveNativeSideBarState,
    resolveToggleButtonLabel,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PanelState;
  } else {
    root.SidebarMobileView = root.SidebarMobileView || {};
    root.SidebarMobileView.PanelState = PanelState;
  }
})(typeof window !== 'undefined' ? window : globalThis);
