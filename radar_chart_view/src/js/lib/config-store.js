(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。アプリ全体で1つの設定を持つ(一覧ごとの配列ではない)。

  const DEFAULT_SCALE_DIVISIONS = 5;
  const DEFAULT_MAX_RECORDS = 2000;
  const DEFAULT_TITLE = 'レーダーチャート';

  const DEFAULTS = {
    groupingType: 'record',
    groupingFieldCode: '',
    axisFieldCodes: [],
    scaleDivisions: DEFAULT_SCALE_DIVISIONS,
    title: DEFAULT_TITLE,
    badgeFieldCodes: [],
    maxRecords: DEFAULT_MAX_RECORDS,
  };

  const parseJsonArrayOr = (raw, fallback) => {
    if (!raw) {
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const parseIntOr = (raw, fallback) => {
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  // getConfig()はプラグインが未設定の(あるいは何らかの理由で取得できなかった)アプリでは
  // null を返すことがあるため、saved自体がnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      groupingType: saved.groupingType === 'field' ? 'field' : 'record',
      groupingFieldCode: saved.groupingFieldCode || '',
      axisFieldCodes: parseJsonArrayOr(
        saved.axisFieldCodes,
        DEFAULTS.axisFieldCodes,
      ),
      scaleDivisions: parseIntOr(saved.scaleDivisions, DEFAULT_SCALE_DIVISIONS),
      title: saved.title || DEFAULT_TITLE,
      badgeFieldCodes: parseJsonArrayOr(
        saved.badgeFieldCodes,
        DEFAULTS.badgeFieldCodes,
      ),
      maxRecords: parseIntOr(saved.maxRecords, DEFAULT_MAX_RECORDS),
    };
  };

  const serialize = (config) => ({
    groupingType: config.groupingType === 'field' ? 'field' : 'record',
    groupingFieldCode: config.groupingFieldCode || '',
    axisFieldCodes: JSON.stringify(config.axisFieldCodes || []),
    scaleDivisions: String(
      parseIntOr(config.scaleDivisions, DEFAULT_SCALE_DIVISIONS),
    ),
    title: config.title || DEFAULT_TITLE,
    badgeFieldCodes: JSON.stringify(config.badgeFieldCodes || []),
    maxRecords: String(parseIntOr(config.maxRecords, DEFAULT_MAX_RECORDS)),
  });

  const ConfigStore = {
    DEFAULTS,
    DEFAULT_SCALE_DIVISIONS,
    DEFAULT_MAX_RECORDS,
    DEFAULT_TITLE,
    load,
    serialize,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.RadarChartView = root.RadarChartView || {};
    root.RadarChartView.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
