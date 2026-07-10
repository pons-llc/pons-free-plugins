(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig()のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。

  const DEFAULTS = {
    sourceAppId: '',
    subtableFieldCode: '',
    conditions: [],
    fieldMappings: [],
    maxRecords: 300,
    buttonLabel: '別アプリのレコードを取り込む',
  };

  const parseJsonOr = (raw, fallback) => {
    if (!raw) {
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch {
      return fallback;
    }
  };

  // getConfig()はプラグイン未設定のアプリではnullを返すことがあるため、
  // savedがnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    const maxRecords = Number(saved.maxRecords);
    return {
      sourceAppId: saved.sourceAppId || DEFAULTS.sourceAppId,
      subtableFieldCode: saved.subtableFieldCode || DEFAULTS.subtableFieldCode,
      conditions: parseJsonOr(saved.conditions, DEFAULTS.conditions),
      fieldMappings: parseJsonOr(saved.fieldMappings, DEFAULTS.fieldMappings),
      maxRecords:
        Number.isFinite(maxRecords) && maxRecords > 0
          ? maxRecords
          : DEFAULTS.maxRecords,
      buttonLabel: saved.buttonLabel || DEFAULTS.buttonLabel,
    };
  };

  const serialize = (config) => ({
    sourceAppId: config.sourceAppId,
    subtableFieldCode: config.subtableFieldCode,
    conditions: JSON.stringify(config.conditions),
    fieldMappings: JSON.stringify(config.fieldMappings),
    maxRecords: String(config.maxRecords),
    buttonLabel: config.buttonLabel,
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.RecordsToSubtable = root.RecordsToSubtable || {};
    root.RecordsToSubtable.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
