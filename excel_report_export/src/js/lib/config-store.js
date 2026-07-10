(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig() のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。getConfig()は未設定のアプリではnullを返すことがあるため、
  // saved自体がnull/undefinedでも例外にせず既定値を返す(fiscal_year_numberingと同じ方針)。

  const DEFAULTS = {
    // テンプレート参照先: 対象アプリに限らない任意のアプリの添付ファイルフィールド。
    // フィールドの1番目のファイルをテンプレートとして使用する。
    templateSource: { appId: '', recordId: '', fieldCode: '' },
    // セルマッピング: {sheetName, cellAddress, fieldCode} の配列
    mappings: [],
    // サブテーブル設定: {tableFieldCode, sheetName, startRow, maxRows, columns:[{column, fieldCode}]} の配列
    subtables: [],
    // 出力ファイル名テンプレート({フィールドコード}を差し込める)
    fileNameTemplate: 'report',
    // 一括ダウンロードの上限件数
    bulkDownloadLimit: 100,
  };

  const parseJsonOr = (raw, fallback) => {
    if (!raw) {
      return fallback;
    }
    if (typeof raw === 'object') {
      return raw;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const load = (rawSaved) => {
    const saved = rawSaved || {};
    return {
      templateSource: parseJsonOr(
        saved.templateSource,
        DEFAULTS.templateSource,
      ),
      mappings: parseJsonOr(saved.mappings, DEFAULTS.mappings),
      subtables: parseJsonOr(saved.subtables, DEFAULTS.subtables),
      fileNameTemplate: saved.fileNameTemplate || DEFAULTS.fileNameTemplate,
      bulkDownloadLimit: saved.bulkDownloadLimit
        ? Number(saved.bulkDownloadLimit)
        : DEFAULTS.bulkDownloadLimit,
    };
  };

  const serialize = (config) => ({
    templateSource: JSON.stringify(config.templateSource),
    mappings: JSON.stringify(config.mappings),
    subtables: JSON.stringify(config.subtables),
    fileNameTemplate: config.fileNameTemplate,
    bulkDownloadLimit: String(config.bulkDownloadLimit),
  });

  const ConfigStore = { DEFAULTS, load, serialize };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.ExcelReportExport = root.ExcelReportExport || {};
    root.ExcelReportExport.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
