(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する(idea.md「設定画面」参照)。

  const DEFAULTS = {
    mode: 'DROPDOWN',
    radioFieldCode: '',
    radioMappings: [],
    templates: [],
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

  // getConfig()はプラグインが未設定のアプリではnullを返すことがあるため、
  // saved自体がnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      mode: saved.mode || DEFAULTS.mode,
      radioFieldCode: saved.radioFieldCode || DEFAULTS.radioFieldCode,
      radioMappings: parseJsonOr(saved.radioMappings, DEFAULTS.radioMappings),
      templates: parseJsonOr(saved.templates, DEFAULTS.templates),
    };
  };

  const serialize = (config) => ({
    mode: config.mode,
    radioFieldCode: config.radioFieldCode,
    radioMappings: JSON.stringify(config.radioMappings),
    templates: JSON.stringify(config.templates),
  });

  const createTemplateId = () =>
    'tpl_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 8);

  const ConfigStore = { DEFAULTS, load, serialize, createTemplateId };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.TemplateInsert = root.TemplateInsert || {};
    root.TemplateInsert.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
