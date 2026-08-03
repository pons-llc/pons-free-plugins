(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig()のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。setConfig()の値はキーごとに文字列のみ保存できるため、
  // 真偽値(enableReact)は'true'/'false'文字列として保存する。
  const EXECUTION_MODES = ['blob', 'data'];
  const DEFAULT_EXECUTION_MODE = 'blob';

  const DEFAULTS = {
    htmlFieldCode: '',
    cssFieldCode: '',
    jsFieldCode: '',
    executionMode: DEFAULT_EXECUTION_MODE,
    enableReact: false,
  };

  const load = (rawConfig) => {
    if (!rawConfig) {
      return { ...DEFAULTS };
    }
    return {
      htmlFieldCode: rawConfig.htmlFieldCode || '',
      cssFieldCode: rawConfig.cssFieldCode || '',
      jsFieldCode: rawConfig.jsFieldCode || '',
      executionMode: EXECUTION_MODES.includes(rawConfig.executionMode)
        ? rawConfig.executionMode
        : DEFAULT_EXECUTION_MODE,
      enableReact: rawConfig.enableReact === 'true',
    };
  };

  const serialize = (config) => ({
    htmlFieldCode: config.htmlFieldCode || '',
    cssFieldCode: config.cssFieldCode || '',
    jsFieldCode: config.jsFieldCode || '',
    executionMode: EXECUTION_MODES.includes(config.executionMode)
      ? config.executionMode
      : DEFAULT_EXECUTION_MODE,
    enableReact: config.enableReact ? 'true' : 'false',
  });

  const ConfigStore = { load, serialize, DEFAULTS, EXECUTION_MODES };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.GenaiAppShare = root.GenaiAppShare || {};
    root.GenaiAppShare.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
