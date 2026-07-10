(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  //
  // rows(集計設定の行)の1件の形:
  //   {
  //     referenceFieldCode: '関連レコード一覧フィールドのコード',
  //     summaryType: 'COUNT' | 'SUM' | 'AVERAGE',
  //     targetFieldCode: '集計対象フィールド(SUM/AVERAGE時のみ使用)',
  //     writeFieldCode: '書き込み先フィールド(数値)',
  //     exclusionCond: '除外条件(クエリの断片。空文字列可)',
  //   }
  const DEFAULTS = {
    rows: [],
    triggers: {
      onSubmit: false,
      onDetailButton: false,
      onIndexBulk: false,
    },
    // 一括集計を許可するグループコードの一覧(plugin_idea_plan.md「一括集計の実行許可グループ(複数)」)。
    // どれか1つにでも所属していれば一覧画面にボタンを表示する(bulk-summary.js参照)。
    bulkGroupCodes: [],
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
  // null を返すことがあるため、saved自体がnull/undefinedでも例外にせず既定値を返す
  // (fiscal_year_numberingで確認済みの事象。related_record_summaryでも同様のガードを入れる)。
  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      rows: parseJsonOr(saved.rows, DEFAULTS.rows),
      triggers: parseJsonOr(saved.triggers, DEFAULTS.triggers),
      bulkGroupCodes: parseJsonOr(
        saved.bulkGroupCodes,
        DEFAULTS.bulkGroupCodes,
      ),
    };
  };

  const serialize = (config) => ({
    rows: JSON.stringify(config.rows),
    triggers: JSON.stringify(config.triggers),
    bulkGroupCodes: JSON.stringify(config.bulkGroupCodes),
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.RelatedRecordSummary = root.RelatedRecordSummary || {};
    root.RelatedRecordSummary.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
