(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig()のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。保存する内容は「実際に作成されたサブテーブル・内包フィールドの
  // フィールドコード一式」のみ(idea.md「設定画面」)。

  const DEFAULTS = { fieldCodes: null };

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

  // getConfig()はプラグインが未設定のアプリではnullを返すことがあるため、saved自体が
  // null/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      fieldCodes: parseJsonOr(saved.fieldCodes, DEFAULTS.fieldCodes),
    };
  };

  const serialize = (config) => ({
    fieldCodes: JSON.stringify(config.fieldCodes || null),
  });

  const isConfigured = (config) =>
    !!(config && config.fieldCodes && config.fieldCodes.table);

  const ConfigStore = { DEFAULTS, load, serialize, isConfigured };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.ApprovalHistory = root.ApprovalHistory || {};
    root.ApprovalHistory.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
