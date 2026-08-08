(function (root) {
  'use strict';

  // kintone.plugin.app.getConfig()/setConfig()のペイロード(キーごとに文字列)の読み書きと、
  // 未保存時のデフォルト値を管理する。
  // targetFieldCodes: [fieldCode, ...] … 一括更新の対象フィールド(値は保存しない。
  //   値は実行のたびに確認ダイアログで入力する。idea.md「任意の値を都度入力する」参照)
  // groupCodes: [code, ...] … 一覧画面ボタンを表示する実行可能グループ
  const DEFAULTS = { targetFieldCodes: [], groupCodes: [] };

  const parseJsonArray = (raw) => {
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const load = (rawConfig) => {
    if (!rawConfig) {
      return { targetFieldCodes: [], groupCodes: [] };
    }
    return {
      targetFieldCodes: parseJsonArray(rawConfig.targetFieldCodes),
      groupCodes: parseJsonArray(rawConfig.groupCodes),
    };
  };

  const serialize = (config) => ({
    targetFieldCodes: JSON.stringify(
      Array.isArray(config.targetFieldCodes) ? config.targetFieldCodes : [],
    ),
    groupCodes: JSON.stringify(
      Array.isArray(config.groupCodes) ? config.groupCodes : [],
    ),
  });

  const ConfigStore = { load, serialize, DEFAULTS };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigStore;
  } else {
    root.BulkFieldUpdate = root.BulkFieldUpdate || {};
    root.BulkFieldUpdate.ConfigStore = ConfigStore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
