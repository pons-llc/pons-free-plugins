(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きを行う。
  // 一覧(view)ごとに独立した表示設定を持てるよう、viewConfigs は配列としてJSON文字列で保存する
  // (gantt_chart_view/src/js/lib/config-store.js と同じ方式)。

  const DEFAULT_VIEW_UNIT = 'week';
  const DEFAULT_LAYOUT_DIRECTION = 'vertical';

  const VIEW_CONFIG_DEFAULTS = {
    viewId: '',
    viewName: '',
    titleFieldCode: '',
    startFieldCode: '',
    endFieldCode: '',
    groupFieldCode: '',
    colorFieldCode: '',
    colorOverrides: {},
    hoverFieldCodes: [],
    defaultViewUnit: DEFAULT_VIEW_UNIT,
    layoutDirection: DEFAULT_LAYOUT_DIRECTION,
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

  // 古いバージョンの保存データや部分的なオブジェクトが来ても、欠けているキーだけ既定値で補う。
  const normalizeViewConfig = (raw) => {
    const merged = Object.assign({}, VIEW_CONFIG_DEFAULTS, raw || {});
    merged.viewId =
      merged.viewId === '' || merged.viewId == null
        ? 'ALL'
        : String(merged.viewId);
    merged.hoverFieldCodes = Array.isArray(merged.hoverFieldCodes)
      ? merged.hoverFieldCodes
      : [];
    merged.colorOverrides =
      merged.colorOverrides &&
      typeof merged.colorOverrides === 'object' &&
      !Array.isArray(merged.colorOverrides)
        ? merged.colorOverrides
        : {};
    merged.defaultViewUnit =
      merged.defaultViewUnit === 'day' ? 'day' : DEFAULT_VIEW_UNIT;
    merged.layoutDirection =
      merged.layoutDirection === 'horizontal'
        ? 'horizontal'
        : DEFAULT_LAYOUT_DIRECTION;
    return merged;
  };

  // getConfig()はプラグインが未設定のアプリでは null を返すことがあるため、
  // saved自体がnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    const viewConfigs = parseJsonOr(saved.viewConfigs, []).map(
      normalizeViewConfig,
    );
    return { viewConfigs };
  };

  const serialize = (config) => ({
    viewConfigs: JSON.stringify(
      (config.viewConfigs || []).map(normalizeViewConfig),
    ),
  });

  const ConfigStore = {
    DEFAULT_VIEW_UNIT,
    DEFAULT_LAYOUT_DIRECTION,
    VIEW_CONFIG_DEFAULTS,
    normalizeViewConfig,
    load,
    serialize,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.CalendarView = root.CalendarView || {};
    root.CalendarView.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
