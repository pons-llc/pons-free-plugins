(function (root) {
  'use strict';

  // 「どのアプリをどう突き合わせるか」はレコード単位の設定([[definition-store]])に持つ。
  // プラグイン設定に残すのは、そのアプリ全体で共通の**既定値・上限**だけ。
  //
  // kintone.plugin.app.setConfig()は「値は文字列」という制約があるため、
  // ネストした設定はJSON文字列化して1キーに押し込む(既存プラグイン共通の作法)。
  const CONFIG_KEY = 'config';
  const SCHEMA_VERSION = 2;

  const DEFAULT_LIMITS = {
    maxBaseRecords: 5000,
    maxHistoryRows: 20,
  };

  const DEFAULT_LABELS = {
    submitted: '提出済',
    unsubmitted: '未提出',
  };

  const toStringValue = (value) =>
    value === null || value === undefined ? '' : String(value);

  const normalizeLimits = (raw) => {
    const source = raw && typeof raw === 'object' ? raw : {};
    const pickPositiveInt = (value, fallback) => {
      const num = Number(value);
      return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback;
    };
    return {
      maxBaseRecords: pickPositiveInt(
        source.maxBaseRecords,
        DEFAULT_LIMITS.maxBaseRecords,
      ),
      maxHistoryRows: pickPositiveInt(
        source.maxHistoryRows,
        DEFAULT_LIMITS.maxHistoryRows,
      ),
    };
  };

  const normalizeLabels = (raw) => {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      submitted: toStringValue(source.submitted) || DEFAULT_LABELS.submitted,
      unsubmitted:
        toStringValue(source.unsubmitted) || DEFAULT_LABELS.unsubmitted,
    };
  };

  const createDefaultConfig = () => ({
    schemaVersion: SCHEMA_VERSION,
    limits: Object.assign({}, DEFAULT_LIMITS),
    labels: Object.assign({}, DEFAULT_LABELS),
  });

  const normalize = (raw) => {
    if (!raw || typeof raw !== 'object') {
      return createDefaultConfig();
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      limits: normalizeLimits(raw.limits),
      labels: normalizeLabels(raw.labels),
    };
  };

  // 未設定・壊れたJSONのときは既定値を返し、設定画面が必ず開けるようにする。
  const load = (pluginConfig) => {
    if (!pluginConfig || typeof pluginConfig !== 'object') {
      return createDefaultConfig();
    }
    const rawText = pluginConfig[CONFIG_KEY];
    if (!rawText) {
      return createDefaultConfig();
    }
    try {
      return normalize(JSON.parse(rawText));
    } catch {
      return createDefaultConfig();
    }
  };

  const serialize = (config) => {
    const obj = {};
    obj[CONFIG_KEY] = JSON.stringify(normalize(config));
    return obj;
  };

  const ConfigStore = {
    CONFIG_KEY,
    SCHEMA_VERSION,
    DEFAULT_LIMITS,
    DEFAULT_LABELS,
    createDefaultConfig,
    normalize,
    load,
    serialize,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.CrossAppCheck = root.CrossAppCheck || {};
    root.CrossAppCheck.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
