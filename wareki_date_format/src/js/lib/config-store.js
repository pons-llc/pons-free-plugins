(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  const DEFAULTS = {
    pairs: [],
    // 管理者が登録する、Intl(ブラウザのICU)がまだ知らない将来の元号のテーブル。
    // 既定は空配列(明治〜令和はIntlの日本暦カレンダーで自動判定できるため登録不要。era-table.js参照)。
    eras: [],
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
      pairs: parseJsonOr(saved.pairs, DEFAULTS.pairs),
      eras: parseJsonOr(saved.eras, DEFAULTS.eras),
    };
  };

  const serialize = (config) => ({
    pairs: JSON.stringify(config.pairs),
    eras: JSON.stringify(config.eras),
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.WarekiDateFormat = root.WarekiDateFormat || {};
    root.WarekiDateFormat.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
