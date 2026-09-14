(function (root) {
  'use strict';

  // OFF: サイドパネルに一切手を出さない状態(kintone標準のサイドバーの開閉もこちらでは
  // 制御しない)。レコード詳細画面の初期表示に使う(下記resolveInitialView参照。詳細画面では
  // 自作パネルがコメント欄・変更履歴の開閉ボタン等、他の画面要素に重なって隠してしまう
  // 不具合があったため、初期表示では何もしない仕様に変更した)。
  // NATIVE: kintone標準のサイドバー(コメント欄・変更履歴)を明示的に開く。
  // IFRAME: 自作パネル(モバイル版プレビュー)を表示する。
  const VIEWS = ['OFF', 'NATIVE', 'IFRAME'];

  // screenKind: 'DETAIL' | 'EDIT' | 'CREATE'。
  // レコード詳細画面(DETAIL)は、設定(config.defaultView)に関わらず常にOFFから始まる
  // (ユーザー要望「詳細画面の時だけ、サイドパネルはデフォルトでOFF」への対応)。
  // 編集画面(EDIT)・新規作成画面(CREATE)は、従来通り設定のdefaultViewに従う
  // (ユーザー要望「新規と編集のときだけデフォルトを選べるようにしたい」への対応)。
  // screenKindを省略した場合は、後方互換のため従来通りdefaultViewのみで判定する。
  const resolveInitialView = (config, screenKind) => {
    if (screenKind === 'DETAIL') {
      return 'OFF';
    }
    return config && config.defaultView === 'IFRAME' ? 'IFRAME' : 'NATIVE';
  };

  // IFRAME以外(OFF・NATIVEのいずれでも)からはIFRAMEへ切り替わる。IFRAMEからは、
  // 呼び出し側がその画面の「戻り先」として渡すoffState(通常はresolveInitialView()の結果)へ
  // 戻る。offStateを省略した場合は後方互換のためNATIVEを既定値とする。
  const toggleView = (currentView, offState = 'NATIVE') =>
    currentView === 'IFRAME' ? offState : 'IFRAME';

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
