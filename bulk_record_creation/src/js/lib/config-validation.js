(function (root) {
  'use strict';

  // 設定画面の保存前チェック。対象者フィールド・繰り返し用日付フィールドは任意項目のため
  // ここでは検証しない。テンプレート対象フィールド・実行可能グループは必須(最低1件)。
  const validateConfig = (config) => {
    const errors = [];

    const templateFieldCodes = Array.isArray(
      config && config.templateFieldCodes,
    )
      ? config.templateFieldCodes
      : [];
    if (templateFieldCodes.length === 0) {
      errors.push('テンプレート対象フィールドを1つ以上指定してください。');
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
    root.BulkRecordCreation = root.BulkRecordCreation || {};
    root.BulkRecordCreation.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
