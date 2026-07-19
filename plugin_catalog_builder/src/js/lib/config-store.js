(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  const DEFAULTS = {
    aiSearchEnabled: false,
    syncGroupCodes: [],
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

  // getConfig()はプラグインが未設定のアプリではnullを返すことがあるため、saved自体がnull/undefinedでも
  // 例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      aiSearchEnabled: saved.aiSearchEnabled === 'true',
      syncGroupCodes: parseJsonOr(
        saved.syncGroupCodes,
        DEFAULTS.syncGroupCodes,
      ),
    };
  };

  const serialize = (config) => ({
    aiSearchEnabled: String(!!config.aiSearchEnabled),
    syncGroupCodes: JSON.stringify(config.syncGroupCodes || []),
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.PluginCatalogBuilder = root.PluginCatalogBuilder || {};
    root.PluginCatalogBuilder.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
