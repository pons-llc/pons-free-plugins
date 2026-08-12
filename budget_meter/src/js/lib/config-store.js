(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  //
  // rows(予算設定の行)の1件の形:
  //   {
  //     viewId: '一覧のID(REST views.jsonのid、文字列)',
  //     viewName: '一覧名(設定画面での表示用にキャッシュ)',
  //     targetFieldCode: '集計対象フィールドのコード(NUMBER/数値書式CALC)',
  //     budget: 予算額(数値),
  //     warningThresholdPct: 警告しきい値(%、数値。デフォルト80),
  //     dangerThresholdPct: 危険しきい値(%、数値。デフォルト100),
  //     label: 'メーターの見出し(任意。空なら集計対象フィールドのラベルを使う)',
  //   }
  //
  // allViewsGroupCodes: 「すべての予算を確認」ボタンを表示してよいグループコードの配列。
  //   空配列(既定)の場合は誰にも表示しない(group-authorization.js参照)。
  const DEFAULTS = {
    rows: [],
    allViewsGroupCodes: [],
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

  // getConfig()はプラグインが未設定のアプリではnullを返すことがあるため、
  // savedがnull/undefinedでも例外にせず既定値を返す。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      rows: parseJsonOr(saved.rows, DEFAULTS.rows),
      allViewsGroupCodes: parseJsonOr(
        saved.allViewsGroupCodes,
        DEFAULTS.allViewsGroupCodes,
      ),
    };
  };

  const serialize = (config) => ({
    rows: JSON.stringify(config.rows),
    allViewsGroupCodes: JSON.stringify(config.allViewsGroupCodes),
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.BudgetMeter = root.BudgetMeter || {};
    root.BudgetMeter.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
