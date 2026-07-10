(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きを行う。
  // 一覧(view)ごとに独立した表示設定を持てるよう、viewConfigs は配列としてJSON文字列で保存する。

  const DEFAULT_MAX_RECORDS = 2000;

  const VIEW_CONFIG_DEFAULTS = {
    viewId: '',
    viewName: '',
    startFieldCode: '',
    endFieldCode: '',
    barFieldCodes: [],
    colorFieldCode: '',
    groupFieldCode: '',
    allowedGroupFieldCodes: [],
    enableFullFetch: true,
    maxRecords: DEFAULT_MAX_RECORDS,
  };

  const parseJsonOr = (raw, fallback) => {
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

  // 古いバージョンの保存データや部分的なオブジェクトが来ても、欠けているキーだけ既定値で補う
  // (画面クラッシュを避けるため、フィールドが1つ欠けているだけで全体を捨てない)。
  const normalizeViewConfig = (raw) =>
    Object.assign({}, VIEW_CONFIG_DEFAULTS, raw || {});

  // getConfig()はプラグインが未設定の(あるいは何らかの理由で取得できなかった)アプリでは
  // null を返すことがあるため、saved自体がnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    const viewConfigs = parseJsonOr(saved.viewConfigs, []).map(
      normalizeViewConfig,
    );
    return { viewConfigs };
  };

  const serialize = (config) => ({
    viewConfigs: JSON.stringify(config.viewConfigs || []),
  });

  const ConfigStore = {
    DEFAULT_MAX_RECORDS,
    VIEW_CONFIG_DEFAULTS,
    normalizeViewConfig,
    load,
    serialize,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.GanttChartView = root.GanttChartView || {};
    root.GanttChartView.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
