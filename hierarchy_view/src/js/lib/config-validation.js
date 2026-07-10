(function (root) {
  'use strict';

  const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

  // 設定画面の保存前チェック。例外を投げず、常に { valid, errors } を返す
  // (呼び出し側でalert等に表示しやすくするため)。
  const validateConfig = (config) => {
    const errors = [];

    if (!config) {
      return { valid: false, errors: ['設定が指定されていません。'] };
    }

    if (!isNonEmptyString(config.parentFieldCode)) {
      errors.push(
        '親レコードの識別値を格納するフィールドが選択されていません。',
      );
    }
    if (!isNonEmptyString(config.matchFieldCode)) {
      errors.push('照合対象フィールドが選択されていません。');
    }
    if (
      isNonEmptyString(config.parentFieldCode) &&
      isNonEmptyString(config.matchFieldCode) &&
      config.parentFieldCode === config.matchFieldCode
    ) {
      errors.push(
        '親レコードのフィールドと照合対象フィールドに同じフィールドを指定できません。',
      );
    }

    return { valid: errors.length === 0, errors };
  };

  const ConfigValidation = { validateConfig };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigValidation;
  } else {
    root.HierarchyView = root.HierarchyView || {};
    root.HierarchyView.ConfigValidation = ConfigValidation;
  }
})(typeof window !== 'undefined' ? window : globalThis);
