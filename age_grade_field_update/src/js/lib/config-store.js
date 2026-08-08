(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig()のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  const DEFAULTS = {
    targetFieldCode: '',
    query: '',
    groupCodes: [],
  };

  const load = (rawConfig) => {
    if (!rawConfig) {
      return { ...DEFAULTS, groupCodes: [] };
    }
    let groupCodes = [];
    try {
      const parsed = rawConfig.groupCodes
        ? JSON.parse(rawConfig.groupCodes)
        : [];
      groupCodes = Array.isArray(parsed) ? parsed : [];
    } catch {
      groupCodes = [];
    }
    return {
      targetFieldCode: rawConfig.targetFieldCode || '',
      query: rawConfig.query || '',
      groupCodes,
    };
  };

  const serialize = (config) => ({
    targetFieldCode: config.targetFieldCode || '',
    query: config.query || '',
    groupCodes: JSON.stringify(
      Array.isArray(config.groupCodes) ? config.groupCodes : [],
    ),
  });

  const ConfigStore = { load, serialize, DEFAULTS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.AgeGradeFieldUpdate = root.AgeGradeFieldUpdate || {};
    root.AgeGradeFieldUpdate.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
