(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。パスフレーズ自体はこのプラグインの設定に一切含まれない
  // (どこにも保存しない設計、idea.md参照)。
  const DEFAULTS = {
    targetFields: [],
    spaceElementId: '',
    minPassphraseLength: 8,
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

  const parseIntOr = (raw, fallback) => {
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  // getConfig()はプラグインが未設定のアプリではnullを返すことがあるため、saved自体がnull/undefinedでも
  // 例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      targetFields: parseJsonOr(saved.targetFields, DEFAULTS.targetFields),
      spaceElementId: saved.spaceElementId || DEFAULTS.spaceElementId,
      minPassphraseLength: parseIntOr(
        saved.minPassphraseLength,
        DEFAULTS.minPassphraseLength,
      ),
    };
  };

  const serialize = (config) => ({
    targetFields: JSON.stringify(config.targetFields),
    spaceElementId: config.spaceElementId,
    minPassphraseLength: String(config.minPassphraseLength),
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.FieldEncryption = root.FieldEncryption || {};
    root.FieldEncryption.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
