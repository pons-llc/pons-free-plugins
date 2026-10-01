(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig()のペイロード(キーごとに文字列)の読み書き。
  // - fieldCodes: 実際に作成された指摘履歴テーブル・内包フィールドのフィールドコード一式
  // - targetFields: 指摘できるフィールドのフィールドコード配列(空配列 = すべて)

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

  // getConfig()は未設定のアプリではnullを返すことがあるため、null/undefinedでも既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    const targetFields = parseJsonOr(saved.targetFields, []);
    return {
      fieldCodes: parseJsonOr(saved.fieldCodes, null),
      targetFields: Array.isArray(targetFields)
        ? targetFields.filter((c) => typeof c === 'string')
        : [],
    };
  };

  const serialize = (config) => ({
    fieldCodes: JSON.stringify(config.fieldCodes || null),
    targetFields: JSON.stringify(config.targetFields || []),
  });

  const isConfigured = (config) =>
    !!(config && config.fieldCodes && config.fieldCodes.table);

  const ConfigStore = { load, serialize, isConfigured };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.RecordReview = root.RecordReview || {};
    root.RecordReview.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
