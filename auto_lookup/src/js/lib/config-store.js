(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  const DEFAULTS = {
    targetFieldCodes: [],
  };

  const parseJsonOr = (raw, fallback) => {
    if (!raw) {
      return fallback;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  // getConfig()はプラグインが未設定の(あるいは何らかの理由で取得できなかった)アプリでは
  // null を返すことがあるため、saved自体がnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      targetFieldCodes: parseJsonOr(
        saved.targetFieldCodes,
        DEFAULTS.targetFieldCodes,
      ),
    };
  };

  const serialize = (config) => ({
    targetFieldCodes: JSON.stringify(config.targetFieldCodes),
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.AutoLookup = root.AutoLookup || {};
    root.AutoLookup.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
