(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  const DEFAULTS = {
    subtableCode: '',
    destinationAppId: '',
    fieldMappings: [],
    updateKey: { subtableColumnCode: '', destinationFieldCode: '' },
    condition: { type: 'group', conditionOperator: 'AND', children: [] },
    triggerOnSubmit: true,
    triggerOnManual: false,
    manualSpaceElementId: '',
    successActionEnabled: false,
    successActionFieldCode: '',
    successActionValue: '',
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

  const parseBoolOr = (raw, fallback) => {
    if (raw === undefined || raw === null || raw === '') {
      return fallback;
    }
    return raw === 'true' || raw === true;
  };

  // getConfig()はプラグインが未設定の(あるいは何らかの理由で取得できなかった)アプリでは
  // null を返すことがあるため、saved自体がnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      subtableCode: saved.subtableCode || DEFAULTS.subtableCode,
      destinationAppId: saved.destinationAppId || DEFAULTS.destinationAppId,
      fieldMappings: parseJsonOr(saved.fieldMappings, DEFAULTS.fieldMappings),
      updateKey: parseJsonOr(saved.updateKey, DEFAULTS.updateKey),
      condition: parseJsonOr(saved.condition, DEFAULTS.condition),
      triggerOnSubmit: parseBoolOr(
        saved.triggerOnSubmit,
        DEFAULTS.triggerOnSubmit,
      ),
      triggerOnManual: parseBoolOr(
        saved.triggerOnManual,
        DEFAULTS.triggerOnManual,
      ),
      manualSpaceElementId:
        saved.manualSpaceElementId || DEFAULTS.manualSpaceElementId,
      successActionEnabled: parseBoolOr(
        saved.successActionEnabled,
        DEFAULTS.successActionEnabled,
      ),
      successActionFieldCode:
        saved.successActionFieldCode || DEFAULTS.successActionFieldCode,
      successActionValue:
        saved.successActionValue || DEFAULTS.successActionValue,
    };
  };

  const serialize = (config) => ({
    subtableCode: config.subtableCode,
    destinationAppId: config.destinationAppId,
    fieldMappings: JSON.stringify(config.fieldMappings),
    updateKey: JSON.stringify(config.updateKey),
    condition: JSON.stringify(config.condition),
    triggerOnSubmit: String(config.triggerOnSubmit),
    triggerOnManual: String(config.triggerOnManual),
    manualSpaceElementId: config.manualSpaceElementId,
    successActionEnabled: String(config.successActionEnabled),
    successActionFieldCode: config.successActionFieldCode,
    successActionValue: config.successActionValue,
  });

  // 保存・手動転送を実行可能な最低限の設定が揃っているかどうか。
  // 揃っていない場合、desktop.js側は何もせず抜ける(未設定アプリで画面をクラッシュさせない)。
  const isComplete = (config) =>
    Boolean(
      config.subtableCode &&
      config.destinationAppId &&
      config.fieldMappings &&
      config.fieldMappings.length > 0 &&
      config.updateKey &&
      config.updateKey.subtableColumnCode &&
      config.updateKey.destinationFieldCode,
    );

  const ConfigStore = { DEFAULTS, load, serialize, isComplete };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.SubtableCrossAppInsert = root.SubtableCrossAppInsert || {};
    root.SubtableCrossAppInsert.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
