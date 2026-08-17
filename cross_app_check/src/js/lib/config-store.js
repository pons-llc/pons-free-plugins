(function (root) {
  'use strict';

  // プラグイン設定は1キー`config`にJSON文字列として格納する(既存プラグイン共通の作法)。
  // kintone.plugin.app.setConfig()は「値は文字列」という制約があるため、
  // ネストした設定はJSON文字列化して1キーに押し込む。
  const CONFIG_KEY = 'config';
  const SCHEMA_VERSION = 1;

  const DEFAULT_LIMITS = {
    maxBaseRecords: 5000,
    maxHistoryRows: 20,
  };

  const DEFAULT_LABELS = {
    submitted: '提出済',
    unsubmitted: '未提出',
  };

  const createBaseApp = () => ({
    appId: '',
    appName: '',
    keyFieldCode: '',
    keyFieldType: '',
    nameFieldCode: '',
    query: '',
  });

  const createTarget = () => ({
    appId: '',
    appName: '',
    label: '',
    keyFieldCode: '',
    keyFieldType: '',
    dateFieldCode: '',
    query: '',
  });

  const toStringValue = (value) =>
    value === null || value === undefined ? '' : String(value);

  const normalizeBaseApp = (raw) => {
    const base = createBaseApp();
    if (!raw || typeof raw !== 'object') {
      return base;
    }
    return {
      appId: toStringValue(raw.appId).trim(),
      appName: toStringValue(raw.appName),
      keyFieldCode: toStringValue(raw.keyFieldCode),
      keyFieldType: toStringValue(raw.keyFieldType),
      nameFieldCode: toStringValue(raw.nameFieldCode),
      query: toStringValue(raw.query),
    };
  };

  const normalizeTarget = (raw) => {
    const target = createTarget();
    if (!raw || typeof raw !== 'object') {
      return target;
    }
    return {
      appId: toStringValue(raw.appId).trim(),
      appName: toStringValue(raw.appName),
      label: toStringValue(raw.label),
      keyFieldCode: toStringValue(raw.keyFieldCode),
      keyFieldType: toStringValue(raw.keyFieldType),
      dateFieldCode: toStringValue(raw.dateFieldCode),
      query: toStringValue(raw.query),
    };
  };

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
    baseApp: createBaseApp(),
    targets: [createTarget()],
    limits: Object.assign({}, DEFAULT_LIMITS),
    labels: Object.assign({}, DEFAULT_LABELS),
  });

  const normalize = (raw) => {
    if (!raw || typeof raw !== 'object') {
      return createDefaultConfig();
    }
    const targets = Array.isArray(raw.targets)
      ? raw.targets.map(normalizeTarget)
      : [];
    return {
      schemaVersion: SCHEMA_VERSION,
      baseApp: normalizeBaseApp(raw.baseApp),
      targets: targets.length > 0 ? targets : [createTarget()],
      limits: normalizeLimits(raw.limits),
      labels: normalizeLabels(raw.labels),
    };
  };

  // kintone.plugin.app.getConfig()の戻り値(キーと文字列値のオブジェクト)から設定を復元する。
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

  // setConfig()へ渡す形(キーと文字列値のオブジェクト)へ変換する
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
    createTarget,
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
