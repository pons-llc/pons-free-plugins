(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  const DEFAULTS = {
    rows: [],
    trigger: 'CHANGE',
    bulkEnabled: false,
    bulkGroupCodes: [],
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
      rows: parseJsonOr(saved.rows, DEFAULTS.rows),
      trigger: saved.trigger === 'SUBMIT' ? 'SUBMIT' : DEFAULTS.trigger,
      bulkEnabled: saved.bulkEnabled === 'true',
      bulkGroupCodes: parseJsonOr(
        saved.bulkGroupCodes,
        DEFAULTS.bulkGroupCodes,
      ),
    };
  };

  const serialize = (config) => ({
    rows: JSON.stringify(config.rows),
    trigger: config.trigger === 'SUBMIT' ? 'SUBMIT' : 'CHANGE',
    bulkEnabled: String(!!config.bulkEnabled),
    bulkGroupCodes: JSON.stringify(config.bulkGroupCodes || []),
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.TimeBandAggregator = root.TimeBandAggregator || {};
    root.TimeBandAggregator.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
