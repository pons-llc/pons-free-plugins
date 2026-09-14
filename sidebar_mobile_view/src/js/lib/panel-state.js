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
  // hasNativeSideBar: このレコード画面でkintone標準のサイドバー(コメント欄・変更履歴)が
  // 利用できるか(レコード詳細・編集画面ではtrue、新規作成画面ではfalse。showSideBar()自体が
  // 新規作成画面では利用できないAPIのため)。falseの画面には「コメント・変更履歴に戻す」という
  // 選択肢自体が存在しないため、単純な開閉ラベルにする。
  const resolveToggleButtonLabel = (currentView, hasNativeSideBar = true) => {
    if (currentView !== 'IFRAME') {
      return 'モバイル版を表示';
    }
    return hasNativeSideBar ? 'コメント・変更履歴を表示' : 'モバイル版を閉じる';
  };

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
