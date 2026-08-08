(function (root) {
  'use strict';

  // 設定画面の保存前チェック。設定画面では対象フィールドのON/OFFと実行可能グループのみを
  // 扱う(値は保存しない。値は実行のたびに確認ダイアログで入力する。idea.md参照)ため、
  // ここでの検証は「最低1件ずつ選ばれているか」だけで済む。選択肢系フィールドの値必須チェックや
  // 必須フィールドのチェックは、実行時に値が確定した後でしか判定できないため
  // `js/lib/execution-validation.js`が担う。
  const validateConfig = (config) => {
    const errors = [];

    const targetFieldCodes = Array.isArray(config && config.targetFieldCodes)
      ? config.targetFieldCodes
      : [];
    if (targetFieldCodes.length === 0) {
      errors.push('一括更新の対象フィールドを1つ以上指定してください。');
    }

    const groupCodes = Array.isArray(config && config.groupCodes)
      ? config.groupCodes
      : [];
    if (groupCodes.length === 0) {
      errors.push('実行可能グループを1つ以上指定してください。');
    }

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateConfig };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.BulkFieldUpdate = root.BulkFieldUpdate || {};
    root.BulkFieldUpdate.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
