(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。APIトークン自体はここに保存しない(setProxyConfig()側の
  // 秘匿領域にのみ保存され、JavaScriptから読み出せないため)。apiTokenConfiguredは
  // 「1度でも保存されたことがあるか」の真偽値フラグのみを持つ(idea.md参照)。
  const DEFAULTS = {
    lookups: [],
    apiTokenConfigured: false,
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
      lookups: parseJsonOr(saved.lookups, DEFAULTS.lookups),
      apiTokenConfigured: saved.apiTokenConfigured === 'true',
    };
  };

  const serialize = (config) => ({
    lookups: JSON.stringify(config.lookups),
    apiTokenConfigured: String(!!config.apiTokenConfigured),
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.BizCodeSearch = root.BizCodeSearch || {};
    root.BizCodeSearch.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
