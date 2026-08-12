(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig()のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  const DEFAULTS = {
    displayFieldCodes: [],
  };

  const parseArray = (raw) => {
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const load = (rawConfig) => {
    if (!rawConfig) {
      return { displayFieldCodes: [] };
    }
    return {
      displayFieldCodes: parseArray(rawConfig.displayFieldCodes),
    };
  };

  const serialize = (config) => ({
    displayFieldCodes: JSON.stringify(
      Array.isArray(config.displayFieldCodes) ? config.displayFieldCodes : [],
    ),
  });

  const ConfigStore = { load, serialize, DEFAULTS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.BulkApproval = root.BulkApproval || {};
    root.BulkApproval.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
