(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  // triggerEventsの既定値は['edit.show'](このプラグインの元々の唯一の発動タイミング)。
  // この機能追加より前に保存された設定にはtriggerEventsキー自体が存在しないため、load()は
  // saved.triggerEventsがundefinedのケースをこの既定値にフォールバックさせ、既存ユーザーの
  // 挙動(edit.showのみで発動)を変えない。
  const DEFAULTS = {
    targetFieldCodes: [],
    triggerEvents: ['edit.show'],
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

  // getConfig()はプラグインが未設定の(あるいは何らかの理由で取得できなかった)アプリでは
  // null を返すことがあるため、saved自体がnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      targetFieldCodes: parseJsonOr(
        saved.targetFieldCodes,
        DEFAULTS.targetFieldCodes,
      ),
      triggerEvents: parseJsonOr(saved.triggerEvents, DEFAULTS.triggerEvents),
    };
  };

  const serialize = (config) => ({
    targetFieldCodes: JSON.stringify(config.targetFieldCodes),
    triggerEvents: JSON.stringify(config.triggerEvents),
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.AutoLookup = root.AutoLookup || {};
    root.AutoLookup.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
