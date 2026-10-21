(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書き。
  const DEFAULTS = {
    completeStatus: '完了',
  };

  // ステータス名の上限(プロセス管理の設定を変更するAPI: states.<name>.name は64文字以内)。
  const MAX_STATUS_LENGTH = 64;

  // getConfig()は未設定のアプリでは空オブジェクト(またはnull)を返すため既定値で補う。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      completeStatus:
        typeof saved.completeStatus === 'string' && saved.completeStatus
          ? saved.completeStatus
          : DEFAULTS.completeStatus,
    };
  };

  const validate = (config) => {
    const errors = [];
    const status = String(config.completeStatus || '').trim();
    if (!status) {
      errors.push('完了ステータス名を入力してください。');
    } else if (status.length > MAX_STATUS_LENGTH) {
      errors.push(
        `完了ステータス名は${MAX_STATUS_LENGTH}文字以内で入力してください。`,
      );
    }
    return errors;
  };

  const serialize = (config) => ({
    completeStatus: String(config.completeStatus).trim(),
  });

  const ConfigStore = { DEFAULTS, load, validate, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.AppSettingsRequest = root.AppSettingsRequest || {};
    root.AppSettingsRequest.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
