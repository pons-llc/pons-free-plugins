(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  const DEFAULTS = {
    buttons: [],
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
      buttons: parseJsonOr(saved.buttons, DEFAULTS.buttons),
    };
  };

  const serialize = (config) => ({
    buttons: JSON.stringify(config.buttons),
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.FieldInputPanel = root.FieldInputPanel || {};
    root.FieldInputPanel.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
