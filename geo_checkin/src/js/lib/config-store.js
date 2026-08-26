(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  const DEFAULTS = {
    latitudeFieldCode: '',
    longitudeFieldCode: '',
    showMap: false,
  };

  // getConfig()はプラグインが未設定のアプリではnullを返すことがあるため、saved自体がnull/undefinedでも
  // 例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      latitudeFieldCode: saved.latitudeFieldCode || DEFAULTS.latitudeFieldCode,
      longitudeFieldCode:
        saved.longitudeFieldCode || DEFAULTS.longitudeFieldCode,
      showMap: saved.showMap === 'true',
    };
  };

  const serialize = (config) => ({
    latitudeFieldCode: config.latitudeFieldCode,
    longitudeFieldCode: config.longitudeFieldCode,
    showMap: String(!!config.showMap),
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.GeoCheckin = root.GeoCheckin || {};
    root.GeoCheckin.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
