(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  const DEFAULTS = {
    defaultView: 'NATIVE', // 画面表示時の既定表示('NATIVE'=コメント・変更履歴 / 'IFRAME'=モバイル版)
    defaultNativeState: 'COMMENTS', // NATIVE表示時にコメント/変更履歴のどちらを開くか
    panelWidth: 400, // カスタムパネル(モバイル版iframe)の幅(px)
    targetAppId: '', // モバイル版URLに使うアプリID。空文字なら実行時にkintone.app.getId()を使う
  };

  const toPositiveInt = (raw, fallback) => {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  // getConfig()はプラグインが未設定の(あるいは何らかの理由で取得できなかった)アプリでは
  // null を返すことがあるため、saved自体がnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      defaultView:
        saved.defaultView === 'IFRAME' ? 'IFRAME' : DEFAULTS.defaultView,
      defaultNativeState:
        saved.defaultNativeState === 'HISTORY'
          ? 'HISTORY'
          : DEFAULTS.defaultNativeState,
      panelWidth: toPositiveInt(saved.panelWidth, DEFAULTS.panelWidth),
      targetAppId:
        typeof saved.targetAppId === 'string'
          ? saved.targetAppId
          : DEFAULTS.targetAppId,
    };
  };

  const serialize = (config) => ({
    defaultView: config.defaultView,
    defaultNativeState: config.defaultNativeState,
    panelWidth: String(config.panelWidth),
    targetAppId: config.targetAppId || '',
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.SidebarMobileView = root.SidebarMobileView || {};
    root.SidebarMobileView.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
