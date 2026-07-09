(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値(令和2019年〜など)を管理する。
  const DEFAULTS = {
    fiscalYearDateSource: 'CREATED_TIME',
    fiscalYearDateField: '',
    eraTable: [{ code: 'R', label: '令和', startYear: 2019 }],
    segments: [],
    numberFormat: { separator: '-', sequenceDigits: 4 },
    numberFieldCode: '',
    counterAppId: '',
    bulkNumberingGroupCode: '',
  };

  const parseJsonOr = (raw, fallback) => {
    if (!raw) {
      return fallback;
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  };

  // getConfig()はプラグインが未設定の(あるいは何らかの理由で取得できなかった)アプリでは
  // null を返すことがあるため、saved自体がnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      fiscalYearDateSource: saved.fiscalYearDateSource || DEFAULTS.fiscalYearDateSource,
      fiscalYearDateField: saved.fiscalYearDateField || DEFAULTS.fiscalYearDateField,
      eraTable: parseJsonOr(saved.eraTable, DEFAULTS.eraTable),
      segments: parseJsonOr(saved.segments, DEFAULTS.segments),
      numberFormat: parseJsonOr(saved.numberFormat, DEFAULTS.numberFormat),
      numberFieldCode: saved.numberFieldCode || DEFAULTS.numberFieldCode,
      counterAppId: saved.counterAppId || DEFAULTS.counterAppId,
      bulkNumberingGroupCode:
        saved.bulkNumberingGroupCode || DEFAULTS.bulkNumberingGroupCode,
    };
  };

  const serialize = (config) => ({
    fiscalYearDateSource: config.fiscalYearDateSource,
    fiscalYearDateField: config.fiscalYearDateField,
    eraTable: JSON.stringify(config.eraTable),
    segments: JSON.stringify(config.segments),
    numberFormat: JSON.stringify(config.numberFormat),
    numberFieldCode: config.numberFieldCode,
    counterAppId: config.counterAppId,
    bulkNumberingGroupCode: config.bulkNumberingGroupCode,
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.FiscalYearNumbering = root.FiscalYearNumbering || {};
    root.FiscalYearNumbering.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
