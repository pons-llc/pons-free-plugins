(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。設定は行の複数追加を持たない単一系統(idea.md参照)なので、
  // org_lookupのようなJSON配列のシリアライズは不要で、キーごとに文字列をそのまま読み書きする。
  const DEFAULTS = {
    mode: 'zip',
    archiveAppId: '',
    jsonFieldCode: '',
    attachmentFieldCode: '',
  };

  // getConfig()はプラグインが未設定のアプリではnullを返すことがあるため、saved自体が
  // null/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      mode: saved.mode || DEFAULTS.mode,
      archiveAppId: saved.archiveAppId || DEFAULTS.archiveAppId,
      jsonFieldCode: saved.jsonFieldCode || DEFAULTS.jsonFieldCode,
      attachmentFieldCode:
        saved.attachmentFieldCode || DEFAULTS.attachmentFieldCode,
    };
  };

  const serialize = (config) => ({
    mode: config.mode,
    archiveAppId: config.archiveAppId,
    jsonFieldCode: config.jsonFieldCode,
    attachmentFieldCode: config.attachmentFieldCode,
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.DeleteBackup = root.DeleteBackup || {};
    root.DeleteBackup.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
