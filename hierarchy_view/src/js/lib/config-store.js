(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。設定が単一オブジェクトのため(判断記録.mdの3番)、
  // JSON化せずフィールドコードの文字列をそのまま保存する。
  const DEFAULTS = {
    parentFieldCode: '',
    matchFieldCode: '',
  };

  // getConfig()はプラグインが未設定の(あるいは何らかの理由で取得できなかった)アプリでは
  // null を返すことがあるため、saved自体がnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      parentFieldCode: saved.parentFieldCode || DEFAULTS.parentFieldCode,
      matchFieldCode: saved.matchFieldCode || DEFAULTS.matchFieldCode,
    };
  };

  const serialize = (config) => ({
    parentFieldCode: config.parentFieldCode,
    matchFieldCode: config.matchFieldCode,
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.HierarchyView = root.HierarchyView || {};
    root.HierarchyView.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
